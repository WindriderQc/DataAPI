const request = require('supertest');
const fs = require('fs-extra');
const path = require('path');

describe('Storage Scan API', () => {
  const tempDir = path.join(__dirname, 'temp_scan_dir');

  beforeAll(async () => {
    await fs.ensureDir(tempDir);
    await fs.writeFile(path.join(tempDir, 'file1.jpg'), 'test content');
    await fs.writeFile(path.join(tempDir, 'file2.png'), 'test content');
    await fs.writeFile(path.join(tempDir, 'file3.txt'), 'test content');
    await fs.ensureDir(path.join(tempDir, 'subdir'));
    await fs.writeFile(path.join(tempDir, 'subdir', 'file4.mkv'), 'test content');
  });

  afterAll(async () => {
    await fs.remove(tempDir);
  });

  beforeEach(async () => {
    await db.mainDb.collection('nas_files').deleteMany({});
    await db.mainDb.collection('nas_scans').deleteMany({});
    await db.mainDb.collection('events').deleteMany({});
  });

  describe('POST /storage/scan', () => {
    it('should start a scan and return a job_id', async () => {
      const res = await request(app)
        .post('/api/v1/storage/scan')
        .send({
          roots: [tempDir],
          extensions: ['jpg', 'png', 'mkv'],
        });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('job_id');

      const jobId = res.body.job_id;

      // Check that the scan document was created
      const scanDoc = await db.mainDb.collection('nas_scans').findOne({ _id: jobId });
      expect(scanDoc).not.toBeNull();
      expect(scanDoc.status).toBe('running');

      // Poll the database for the scan to complete
      let updatedScanDoc;
      for (let i = 0; i < 10; i++) {
        await new Promise(resolve => setTimeout(resolve, 500));
        updatedScanDoc = await db.mainDb.collection('nas_scans').findOne({ _id: jobId });
        if (updatedScanDoc.status === 'done') {
          break;
        }
      }

      // Check that the files were added to the database
      const files = await db.mainDb.collection('nas_files').find({}).toArray();
      expect(files.length).toBe(3);

      const fileExtensions = files.map(f => f.ext);
      expect(fileExtensions).toContain('jpg');
      expect(fileExtensions).toContain('png');
      expect(fileExtensions).toContain('mkv');

      // Check that the scan document was updated
      expect(updatedScanDoc.status).toBe('done');
      expect(updatedScanDoc.counts.files_seen).toBe(3);
      expect(updatedScanDoc.counts.upserts).toBe(3);

      // Check that events were emitted
      const events = await db.mainDb.collection('events').find({}).toArray();
      expect(events.length).toBeGreaterThan(0);
      expect(events.some(e => e.type === 'storage.scan.done')).toBe(true);
    }, 10000); // Increase timeout to 10 seconds
  });
});