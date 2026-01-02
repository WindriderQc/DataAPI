const request = require('supertest');
const fs = require('fs-extra');
const path = require('path');

const TOOL_KEY = process.env.DATAAPI_API_KEY;

describe('Janitor API', () => {
  const tempDir = path.join(__dirname, 'temp_janitor_dir');
  const subDir = path.join(tempDir, 'subdir');
  const tempSubDir = path.join(tempDir, 'temp');

  beforeAll(async () => {
    // Create test directory structure
    await fs.ensureDir(tempDir);
    await fs.ensureDir(subDir);
    await fs.ensureDir(tempSubDir);

    // Create test files
    await fs.writeFile(path.join(tempDir, 'file1.txt'), 'This is test content A');
    await fs.writeFile(path.join(tempDir, 'file2.txt'), 'This is test content B');

    // Create duplicate files (same content)
    await fs.writeFile(path.join(tempDir, 'duplicate1.txt'), 'This is duplicate content');
    await fs.writeFile(path.join(subDir, 'duplicate2.txt'), 'This is duplicate content');

    // Create temp file older than 7 days
    const tempFilePath = path.join(tempSubDir, 'old_temp_file.tmp');
    await fs.writeFile(tempFilePath, 'This is a temp file');

    // Set mtime to 8 days ago
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 8);
    await fs.utimes(tempFilePath, oldDate, oldDate);

    // Create a recent temp file
    await fs.writeFile(path.join(tempSubDir, 'recent_temp_file.tmp'), 'Recent temp file');
  });

  afterAll(async () => {
    // Clean up test directory
    await fs.remove(tempDir);
  });

  describe('GET /policies', () => {
    it('should return available cleanup policies', async () => {
      const res = await request(app)
        .get('/api/v1/janitor/policies')
        .set('x-api-key', TOOL_KEY);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('policies');
      expect(Array.isArray(res.body.policies)).toBe(true);
      expect(res.body.policies.length).toBeGreaterThan(0);

      // Check that default policies are present
      const policyIds = res.body.policies.map(p => p.id);
      expect(policyIds).toContain('delete_duplicates');
      expect(policyIds).toContain('remove_temp_files');

      // Verify policy structure
      const firstPolicy = res.body.policies[0];
      expect(firstPolicy).toHaveProperty('id');
      expect(firstPolicy).toHaveProperty('name');
      expect(firstPolicy).toHaveProperty('description');
      expect(firstPolicy).toHaveProperty('enabled');
      expect(firstPolicy).toHaveProperty('safe_mode');
    });
  });

  describe('POST /analyze', () => {
    it('should analyze directory and find duplicates', async () => {
      const res = await request(app)
        .post('/api/v1/janitor/analyze')
        .set('x-api-key', TOOL_KEY)
        .send({ path: tempDir });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('path', tempDir);
      expect(res.body).toHaveProperty('total_files');
      expect(res.body).toHaveProperty('scanned_files');
      expect(res.body).toHaveProperty('total_size');
      expect(res.body).toHaveProperty('duplicates_count');
      expect(res.body).toHaveProperty('wasted_space');
      expect(res.body).toHaveProperty('wasted_space_mb');
      expect(res.body).toHaveProperty('duplicate_groups');

      // We created 2 duplicate files
      expect(res.body.duplicates_count).toBeGreaterThanOrEqual(1);
      expect(res.body.total_files).toBeGreaterThanOrEqual(6);

      // Check duplicate_groups structure
      if (res.body.duplicate_groups.length > 0) {
        const firstGroup = res.body.duplicate_groups[0];
        expect(firstGroup).toHaveProperty('hash');
        expect(firstGroup).toHaveProperty('count');
        expect(firstGroup).toHaveProperty('files');
        expect(firstGroup).toHaveProperty('size');
        expect(firstGroup).toHaveProperty('wasted');
        expect(Array.isArray(firstGroup.files)).toBe(true);
        expect(firstGroup.count).toBeGreaterThanOrEqual(2);
      }
    });

    it('should return 400 when path is missing', async () => {
      const res = await request(app)
        .post('/api/v1/janitor/analyze')
        .set('x-api-key', TOOL_KEY)
        .send({});

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toContain('path required');
    });

    it('should handle non-existent directory gracefully', async () => {
      const res = await request(app)
        .post('/api/v1/janitor/analyze')
        .set('x-api-key', TOOL_KEY)
        .send({ path: '/nonexistent/directory/path' });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('total_files', 0);
      expect(res.body).toHaveProperty('duplicates_count', 0);
    });
  });

  describe('POST /suggest', () => {
    it('should generate cleanup suggestions with default policies', async () => {
      const res = await request(app)
        .post('/api/v1/janitor/suggest')
        .set('x-api-key', TOOL_KEY)
        .send({ path: tempDir });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('path', tempDir);
      expect(res.body).toHaveProperty('suggestions_count');
      expect(res.body).toHaveProperty('total_space_saved');
      expect(res.body).toHaveProperty('total_space_saved_mb');
      expect(res.body).toHaveProperty('suggestions');
      expect(res.body).toHaveProperty('policies_applied');

      expect(Array.isArray(res.body.suggestions)).toBe(true);
      expect(Array.isArray(res.body.policies_applied)).toBe(true);

      // We should have suggestions for duplicates and old temp files
      expect(res.body.suggestions_count).toBeGreaterThan(0);
    });

    it('should generate suggestions with specific policies', async () => {
      const res = await request(app)
        .post('/api/v1/janitor/suggest')
        .set('x-api-key', TOOL_KEY)
        .send({
          path: tempDir,
          policies: ['delete_duplicates']
        });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('suggestions');
      expect(res.body.policies_applied).toContain('delete_duplicates');

      // Should only have duplicate suggestions
      const duplicateSuggestions = res.body.suggestions.filter(s => s.policy === 'delete_duplicates');
      expect(duplicateSuggestions.length).toBeGreaterThan(0);
    });

    it('should generate suggestions for temp files', async () => {
      const res = await request(app)
        .post('/api/v1/janitor/suggest')
        .set('x-api-key', TOOL_KEY)
        .send({
          path: tempDir,
          policies: ['remove_temp_files']
        });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('suggestions');

      // Filter suggestions for temp file policy
      const tempSuggestions = res.body.suggestions.filter(s => s.policy === 'remove_temp_files');

      // We created an old temp file
      expect(tempSuggestions.length).toBeGreaterThan(0);

      if (tempSuggestions.length > 0) {
        const suggestion = tempSuggestions[0];
        expect(suggestion).toHaveProperty('action', 'delete');
        expect(suggestion).toHaveProperty('files');
        expect(suggestion).toHaveProperty('reason');
        expect(suggestion.reason).toContain('Temp file older than');
      }
    });

    it('should return 400 when path is missing', async () => {
      const res = await request(app)
        .post('/api/v1/janitor/suggest')
        .set('x-api-key', TOOL_KEY)
        .send({});

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toContain('path required');
    });

    it('should verify suggestion structure', async () => {
      const res = await request(app)
        .post('/api/v1/janitor/suggest')
        .set('x-api-key', TOOL_KEY)
        .send({ path: tempDir });

      expect(res.statusCode).toBe(200);

      if (res.body.suggestions.length > 0) {
        const suggestion = res.body.suggestions[0];
        expect(suggestion).toHaveProperty('policy');
        expect(suggestion).toHaveProperty('action');
        expect(suggestion).toHaveProperty('files');
        expect(suggestion).toHaveProperty('reason');
        expect(suggestion).toHaveProperty('space_saved');
        expect(Array.isArray(suggestion.files)).toBe(true);
      }
    });
  });

  describe('POST /execute', () => {
    it('should perform dry run by default', async () => {
      // Create a test file to "delete"
      const testFilePath = path.join(tempDir, 'test_delete.txt');
      await fs.writeFile(testFilePath, 'Test content');

      const res = await request(app)
        .post('/api/v1/janitor/execute')
        .set('x-api-key', TOOL_KEY)
        .send({ files: [testFilePath] });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('dry_run', true);
      expect(res.body).toHaveProperty('total_files', 1);
      expect(res.body).toHaveProperty('deleted');
      expect(res.body).toHaveProperty('failed');
      expect(res.body).toHaveProperty('space_freed');
      expect(res.body).toHaveProperty('space_freed_mb');
      expect(res.body).toHaveProperty('warning');
      expect(res.body.warning).toContain('dry run');

      // File should still exist
      const exists = await fs.pathExists(testFilePath);
      expect(exists).toBe(true);

      // Cleanup
      await fs.remove(testFilePath);
    });

    it('should actually delete files when dry_run is false', async () => {
      // Create a test file to delete
      const testFilePath = path.join(tempDir, 'test_delete_real.txt');
      await fs.writeFile(testFilePath, 'Test content to delete');

      // Verify file exists before deletion
      let exists = await fs.pathExists(testFilePath);
      expect(exists).toBe(true);

      const res = await request(app)
        .post('/api/v1/janitor/execute')
        .set('x-api-key', TOOL_KEY)
        .send({
          files: [testFilePath],
          dry_run: false
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.dry_run).toBe(false);
      expect(res.body.deleted).toContain(testFilePath);
      expect(res.body.deleted.length).toBe(1);
      expect(res.body.failed.length).toBe(0);
      expect(res.body.warning).toContain('permanently deleted');

      // File should no longer exist
      exists = await fs.pathExists(testFilePath);
      expect(exists).toBe(false);
    });

    it('should handle multiple files', async () => {
      // Create multiple test files
      const file1 = path.join(tempDir, 'multi1.txt');
      const file2 = path.join(tempDir, 'multi2.txt');
      await fs.writeFile(file1, 'Content 1');
      await fs.writeFile(file2, 'Content 2');

      const res = await request(app)
        .post('/api/v1/janitor/execute')
        .set('x-api-key', TOOL_KEY)
        .send({
          files: [file1, file2],
          dry_run: false
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.total_files).toBe(2);
      expect(res.body.deleted.length).toBe(2);
      expect(res.body.deleted).toContain(file1);
      expect(res.body.deleted).toContain(file2);
    });

    it('should return 400 when files array is missing', async () => {
      const res = await request(app)
        .post('/api/v1/janitor/execute')
        .set('x-api-key', TOOL_KEY)
        .send({});

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toContain('files array required');
    });

    it('should return 400 when files is not an array', async () => {
      const res = await request(app)
        .post('/api/v1/janitor/execute')
        .set('x-api-key', TOOL_KEY)
        .send({ files: 'not-an-array' });

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toContain('files array required');
    });

    it('should block deletion of system directories', async () => {
      const res = await request(app)
        .post('/api/v1/janitor/execute')
        .set('x-api-key', TOOL_KEY)
        .send({
          files: ['/', '/usr', '/bin'],
          dry_run: false
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.failed.length).toBe(3);
      expect(res.body.deleted.length).toBe(0);

      res.body.failed.forEach(failure => {
        expect(failure.reason).toContain('Blocked by safety policy');
      });
    });

    it('should handle non-existent files gracefully', async () => {
      const res = await request(app)
        .post('/api/v1/janitor/execute')
        .set('x-api-key', TOOL_KEY)
        .send({
          files: ['/nonexistent/file.txt'],
          dry_run: false
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.failed.length).toBe(1);
      expect(res.body.failed[0].reason).toContain('File not found');
      expect(res.body.deleted.length).toBe(0);
    });

    it('should handle mix of valid and invalid files', async () => {
      // Create one valid file
      const validFile = path.join(tempDir, 'valid_file.txt');
      await fs.writeFile(validFile, 'Valid content');

      const res = await request(app)
        .post('/api/v1/janitor/execute')
        .set('x-api-key', TOOL_KEY)
        .send({
          files: [
            validFile,
            '/nonexistent/file.txt',
            '/'
          ],
          dry_run: false
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.total_files).toBe(3);
      expect(res.body.deleted.length).toBe(1);
      expect(res.body.deleted).toContain(validFile);
      expect(res.body.failed.length).toBe(2);
    });

    it('should reject relative paths', async () => {
      const res = await request(app)
        .post('/api/v1/janitor/execute')
        .set('x-api-key', TOOL_KEY)
        .send({
          files: ['relative/path/file.txt'],
          dry_run: false
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.failed.length).toBe(1);
      expect(res.body.failed[0].reason).toContain('Blocked by safety policy');
    });

    it('should report space freed correctly', async () => {
      // Create a file with known size
      const testFile = path.join(tempDir, 'sized_file.txt');
      const content = 'X'.repeat(1000); // 1000 bytes
      await fs.writeFile(testFile, content);

      const res = await request(app)
        .post('/api/v1/janitor/execute')
        .set('x-api-key', TOOL_KEY)
        .send({
          files: [testFile],
          dry_run: false
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.space_freed).toBe(1000);
      expect(res.body.space_freed_mb).toBe(0); // Rounds to 0 MB
    });
  });

  describe('Integration: Full Workflow', () => {
    it('should analyze, suggest, and execute cleanup in sequence', async () => {
      // Step 1: Analyze
      const analyzeRes = await request(app)
        .post('/api/v1/janitor/analyze')
        .set('x-api-key', TOOL_KEY)
        .send({ path: tempDir });

      expect(analyzeRes.statusCode).toBe(200);
      expect(analyzeRes.body.duplicates_count).toBeGreaterThan(0);

      // Step 2: Get suggestions
      const suggestRes = await request(app)
        .post('/api/v1/janitor/suggest')
        .set('x-api-key', TOOL_KEY)
        .send({
          path: tempDir,
          policies: ['delete_duplicates']
        });

      expect(suggestRes.statusCode).toBe(200);
      expect(suggestRes.body.suggestions_count).toBeGreaterThan(0);

      // Step 3: Execute dry run
      const filesToDelete = suggestRes.body.suggestions
        .filter(s => s.policy === 'delete_duplicates')
        .flatMap(s => s.files)
        .slice(0, 1); // Take only one file

      if (filesToDelete.length > 0) {
        const executeRes = await request(app)
          .post('/api/v1/janitor/execute')
          .set('x-api-key', TOOL_KEY)
          .send({
            files: filesToDelete,
            dry_run: true
          });

        expect(executeRes.statusCode).toBe(200);
        expect(executeRes.body.dry_run).toBe(true);
        expect(executeRes.body.deleted.length).toBeGreaterThan(0);
      }
    });
  });
});
