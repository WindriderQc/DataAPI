const router = require('express').Router();

const { body } = require('express-validator');
const genericController = require('../controllers/genericController');
const logController = require('../controllers/logController');
const mewController = require('../controllers/mewController');
const { fetchWithTimeoutAndRetry } = require('../utils/fetch-utils');

const liveDatasController = require('../controllers/liveDataController');
const feedController = require('../controllers/feedController');
const storageController = require('../controllers/storageController');
const fileBrowserController = require('../controllers/fileBrowserController');
const fileExportController = require('../controllers/fileExportController');
const { generateOptimizedReport } = require('../controllers/fileExportController');
// const externalApiController = require('../controllers/externalApiController'); // Keeping this as is per file content check
const externalApiController = require('../controllers/externalApiController');

// New imports from PR
const databasesController = require('../controllers/databasesController');
const { requireAuth } = require('../utils/auth');
const { requireRole } = require('../middleware/rbac');
const { requireEitherAuth } = require('../middleware/flexAuth');
const chatkitController = require('../controllers/chatkitController');
const weatherController = require('../controllers/weatherController');
const ollamaController = require('../controllers/ollamaController');
const liveDataConfigController = require('../controllers/liveDataConfigController');

// A default API response to check if the API is up
router.get('/', (req, res) => {
    res.json({
        status: 'success',
        message: 'DataAPI tool server is running'
    });
});

// Deterministic geolocation response for tests; real fetch in non-test env.
router.get('/geolocation', async (req, res) => {
    if (process.env.NODE_ENV === 'test') {
        return res.json({ country: 'TestCountry' });
    }

    try {
        const ipifyResponse = await fetchWithTimeoutAndRetry('https://api64.ipify.org?format=json', { timeout: 4000, retries: 1, name: 'ipify' });
        const { ip: publicIp } = await ipifyResponse.json();
        const geoResponse = await fetchWithTimeoutAndRetry(`http://ip-api.com/json/${publicIp}`, { timeout: 4000, retries: 1, name: 'ip-api.com' });
        const geo = await geoResponse.json();
        return res.json(geo);
    } catch (error) {
        return res.status(500).json({ error: 'Error fetching geolocation', details: error && error.message ? error.message : String(error) });
    }
});

// Mew endpoints (legacy + v2)
router.get('/mew', mewController.index);
router.get('/mews', mewController.getAllMews);
router.post('/mews', [body('name').trim().escape(), body('content').trim().escape()], mewController.createMew);
router.get('/v2/mews', mewController.getMewsV2);
router.post('/v2/mews', [body('name').trim().escape(), body('content').trim().escape()], mewController.createMew);

// Scoped generic CRUD for specific collections (replaces the dangerous catch-all)
const alarmsController = genericController('alarms');
router.route('/alarms')
    .get((req, res, next) => alarmsController.getAll(req, res, next))
    .post((req, res, next) => alarmsController.create(req, res, next));

const checkinsController = genericController('checkins');
router.route('/checkins')
    .get((req, res, next) => checkinsController.getAll(req, res, next))
    .post((req, res, next) => checkinsController.create(req, res, next));

// Logs (used by tooling/tests)
router.get('/logs/user', logController.getUserLogs);
router.post('/logs/user', [body('*').escape()], logController.createUserLog);
router.get('/logs/server', logController.getServerLogs);
router.post('/logs/server', [body('*').escape()], logController.createServerLog);

// Dashboard v2 log endpoints
router.get('/v2/logs', logController.getLogsForSource);
router.get('/v2/logs/countries', logController.getCountryCounts);

// Storage scan routes (protected - editor/admin only, accepts API key or session)
router.get('/storage/scans', requireEitherAuth, storageController.listScans);
router.post('/storage/scan', requireEitherAuth, storageController.scan);
router.get('/storage/status/:scan_id', requireEitherAuth, storageController.getStatus);
router.post('/storage/stop/:scan_id', requireEitherAuth, storageController.stopScan);
router.get('/storage/directory-count', requireEitherAuth, storageController.getDirectoryCount);

