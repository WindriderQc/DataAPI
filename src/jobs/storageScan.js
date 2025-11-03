const fs = require("node:fs/promises");
const path = require("node:path");

async function storageScan({ roots, extensions, emitEvery = 500, max_concurrency = 64 }, { db, emit, scan_id }) {
  const { default: pLimit } = await import('p-limit');
  const filesCol = db.collection("nas_files");
  const scansCol = db.collection("nas_scans");
  const limit = pLimit(max_concurrency);
  const promises = [];

  const exts = new Set(extensions.map(e => "." + e.toLowerCase()));
  let counts = { files_seen: 0, upserts: 0, errors: 0 };
  const errors = [];

  async function processFile(full) {
    try {
      const st = await fs.stat(full);
      const doc = {
        _id: full, path: full, size: st.size, mtime: st.mtime, ctime: st.ctime,
        ext: path.extname(full).slice(1).toLowerCase(), scan_id, updated_at: new Date()
      };
      await filesCol.updateOne({ _id: doc._id }, { $set: doc }, { upsert: true });
      counts.upserts++;
    } catch (e) {
      counts.errors++;
      errors.push({ path: full, error: e.message });
      console.error(`Failed to process file ${full}:`, e);
    }

    if (counts.files_seen % emitEvery === 0) {
      await emit({
        source: "dataapi",
        type: "storage.scan.progress",
        origin: "storageScan",
        dedupe_key: `storage:scan:progress:${scan_id}:${counts.files_seen}`,
        payload: { scan_id, ...counts }
      });
    }
  }

  async function walk(dir) {
    let list;
    try {
      list = await fs.readdir(dir, { withFileTypes: true });
    } catch (e) {
      counts.errors++;
      errors.push({ path: dir, error: e.message });
      console.error(`Failed to read directory ${dir}:`, e);
      return;
    }
    for (const ent of list) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        await walk(full);
        continue;
      }
      if (!exts.has(path.extname(ent.name).toLowerCase())) continue;

      counts.files_seen++;
      promises.push(limit(() => processFile(full)));
    }
  }

  await scansCol.insertOne({ _id: scan_id, started_at: new Date(), status: "running", counts, errors });
  for (const root of roots) {
    await walk(root);
  }

  await Promise.all(promises);

  await scansCol.updateOne({ _id: scan_id }, { $set: { status: "done", finished_at: new Date(), counts, errors }});
  await emit({
    source: "dataapi",
    type: "storage.scan.done",
    origin: "storageScan",
    dedupe_key: `storage:scan:done:${scan_id}`,
    payload: { scan_id, counts }
  });

  return { scan_id, counts, errors };
}

module.exports = { storageScan };