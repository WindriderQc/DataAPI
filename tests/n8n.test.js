const request = require('supertest');
const createApp = require('../data_serv');

describe('n8n Authentication and Routes', () => {
  let app;
  let dbConnection;
  let close;
  let db;

  // Test API keys
  const VALID_API_KEY = 'test-n8n-api-key-12345678';
  const INVALID_API_KEY = 'wrong-api-key';

  beforeAll(async () => {
    // Set up environment variables
    process.env.N8N_API_KEY = VALID_API_KEY;
    process.env.N8N_LAN_ONLY = 'false'; // Disable LAN-only for testing
    process.env.NODE_ENV = 'test';

    // Create the app
    const appInstance = await createApp();
    app = appInstance.app;
    dbConnection = appInstance.dbConnection;
    close = appInstance.close;
    db = appInstance.dbConnection.dbs.mainDb;

  }, 60000);

  afterAll(async () => {
    if (close) await close();
    delete process.env.N8N_API_KEY;
    delete process.env.N8N_LAN_ONLY;
  }, 30000);

  describe('n8n Authentication Middleware', () => {
    test('should reject requests without API key', async () => {
      const response = await request(app)
        .get('/api/v1/n8n/health');

      expect(response.status).toBe(401);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('Invalid or missing API key');
    });

    test('should reject requests with invalid API key', async () => {
      const response = await request(app)
        .get('/api/v1/n8n/health')
        .set('x-api-key', INVALID_API_KEY);

      expect(response.status).toBe(401);
      expect(response.body.status).toBe('error');
    });

    test('should accept requests with valid API key', async () => {
      const response = await request(app)
        .get('/api/v1/n8n/health')
        .set('x-api-key', VALID_API_KEY);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.source).toBe('n8n');
    });

    test('should bypass session middleware for valid n8n requests', async () => {
      // n8n requests shouldn't require session cookies
      const response = await request(app)
        .get('/api/v1/n8n/health')
        .set('x-api-key', VALID_API_KEY);

      expect(response.status).toBe(200);
      // Should not set session cookies
      expect(response.headers['set-cookie']).toBeUndefined();
    });
  });

  describe('n8n LAN-Only Mode', () => {
    beforeAll(() => {
      process.env.N8N_LAN_ONLY = 'true';
    });

    afterAll(() => {
      process.env.N8N_LAN_ONLY = 'false';
    });

    test('should accept requests from localhost when LAN-only is enabled', async () => {
      const response = await request(app)
        .get('/api/v1/n8n/health')
        .set('x-api-key', VALID_API_KEY);

      // supertest uses 127.0.0.1, which should be allowed
      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/v1/n8n/health', () => {
    test('should return health status', async () => {
      const response = await request(app)
        .get('/api/v1/n8n/health')
        .set('x-api-key', VALID_API_KEY);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: 'success',
        message: 'n8n API is healthy',
        source: 'n8n'
      });
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('GET /api/v1/n8n/stats', () => {
    test('should return database statistics', async () => {
      const response = await request(app)
        .get('/api/v1/n8n/stats')
        .set('x-api-key', VALID_API_KEY);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data).toHaveProperty('collections');
      expect(response.body.data.collections).toHaveProperty('nas_files');
      expect(response.body.data.collections).toHaveProperty('nas_scans');
      expect(response.body.data).toHaveProperty('timestamp');
    });
  });

  describe('POST /api/v1/n8n/nas/scan', () => {
    test('should create a new scan record', async () => {
      const scanData = {
        roots: ['/mnt/test'],
        extensions: ['mp4', 'avi'],
        metadata: { test: true }
      };

      const response = await request(app)
        .post('/api/v1/n8n/nas/scan')
        .set('x-api-key', VALID_API_KEY)
        .send(scanData);

      expect(response.status).toBe(201);
      expect(response.body.status).toBe('success');
      expect(response.body.data.scanId).toBeDefined();
      expect(response.body.data.scan).toMatchObject({
        roots: scanData.roots,
        extensions: scanData.extensions,
        status: 'pending',
        source: 'n8n'
      });
    });

    test('should reject scan creation without roots', async () => {
      const response = await request(app)
        .post('/api/v1/n8n/nas/scan')
        .set('x-api-key', VALID_API_KEY)
        .send({ extensions: ['mp4'] });

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('roots');
    });

    test('should reject scan creation with empty roots array', async () => {
      const response = await request(app)
        .post('/api/v1/n8n/nas/scan')
        .set('x-api-key', VALID_API_KEY)
        .send({ roots: [], extensions: ['mp4'] });

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
    });
  });

  describe('GET /api/v1/n8n/nas/scans', () => {
    beforeEach(async () => {
      // Clear and seed test data
      await db.collection('nas_scans').deleteMany({});
      await db.collection('nas_scans').insertMany([
        { _id: 'scan1', startedAt: new Date('2025-11-08'), status: 'completed' },
        { _id: 'scan2', startedAt: new Date('2025-11-07'), status: 'failed' },
        { _id: 'scan3', startedAt: new Date('2025-11-06'), status: 'completed' }
      ]);
    });

    test('should list recent scans', async () => {
      const response = await request(app)
        .get('/api/v1/n8n/nas/scans')
        .set('x-api-key', VALID_API_KEY);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.results).toBeGreaterThan(0);
      expect(Array.isArray(response.body.data)).toBe(true);
      // Should be sorted by startedAt DESC
      expect(response.body.data[0]._id).toBe('scan1');
    });

    test('should respect limit parameter', async () => {
      const response = await request(app)
        .get('/api/v1/n8n/nas/scans?limit=2')
        .set('x-api-key', VALID_API_KEY);

      expect(response.status).toBe(200);
      expect(response.body.results).toBeLessThanOrEqual(2);
    });
  });

  describe('GET /api/v1/n8n/nas/scan/:scanId', () => {
    let testScanId;

    beforeEach(async () => {
      await db.collection('nas_scans').deleteMany({});
      const result = await db.collection('nas_scans').insertOne({
        _id: 'test-scan-123',
        status: 'completed',
        filesFound: 100
      });
      testScanId = 'test-scan-123';
    });

    test('should retrieve scan by ID', async () => {
      const response = await request(app)
        .get(`/api/v1/n8n/nas/scan/${testScanId}`)
        .set('x-api-key', VALID_API_KEY);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data._id).toBe(testScanId);
      expect(response.body.data.status).toBe('completed');
    });

    test('should return 404 for non-existent scan', async () => {
      const response = await request(app)
        .get('/api/v1/n8n/nas/scan/non-existent-scan')
        .set('x-api-key', VALID_API_KEY);

      expect(response.status).toBe(404);
      expect(response.body.status).toBe('error');
    });
  });

  describe('PATCH /api/v1/n8n/nas/scan/:scanId', () => {
    let testScanId;

    beforeEach(async () => {
      await db.collection('nas_scans').deleteMany({});
      await db.collection('nas_scans').insertOne({
        _id: 'test-scan-patch',
        status: 'pending',
        filesFound: 0
      });
      testScanId = 'test-scan-patch';
    });

    test('should update scan status', async () => {
      const updates = {
        status: 'completed',
        filesFound: 150,
        filesProcessed: 150
      };

      const response = await request(app)
        .patch(`/api/v1/n8n/nas/scan/${testScanId}`)
        .set('x-api-key', VALID_API_KEY)
        .send(updates);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.modified).toBe(true);

      // Verify update in database
      const updated = await db.collection('nas_scans').findOne({ _id: testScanId });
      expect(updated.status).toBe('completed');
      expect(updated.filesFound).toBe(150);
      expect(updated.completedAt).toBeDefined();
    });

    test('should set completedAt when status is completed', async () => {
      const response = await request(app)
        .patch(`/api/v1/n8n/nas/scan/${testScanId}`)
        .set('x-api-key', VALID_API_KEY)
        .send({ status: 'completed' });

      expect(response.status).toBe(200);

      const updated = await db.collection('nas_scans').findOne({ _id: testScanId });
      expect(updated.completedAt).toBeDefined();
    });

    test('should return 404 for non-existent scan', async () => {
      const response = await request(app)
        .patch('/api/v1/n8n/nas/scan/non-existent')
        .set('x-api-key', VALID_API_KEY)
        .send({ status: 'completed' });

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/v1/n8n/nas/files', () => {
    beforeEach(async () => {
      await db.collection('nas_files').deleteMany({});
    });

    test('should insert multiple files', async () => {
      const files = [
        { path: '/test/file1.mp4', size: 1000, extension: 'mp4' },
        { path: '/test/file2.mp4', size: 2000, extension: 'mp4' }
      ];

      const response = await request(app)
        .post('/api/v1/n8n/nas/files')
        .set('x-api-key', VALID_API_KEY)
        .send({ files, scanId: 'test-scan' });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.total).toBe(2);
      expect(response.body.data.inserted).toBe(2);
    });

    test('should upsert existing files', async () => {
      // Insert initial file
      await db.collection('nas_files').insertOne({
        path: '/test/existing.mp4',
        size: 1000
      });

      // Update the same file
      const files = [
        { path: '/test/existing.mp4', size: 1500, extension: 'mp4' }
      ];

      const response = await request(app)
        .post('/api/v1/n8n/nas/files')
        .set('x-api-key', VALID_API_KEY)
        .send({ files });

      expect(response.status).toBe(200);
      expect(response.body.data.matched).toBe(1);
      
      // Verify update
      const updated = await db.collection('nas_files').findOne({ 
        path: '/test/existing.mp4' 
      });
      expect(updated.size).toBe(1500);
    });

    test('should reject empty files array', async () => {
      const response = await request(app)
        .post('/api/v1/n8n/nas/files')
        .set('x-api-key', VALID_API_KEY)
        .send({ files: [] });

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
    });

    test('should reject request without files', async () => {
      const response = await request(app)
        .post('/api/v1/n8n/nas/files')
        .set('x-api-key', VALID_API_KEY)
        .send({});

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/v1/n8n/nas/files', () => {
    beforeEach(async () => {
      await db.collection('nas_files').deleteMany({});
      await db.collection('nas_files').insertMany([
        { path: '/test/video1.mp4', size: 1000, extension: 'mp4', modified: new Date('2025-11-08') },
        { path: '/test/video2.avi', size: 2000, extension: 'avi', modified: new Date('2025-11-07') },
        { path: '/test/photo.jpg', size: 500, extension: 'jpg', modified: new Date('2025-11-06') }
      ]);
    });

    test('should list all files', async () => {
      const response = await request(app)
        .get('/api/v1/n8n/nas/files')
        .set('x-api-key', VALID_API_KEY);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.results).toBe(3);
      expect(response.body.total).toBe(3);
    });

    test('should filter by extension', async () => {
      const response = await request(app)
        .get('/api/v1/n8n/nas/files?extension=mp4')
        .set('x-api-key', VALID_API_KEY);

      expect(response.status).toBe(200);
      expect(response.body.results).toBe(1);
      expect(response.body.data[0].extension).toBe('mp4');
    });

    test('should filter by size range', async () => {
      const response = await request(app)
        .get('/api/v1/n8n/nas/files?minSize=1000&maxSize=2000')
        .set('x-api-key', VALID_API_KEY);

      expect(response.status).toBe(200);
      expect(response.body.results).toBe(2);
    });

    test('should respect limit parameter', async () => {
      const response = await request(app)
        .get('/api/v1/n8n/nas/files?limit=2')
        .set('x-api-key', VALID_API_KEY);

      expect(response.status).toBe(200);
      expect(response.body.results).toBe(2);
    });

    test('should support pagination with skip', async () => {
      const response = await request(app)
        .get('/api/v1/n8n/nas/files?limit=2&skip=1')
        .set('x-api-key', VALID_API_KEY);

      expect(response.status).toBe(200);
      expect(response.body.results).toBe(2);
    });

    test('should enforce max limit of 1000', async () => {
      const response = await request(app)
        .get('/api/v1/n8n/nas/files?limit=5000')
        .set('x-api-key', VALID_API_KEY);

      expect(response.status).toBe(200);
      // Should not exceed 1000 even if requested
      expect(response.body.results).toBeLessThanOrEqual(1000);
    });
  });
});
