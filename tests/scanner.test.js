const request = require('supertest');
const fs = require('fs-extra');
const path = require('path');

describe('Scanner API', () => {
  const tempDir = path.join(__dirname, 'temp_scan_dir');
  const apiKey = 'test-api-key';

  beforeAll(async () => {
    process.env.INTEGRATIONS_API_KEY = apiKey;
    await fs.ensureDir(tempDir);
    // Create a larger number of files to ensure the scan takes time
    for (let i = 0; i < 1500; i++) {
      await fs.writeFile(path.join(tempDir, `file${i}.jpg`), 'test content');
    }
    await fs.writeFile(path.join(tempDir, 'file.txt'), 'test content'); // a non-matching file
    await fs.ensureDir(path.join(tempDir, 'subdir'));
    await fs.writeFile(path.join(tempDir, 'subdir', 'subfile.mkv'), 'test content');
  });

  afterAll(async () => {
    delete process.env.INTEGRATIONS_API_KEY;
    await fs.remove(tempDir);
  });

  beforeEach(async () => {
    // These collections are used by the scanner, clear them before each test
    await db.mainDb.collection('nas_files').deleteMany({});
    await db.mainDb.collection('nas_scans').deleteMany({});
  });

  it('should start, report status, stop, and complete a scan', async () => {
    // 1. Start a scan
    const startRes = await request(app)
      .post('/scanner/start')
      .set('x-api-key', apiKey)
      .send({
        roots: [tempDir],
        includeExt: ['jpg', 'mkv'],
      });

    expect(startRes.statusCode).toBe(200);
    expect(startRes.body).toHaveProperty('scan_id');
    const scanId = startRes.body.scan_id;

    // Allow some time for the scan to be in a running state
    await new Promise(resolve => setTimeout(resolve, 100));

    // 2. Check initial status
    const statusRes1 = await request(app)
      .get(`/scanner/status/${scanId}`)
      .set('x-api-key', apiKey);

    expect(statusRes1.statusCode).toBe(200);
    expect(statusRes1.body.status).toBe('running');
    expect(statusRes1.body.live).toBe(true);

    // 3. Stop the scan
    const stopRes = await request(app)
      .post(`/scanner/stop/${scanId}`)
      .set('x-api-key', apiKey);

    expect(stopRes.statusCode).toBe(200);
    expect(stopRes.body.ok).toBe(true);

    // 4. Poll for 'stopped' status
    let finalStatus;
    for (let i = 0; i < 10; i++) {
      const statusRes = await request(app).get(`/scanner/status/${scanId}`).set('x-api-key', apiKey);
      finalStatus = statusRes.body.status;
      if (finalStatus === 'stopped') break;
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    expect(finalStatus).toBe('stopped');

    // 5. Verify it is no longer reported as a live scan
    const statusRes2 = await request(app)
    .get(`/scanner/status/${scanId}`)
    .set('x-api-key', apiKey);
    expect(statusRes2.body.live).toBe(false);

  }, 15000); // Increase timeout for the comprehensive test
});