const fs = require('fs/promises');
const path = require('path');
const EventEmitter = require('events');

class Scanner extends EventEmitter {
  constructor(db) {
    super();
    this.db = db;
    this.stopFlag = false;
  }
  stop() { this.stopFlag = true; }

  async run(opts) {
    const filesCol = this.db.collection('nas_files');
    const scansCol = this.db.collection('nas_scans');

    const start = new Date();
    const includeExt = new Set((opts.includeExt || []).map(s => s.toLowerCase()));
    const batchSize = Number(opts.batchSize || 1000);
    let counts = { files_seen: 0, upserts: 0, skipped: 0, errors: 0 };
    let batch = [];

    const updateScan = (patch) =>
      scansCol.updateOne({ _id: opts.scanId }, { $set: patch }, { upsert: true });

    await updateScan({ status: 'running', started_at: start, counts, roots: opts.roots });

    async function flush() {
      if (!batch.length) return;
      try {
        const res = await filesCol.bulkWrite(batch, { ordered: false });
        counts.upserts += (res.upsertedCount || 0) + (res.modifiedCount || 0);
      } catch (e) {
        counts.errors++;
        await updateScan({ counts, last_error: String(e && e.message || e) });
      }
      batch = [];
      await updateScan({ counts });
    }

    const stack = [...opts.roots];
    while (stack.length && !this.stopFlag) {
      const dir = stack.pop();
      let entries;
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch (e) {
        counts.errors++; await updateScan({ counts, last_error: `readdir ${dir}: ${e}` });
        continue;
      }

      for (const ent of entries) {
        if (this.stopFlag) break;
        const p = path.join(dir, ent.name);
        if (ent.isDirectory()) { stack.push(p); continue; }
        if (!ent.isFile()) continue;

        const ext = path.extname(ent.name).slice(1).toLowerCase();
        if (includeExt.size && !includeExt.has(ext)) { counts.skipped++; continue; }

        let st;
        try { st = await fs.stat(p); }
        catch { counts.skipped++; continue; }

        counts.files_seen++;
        const d = {
          path: p,
          dirname: path.dirname(p),
          filename: path.basename(p),
          ext, size: st.size,
          mtime: Math.floor(st.mtimeMs / 1000),
          scan_seen_at: new Date()
        };

        batch.push({
          updateOne: {
            filter: { path: p },
            update: { $set: d, $setOnInsert: { ingested_at: new Date() } },
            upsert: true
          }
        });

        if (batch.length >= batchSize) await flush();
        if (counts.files_seen % 5000 === 0) {
          await updateScan({ counts, last_path: p });
          this.emit('tick', counts);
        }
      }
    }

    await flush();
    const end = new Date();
    const status = this.stopFlag ? 'stopped' : 'complete';
    await updateScan({ status, finished_at: end, counts });
    this.emit('done', { status, counts, started_at: start, finished_at: end });
  }
}

module.exports = { Scanner };