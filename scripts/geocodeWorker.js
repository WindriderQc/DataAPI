const { log } = require('../utils/logger');
const { fetchWithTimeoutAndRetry } = require('../utils/fetch-utils');
const config = require('../config/config');

// A minimal Mongo-backed queue worker for reverse geocoding using LocationIQ
// This is intentionally dependency-free (no Redis) and polls a 'geocodeJobs' collection.

const DEFAULT_POLL_INTERVAL = 1000; // ms
const MIN_TIME_BETWEEN_REQS = 1100; // ms (slightly over 1req/sec)

let running = false;

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

async function start(db, opts = {}) {
  if (running) return;
  running = true;
  const pollInterval = opts.pollInterval || DEFAULT_POLL_INTERVAL;
  let lastRequestTime = 0;

  log('GeocodeWorker starting');

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

module.exports = { start, stop };
