const { setup, fullTeardown } = require('./test-setup');
const { scanAndEnqueue } = require('../scripts/geocodeWorker');

let resources;

beforeAll(async () => {
  resources = await setup();
});

afterAll(async () => {
  await fullTeardown(resources);
});

test('scanAndEnqueue dry-run finds a document and does not write jobs', async () => {
  const { db } = resources;
  const devices = db.mainDb.collection('devices');
  // insert a document with lat/lon
  const res = await devices.insertOne({ name: 'dryrun-test-device', lat: 45.12345, lon: -73.54321, geocoded: false });
  const insertedId = res.insertedId;

  const stats = await scanAndEnqueue(db.mainDb, { dryRun: true, scanLimitPerCollection: 100 });

  expect(stats).toBeDefined();
  expect(stats.jobsEnqueued).toBeGreaterThanOrEqual(1);

  // ensure no job documents were actually written
  const jobs = await db.mainDb.collection('geocodeJobs').find({ docId: insertedId }).toArray();
  expect(jobs.length).toBe(0);
});
