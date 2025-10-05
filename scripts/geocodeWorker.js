const { log } = require('../utils/logger');
const { fetchWithTimeoutAndRetry } = require('../utils/fetch-utils');
const config = require('../config/config');

// A minimal Mongo-backed queue worker for reverse geocoding using LocationIQ
// This is intentionally dependency-free (no Redis) and polls a 'geocodeJobs' collection.

const DEFAULT_POLL_INTERVAL = 1000; // ms
const MIN_TIME_BETWEEN_REQS = 1100; // ms (slightly over 1req/sec)

let running = false;

// fields heuristics for locating lat/lon in arbitrary collections
const COORD_FIELD_PAIRS = [
  ['lat', 'lon'],
  ['latitude', 'longitude'],
  ['coords.lat', 'coords.lon'],
  ['location.lat', 'location.lon'],
  ['location.coordinates.1', 'location.coordinates.0'], // GeoJSON coordinates: [lon, lat]
  ['geometry.coordinates.1', 'geometry.coordinates.0'],
  ['location.coordinates.0', 'location.coordinates.1'], // alternate ordering if stored differently
];

function roundKey(lat, lon, precision = 3) {
  return `${Number(lat).toFixed(precision)}:${Number(lon).toFixed(precision)}`;
}

async function processJob(db, job) {
  const jobsColl = db.collection('geocodeJobs');
  const cacheColl = db.collection('geocodeCache');
  const targetColl = db.collection(job.collection);

  const { lat, lon, docId } = job;

  try {
    // check cache
    const key = roundKey(lat, lon);
    const cached = await cacheColl.findOne({ _id: key });
    if (cached && cached.result) {
      await targetColl.updateOne({ _id: docId }, { $set: { geocoded: true, geocodedAt: new Date(), geocode: cached.result } });
      await jobsColl.updateOne({ _id: job._id }, { $set: { status: 'done', finishedAt: new Date() } });
      log(`Geocode: cache hit for ${key}`);
      return { retryAfter: 0 };
    }

    const apiKey = process.env.LOCATION_IQ_API;
    if (!apiKey) {
      throw new Error('LOCATION_IQ_API key missing');
    }

    const url = `https://us1.locationiq.com/v1/reverse.php?key=${apiKey}&lat=${lat}&lon=${lon}&format=json`;
    const resp = await fetchWithTimeoutAndRetry(url, { timeout: config.api.defaultFetchTimeout, retries: config.api.defaultFetchRetries, name: 'LocationIQ' });

    if (!resp.ok) {
      const status = resp.status;
      const retryAfter = parseInt(resp.headers && resp.headers.get ? resp.headers.get('retry-after') : (resp.headers && resp.headers['retry-after']) || 0, 10) || 0;
      throw { status, retryAfter, message: `LocationIQ status ${status}` };
    }

    const json = await resp.json();
    const result = {
      provider: 'LocationIQ',
      country: json && json.address ? json.address.country : null,
      raw: json,
    };

    // write cache and target doc
    await cacheColl.updateOne({ _id: key }, { $set: { result, lastSeen: new Date() } }, { upsert: true });
    await targetColl.updateOne({ _id: docId }, { $set: { geocoded: true, geocodedAt: new Date(), geocode: result } });
    await jobsColl.updateOne({ _id: job._id }, { $set: { status: 'done', finishedAt: new Date() } });
    log(`Geocode: success for job ${job._id} -> ${key}`);
    return { retryAfter: 0 };
  } catch (err) {
    // normalize error
    const isRate = err && (err.status === 429 || (err.message && err.message.toLowerCase().includes('rate')));
    const retryAfter = err && err.retryAfter ? Number(err.retryAfter) : (isRate ? 60 : 0);
    await db.collection('geocodeJobs').updateOne({ _id: job._id }, { $inc: { attempts: 1 }, $set: { lastError: (err && err.message) || String(err) } });
    log(`Geocode: job ${job._id} failed: ${err && err.message ? err.message : JSON.stringify(err)}; retryAfter=${retryAfter}`,'warn');
    return { retryAfter };
  }
}

