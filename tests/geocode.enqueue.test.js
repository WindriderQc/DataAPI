const { setup, fullTeardown } = require('./test-setup');
const { scanAndEnqueue } = require('../scripts/geocodeWorker');

let resources;

beforeAll(async () => {
  resources = await setup();
});

afterAll(async () => {
  await fullTeardown(resources);
});

test('scanAndEnqueue enqueues job (non-dry run)', async () => {
  const { db } = resources;
  const devices = db.mainDb.collection('devices');
  // insert a document with lat/lon
  const res = await devices.insertOne({ name: 'enqueue-test-device', lat: 12.345678, lon: 56.789012, geocoded: false });
  const insertedId = res.insertedId;

  // ensure no pre-existing jobs
  await db.mainDb.collection('geocodeJobs').deleteMany({ docId: insertedId });

  const stats = await scanAndEnqueue(db.mainDb, { dryRun: false, scanLimitPerCollection: 100 });

  expect(stats).toBeDefined();
  expect(stats.jobsEnqueued).toBeGreaterThanOrEqual(1);

  // ensure job documents were actually written
  const jobs = await db.mainDb.collection('geocodeJobs').find({ docId: insertedId }).toArray();
  expect(jobs.length).toBeGreaterThanOrEqual(1);
  const job = jobs[0];
  expect(job.lat).toBeCloseTo(12.345678, 6);
  expect(job.lon).toBeCloseTo(56.789012, 6);
  expect(job.collection).toBe('devices');
  expect(job.status).toBe('pending');
});