// n8n batch operations for scans (used by N2.1 workflow)
router.post('/storage/scan/:scan_id/batch', requireEitherAuth, storageController.insertBatch);
router.patch('/storage/scan/:scan_id', requireEitherAuth, storageController.updateScan);
router.get('/storage/scan/:scan_id', requireEitherAuth, storageController.getStatus); // Alias for status

// n8n Integration routes for Storage Tool
router.get('/storage/n8n/status', requireEitherAuth, storageController.getN8nStatus);
router.post('/storage/n8n/test', requireEitherAuth, storageController.testN8nWebhook);

// Storage summary for SBQC Ops Agent
router.get('/storage/summary', requireEitherAuth, async (req, res, next) => {
    try {
        const db = req.app.locals.dbs.mainDb;
        const files = db.collection('nas_files');
        const scans = db.collection('nas_scans');
        
        const [fileStats, lastScan, duplicateCount] = await Promise.all([
            files.aggregate([
                {
                    $group: {
                        _id: null,
                        totalFiles: { $sum: 1 },
                        totalSize: { $sum: '$size' },
                        hashedFiles: { $sum: { $cond: [{ $ifNull: ['$sha256', false] }, 1, 0] } }
                    }
                }
            ]).toArray(),
            scans.findOne({}, { sort: { started_at: -1 } }),
            files.aggregate([
                { $match: { sha256: { $exists: true, $ne: null } } },
                { $group: { _id: '$sha256', count: { $sum: 1 }, size: { $first: '$size' } } },
                { $match: { count: { $gt: 1 } } },
                { $group: { _id: null, groups: { $sum: 1 }, wasted: { $sum: { $multiply: ['$size', { $subtract: ['$count', 1] }] } } } }
            ]).toArray()
        ]);
        
        const stats = fileStats[0] || { totalFiles: 0, totalSize: 0, hashedFiles: 0 };
        const dupes = duplicateCount[0] || { groups: 0, wasted: 0 };
        
        const formatBytes = (bytes) => {
            if (bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        };
        
        res.json({
            status: 'success',
            data: {
                totalFiles: stats.totalFiles,
                totalSize: stats.totalSize,
                totalSizeFormatted: formatBytes(stats.totalSize),
                hashedFiles: stats.hashedFiles,
                lastScan: lastScan ? {
                    id: lastScan._id,
                    status: lastScan.status,
                    started_at: lastScan.started_at,
                    finished_at: lastScan.finished_at,
                    counts: lastScan.counts
                } : null,
                duplicates: {
                    groups: dupes.groups,
                    potentialSavings: dupes.wasted,
                    potentialSavingsFormatted: formatBytes(dupes.wasted)
                }
            }
        });
    } catch (error) {
        next(error);
    }
});

// System health aggregation for SBQC Ops Agent
router.get('/system/health', requireEitherAuth, async (req, res, next) => {
    try {
        const results = {
            dataapi: { status: 'ok', timestamp: new Date().toISOString() },
            mongodb: { status: 'unknown' },
            ollama_ugfrank: { status: 'unknown', host: '192.168.2.99:11434' },
            ollama_ugbrutal: { status: 'unknown', host: '192.168.2.12:11434' }
        };
        
        // Check MongoDB
        try {
            await req.app.locals.dbs.mainDb.command({ ping: 1 });
            results.mongodb = { status: 'connected' };
        } catch (e) {
            results.mongodb = { status: 'error', message: e.message };
        }
        
        // Check Ollama hosts with timeout
        const checkOllama = async (host) => {
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 3000);
                const response = await fetch(`http://${host}/api/tags`, { signal: controller.signal });
                clearTimeout(timeout);
                if (response.ok) {
                    const data = await response.json();
                    return { status: 'ok', models: data.models?.length || 0 };
                }
                return { status: 'error', message: `HTTP ${response.status}` };
            } catch (e) {
                return { status: 'unreachable', message: e.message };
            }
        };
        
        const [ugfrank, ugbrutal] = await Promise.all([
            checkOllama('192.168.2.99:11434'),
            checkOllama('192.168.2.12:11434')
        ]);
        
        results.ollama_ugfrank = { ...results.ollama_ugfrank, ...ugfrank };
        results.ollama_ugbrutal = { ...results.ollama_ugbrutal, ...ugbrutal };
        
        // Overall status
        const allOk = results.mongodb.status === 'connected' && 
                      (results.ollama_ugfrank.status === 'ok' || results.ollama_ugbrutal.status === 'ok');
        
        res.json({
            status: 'success',
            data: {
                overall: allOk ? 'healthy' : 'degraded',
                services: results
            }
        });
    } catch (error) {
        next(error);
    }
});