async function scanAndEnqueue(db, opts = {}) {
  // Scan all non-system collections and enqueue geocodeJobs for docs that look geocodable
  const jobsColl = db.collection('geocodeJobs');
  const stats = {
    collectionsScanned: 0,
    candidateDocsFound: 0,
    jobsEnqueued: 0,
    jobsSkippedExisting: 0,
    docsNoCoords: 0,
  };

  const skipCollections = new Set(['geocodeJobs', 'geocodeCache', 'system.indexes']);
  const collections = await db.listCollections().toArray();
  for (const c of collections) {
    const name = c.name;
    if (!name || name.startsWith('system.') || skipCollections.has(name)) continue;
    stats.collectionsScanned++;

    // For each heuristic pair, attempt to find documents missing geocode and having those fields
    const perCollectionLimit = opts.scanLimitPerCollection || 1000;
    let foundAny = false;

    for (const [latField, lonField] of COORD_FIELD_PAIRS) {
      // build query to find docs that are not geocoded and have both fields
      const query = {
        geocoded: { $ne: true },
      };
      query[latField] = { $exists: true };
      query[lonField] = { $exists: true };

      const cursor = db.collection(name).find(query).limit(perCollectionLimit);
      const docs = await cursor.toArray();
      if (!docs || docs.length === 0) continue;

      foundAny = true;
      stats.candidateDocsFound += docs.length;

  for (const doc of docs) {
        // determine numeric lat/lon values from doc using dot paths
        function getByPath(obj, path) {
          return path.split('.').reduce((acc, p) => (acc && acc[p] !== undefined ? acc[p] : undefined), obj);
        }

        let lat = getByPath(doc, latField);
        let lon = getByPath(doc, lonField);

        // if fields reversed (we used [1,0] for geojson), try to coerce
        if (lat == null || lon == null) {
          stats.docsNoCoords++;
          continue;
        }

        // normalize numeric values if arrays
        if (Array.isArray(lat) && lat.length) lat = Number(lat[0]);
        if (Array.isArray(lon) && lon.length) lon = Number(lon[0]);

        // if values present but not numeric, attempt parse
        lat = Number(lat);
        lon = Number(lon);
        if (!isFinite(lat) || !isFinite(lon)) {
          stats.docsNoCoords++;
          continue;
        }

        // skip if job already exists for this doc and collection
        const existing = await jobsColl.findOne({ docId: doc._id, collection: name, status: { $in: ['pending', 'processing'] } });
        if (existing) {
          stats.jobsSkippedExisting++;
          continue;
        }

        stats.jobsEnqueued++;
        if (!opts.dryRun) {
          const job = {
            lat,
            lon,
            docId: doc._id,
            collection: name,
            status: 'pending',
            attempts: 0,
            createdAt: new Date(),
            nextRun: new Date(),
          };

          await jobsColl.insertOne(job);
        }
      }
    }

    if (!foundAny) {
      // no heuristics matched for this collection
      // nothing to do
    }
  }

  log(`Geocode scan: scanned ${stats.collectionsScanned} collections, candidates ${stats.candidateDocsFound}, enqueued ${stats.jobsEnqueued}, skipped ${stats.jobsSkippedExisting}, no-coords ${stats.docsNoCoords}`);
  return stats;
}

async function start(db, opts = {}) {
  if (running) return;
  running = true;
  const pollInterval = opts.pollInterval || DEFAULT_POLL_INTERVAL;
  let lastRequestTime = 0;

  log('GeocodeWorker starting');

  // optionally scan collections and enqueue jobs before entering loop
  if (opts.scanAllCollections) {
    try {
      const scanStats = await scanAndEnqueue(db, opts);
      // if oneShot requested and we enqueued jobs, fall through to process them, otherwise exit if requested
      if (opts.oneShot && (!scanStats || scanStats.jobsEnqueued === 0)) {
        log('GeocodeWorker oneShot mode: nothing enqueued, stopping');
        running = false;
        return;
      }
    } catch (e) {
      log(`GeocodeWorker scan error: ${e && e.message ? e.message : e}`, 'warn');
    }
  }

  while (running) {
    try {
      // Find one pending job where nextRun <= now
      const now = new Date();
      const job = await db.collection('geocodeJobs').findOneAndUpdate(
        { status: 'pending', nextRun: { $lte: now } },
        { $set: { status: 'processing', startedAt: new Date() } },
        { sort: { attempts: 1 } }
      );

      if (job && job.value) {
        const j = job.value;

        // enforce min time between requests
        const since = Date.now() - lastRequestTime;
        if (since < MIN_TIME_BETWEEN_REQS) {
          await new Promise(r => setTimeout(r, MIN_TIME_BETWEEN_REQS - since));
        }
        lastRequestTime = Date.now();

        const { retryAfter } = await processJob(db, j);
        if (retryAfter && retryAfter > 0) {
          // schedule retry
          const next = new Date(Date.now() + (retryAfter * 1000));
          await db.collection('geocodeJobs').updateOne({ _id: j._id }, { $set: { status: 'pending', nextRun: next } });
        }
      } else {
        // nothing to do; sleep
        await new Promise(r => setTimeout(r, pollInterval));
      }
    } catch (e) {
      log(`GeocodeWorker loop error: ${e && e.message ? e.message : e}`, 'error');
      await new Promise(r => setTimeout(r, pollInterval));
    }
  }

  log('GeocodeWorker stopped');
}

function stop() {
  running = false;
}

module.exports = { start, stop, scanAndEnqueue };
