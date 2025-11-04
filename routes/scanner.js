const express = require('express');
const { ObjectId } = require('mongodb');
const { Scanner } = require('../src/jobs/scanner/scan');

function parseList(s) { return (s || '').split(',').map(x => x.trim()).filter(Boolean); }

const running = new Map();

module.exports = (db) => {
  const r = express.Router();

  // simple API-key gate
  r.use((req, res, next) => {
    if (!process.env.INTEGRATIONS_API_KEY) return next();
    const k = req.get('x-api-key');
    if (k !== process.env.INTEGRATIONS_API_KEY) return res.status(401).json({ error: 'unauthorized' });
    next();
  });

  r.post('/start', async (req, res) => {
    const roots = req.body.roots || parseList(process.env.SCANNER_DEFAULT_ROOTS);
    if (!roots || !roots.length) return res.status(400).json({ error: 'no roots' });

    const includeExt = req.body.includeExt || parseList(process.env.SCANNER_INCLUDE_EXT);
    const batchSize = Number(req.body.batchSize || process.env.SCANNER_BATCH_SIZE || 1000);
    const scanId = new ObjectId().toHexString();

    const scanner = new Scanner(db);
    running.set(scanId, scanner);
    scanner.on('done', () => running.delete(scanId));

    scanner.run({ roots, includeExt, batchSize, scanId });
    res.json({ ok: true, scan_id: scanId, roots, includeExt, batchSize });
  });

  r.get('/status/:id', async (req, res) => {
    const doc = await db.collection('nas_scans').findOne({ _id: req.params.id });
    if (!doc) return res.status(404).json({ error: 'not found' });
    res.json({ ...doc, live: running.has(req.params.id) });
  });

  r.post('/stop/:id', (req, res) => {
    const sc = running.get(req.params.id);
    if (!sc) return res.json({ ok: false, message: 'not running' });
    sc.stop();
    res.json({ ok: true, message: 'stop requested' });
  });

  return r;
};