// File browser routes (protected - user/editor/admin, accepts API key or session)
router.get('/files/browse', requireEitherAuth, fileBrowserController.browseFiles);
router.patch('/files/:id', requireEitherAuth, fileBrowserController.updateFile);
// router.get('/files/search', fileBrowserController.search); // Consolidating, 'browseFiles' supports search
router.get('/files/stats', requireEitherAuth, fileBrowserController.getStats);
router.get('/files/tree', requireEitherAuth, fileBrowserController.getDirectoryTree);
router.get('/files/duplicates', requireEitherAuth, fileBrowserController.findDuplicates);
router.get('/files/cleanup-recommendations', requireEitherAuth, fileBrowserController.getCleanupRecommendations);

// Datalake Janitor endpoints (for deduplication workflows)
router.post('/janitor/suggest-deletions', requireEitherAuth, fileBrowserController.suggestDeletions);
router.post('/janitor/mark-for-deletion', requireEitherAuth, fileBrowserController.markForDeletion);
router.get('/janitor/pending-deletions', requireEitherAuth, fileBrowserController.getPendingDeletions);
router.delete('/janitor/confirm-deletion/:id', requireEitherAuth, fileBrowserController.confirmDeletion);

// RAG-ready file metadata endpoints (for embedding and semantic search)
router.get('/rag/file-metadata', requireEitherAuth, async (req, res) => {
  try {
    const db = req.app.locals.dbs.mainDb;
    const files = db.collection('nas_files');
    
    const { limit = 100, skip = 0, extensions } = req.query;
    
    const filter = {};
    if (extensions) {
      const extArray = extensions.split(',').map(e => e.trim().toLowerCase());
      filter.ext = { $in: extArray };
    }
    
    const results = await files
      .find(filter)
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .project({
        _id: 1,
        path: { $concat: ['$dirname', '$filename'] },
        filename: 1,
        dirname: 1,
        ext: 1,
        size: 1,
        mtime: 1,
        sha256: 1
      })
      .toArray();
    
    // Format for RAG embedding
    const embeddingReady = results.map(file => ({
      id: file._id.toString(),
      path: file.path,
      filename: file.filename,
      directory: file.dirname,
      extension: file.ext,
      size: file.size,
      modified: new Date(file.mtime * 1000).toISOString(),
      hash: file.sha256 || null,
      // Construct text representation for embedding
      text: `File: ${file.filename} (${file.ext}) in ${file.dirname}. Size: ${file.size} bytes. Modified: ${new Date(file.mtime * 1000).toISOString()}`
    }));
    
    res.json({
      status: 'success',
      data: {
        files: embeddingReady,
        count: embeddingReady.length,
        hasMore: embeddingReady.length === parseInt(limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

router.post('/rag/file-metadata/batch', requireEitherAuth, async (req, res) => {
  try {
    const db = req.app.locals.dbs.mainDb;
    const files = db.collection('nas_files');
    
    const { file_ids } = req.body;
    
    if (!Array.isArray(file_ids)) {
      return res.status(400).json({
        status: 'error',
        message: 'file_ids must be an array of ObjectIds'
      });
    }
    
    const { ObjectId } = require('mongodb');
    const objectIds = file_ids.map(id => {
      try {
        return new ObjectId(id);
      } catch (e) {
        return null;
      }
    }).filter(id => id !== null);
    
    const results = await files
      .find({ _id: { $in: objectIds } })
      .project({
        _id: 1,
        path: { $concat: ['$dirname', '$filename'] },
        filename: 1,
        dirname: 1,
        ext: 1,
        size: 1,
        mtime: 1,
        sha256: 1
      })
      .toArray();
    
    const embeddingReady = results.map(file => ({
      id: file._id.toString(),
      path: file.path,
      filename: file.filename,
      directory: file.dirname,
      extension: file.ext,
      size: file.size,
      modified: new Date(file.mtime * 1000).toISOString(),
      hash: file.sha256 || null,
      text: `File: ${file.filename} (${file.ext}) in ${file.dirname}. Size: ${file.size} bytes. Modified: ${new Date(file.mtime * 1000).toISOString()}`
    }));
    
    res.json({
      status: 'success',
      data: {
        files: embeddingReady,
        requested: file_ids.length,
        found: embeddingReady.length
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// File exports (protected - editor/admin only, accepts API key or session)
router.post('/files/export', requireEitherAuth, fileExportController.generateReport);
router.get('/files/exports', requireEitherAuth, fileExportController.listExports);
router.delete('/files/exports/:filename', requireEitherAuth, fileExportController.deleteExport);

// Optimized exports (fixes 20MB issue) - protected
router.get('/files/export-optimized/:type', requireAuth, requireRole('editor', 'admin'), async (req, res) => {
    try {
        const { type } = req.params;
        const validTypes = ['full', 'summary', 'media', 'stats'];

        if (!validTypes.includes(type)) {
            return res.status(400).json({
                status: 'error',
                message: `Invalid report type. Must be one of: ${validTypes.join(', ')}`
            });
        }

        const startTime = Date.now();
        const report = await generateOptimizedReport(req.app.locals.dbs.mainDb, type);
        const generationTime = Date.now() - startTime;

        report.metadata = {
            generationTimeMs: generationTime,
            optimized: true,
            timestamp: new Date().toISOString()
        };

        res.json({
            status: 'success',
            message: `Optimized ${type} report generated successfully`,
            data: report
        });
    } catch (error) {
        console.error('Optimized export error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to generate optimized report',
            error: error.message
        });
    }
});

// Live data
router.get('/iss', liveDatasController.iss);
router.get('/quakes', liveDatasController.quakes);

// SSE feed (tool stream)
router.get('/feed/events', feedController.sendFeedEvents);
// Protected private feed (requires authentication) for user/device logs
router.get('/feed/events/private', requireAuth, feedController.sendPrivateFeedEvents);

// Secure token endpoint for ChatKit admin chat
router.post('/chatkit/token', requireAuth, chatkitController.createSessionToken);
// Send message to ChatKit session
router.post('/chatkit/message', requireAuth, chatkitController.sendChatMessage);
// Create realtime voice session for admin chat
router.post('/chatkit/realtime-session', requireAuth, chatkitController.createRealtimeSession);

// Database management routes (admin only)
router.post('/databases/copy-prod-to-dev', requireAuth, requireRole('admin'), databasesController.copyProdToDev);

// Server-Sent Events endpoint for copy progress
router.get('/databases/copy-progress/:jobId', (req, res) => {
    const { jobId } = req.params;
    const { get } = require('../utils/progressBus');
    const emitter = get(jobId);
    if (!emitter) {
        return res.status(404).json({ status: 'error', message: 'Job not found' });
    }

    // set SSE headers
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive'
    });

    const onProgress = (data) => {
        res.write(`event: progress\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const onComplete = (data) => {
        res.write(`event: complete\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const onError = (data) => {
        res.write(`event: error\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    emitter.on('progress', onProgress);
    emitter.on('complete', onComplete);
    emitter.on('error', onError);

    // cleanup when client disconnects
    req.on('close', () => {
        emitter.off('progress', onProgress);
        emitter.off('complete', onComplete);
        emitter.off('error', onError);
    });
});

router.post('/weather/register-location', [
    requireAuth,
    body('lat').optional().isFloat({ min: -90, max: 90 }).withMessage('Latitude must be between -90 and 90'),
    body('lon').optional().isFloat({ min: -180, max: 180 }).withMessage('Longitude must be between -180 and 180')
], weatherController.registerLocation);

// LiveData Configuration
router.get('/livedata/config', requireAuth, liveDataConfigController.getConfigs);
router.post('/livedata/config', requireAuth, liveDataConfigController.updateConfig);

// Ollama routes
router.get('/ollama/models', requireAuth, ollamaController.listModels);
router.post('/ollama/chat', requireAuth, ollamaController.chat);

// External API / live-data helpers
router.get('/weather', externalApiController.getWeather);
router.get('/tides', externalApiController.getTides);
router.get('/tle', externalApiController.getTle);
router.get('/pressure', externalApiController.getPressure);
router.get('/ec-weather', externalApiController.getEcWeather);

// Expose collection stats (cached at boot)
router.get('/stats', (req, res) => {
    const stats = req.app.locals.collectionInfo || [];
    res.json({
        status: 'success',
        data: stats
    });
});

// Legacy endpoint support for databases.html
router.get('/databases/stats', (req, res) => {
    const stats = req.app.locals.collectionInfo || [];
    const collections = stats.map(s => ({ name: s.collection, count: s.count, db: s.db }));
    res.json({
        status: 'success',
        data: {
            collections: collections
        }
    });
});

// Generic collection query endpoint - allows fetching items from specific allowed collections
router.get('/collection/:name/items', async (req, res, next) => {
    try {
        const { name } = req.params;
        const db = req.app.locals.dbs?.mainDb;

        if (!db) {
            return res.status(500).json({
                status: 'error',
                message: 'Database connection not found'
            });
        }
        
        // Explicit allowed list of public collections
        const allowedList = ['nas_files', 'mews', 'userLogs', 'serverLogs', 'checkins', 'alarms', 'weatherLocations', 'pressures', 'isses', 'quakes', 'appevents'];

        if (!allowedList.includes(name)) {
             return res.status(403).json({
                status: 'error',
                message: `Access to collection '${name}' is restricted`
            });
        }

        // Validate collection name exists in collectionInfo
        const allowedCollections = req.app.locals.collectionInfo || [];
        const collectionExists = allowedCollections.some(c =>
            (c.collection === name || c.name === name)
        );

        if (!collectionExists) {
            return res.status(404).json({
                status: 'error',
                message: `Collection '${name}' not found`
            });
        }

        const collection = db.collection(name);

        // Parse pagination parameters
        let { skip = 0, limit = 50, sort = 'desc' } = req.query;
        skip = parseInt(skip) || 0;
        limit = parseInt(limit) || 50;
        skip = skip < 0 ? 0 : skip;
        limit = Math.min(500, Math.max(1, limit)); // Clamp limit between 1 and 500

        const sortBy = sort === 'desc' ? -1 : 1;

        // Execute query with pagination
        const [total, documents] = await Promise.all([
            collection.countDocuments(),
            collection.find({}).skip(skip).limit(limit).sort({ _id: sortBy }).toArray()
        ]);

        res.json({
            status: 'success',
            message: 'Documents retrieved successfully',
            data: documents,
            meta: {
                total,
                skip,
                limit,
                sort,
                has_more: total - (skip + limit) > 0
            }
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
