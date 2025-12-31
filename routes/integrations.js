const { Router } = require("express");
const { apiKey, hmacVerify } = require("../middleware/integrationsAuth");

/**
 * Normalizes incoming data to ensure it's always an object, not a string.
 * Handles legacy workflows that stringify JSON and new workflows that send native objects.
 * 
 * @param {any} data - The incoming data field
 * @returns {object} Normalized object suitable for MongoDB querying
 */
function normalizeData(data) {
  // Already an object - use as-is
  if (typeof data === 'object' && data !== null) {
    return data;
  }
  
  // String that looks like JSON - parse it
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch (err) {
      // Not valid JSON - wrap it
      return { raw: data };
    }
  }
  
  // Primitive or null - wrap it
  return { value: data };
}

function createIntegrationsRouter(db) {
  const r = Router();

  // NOTE: n8n integration has been moved to AgentX.
  // DataAPI now focuses on data management and APIs.
  // If you need to trigger n8n workflows, call AgentX's /api/n8n/trigger endpoints.
  
  // generic inbox: n8n can POST anything here (for logging / quick glue)
  // This endpoint allows n8n to send events to DataAPI for logging purposes only
  r.post("/events/n8n", async (req, res) => {
    // Normalize the body.data field if it exists (supports both legacy and new workflows)
    const normalizedBody = { ...req.body };
    if (normalizedBody.data !== undefined) {
      normalizedBody.data = normalizeData(normalizedBody.data);
    }
    
    const doc = { src: "n8n", at: new Date(), body: normalizedBody };
    await db.collection("integration_events").insertOne(doc);
    res.json({ ok: true, id: doc._id });
  });

  // GET endpoint to retrieve n8n events (for admin dashboard)
  r.get("/events/n8n", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 100;
      const events = await db.collection("integration_events")
        .find({ src: "n8n" })
        .sort({ at: -1 })
        .limit(limit)
        .toArray();
      res.json(events);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // webhook sink for ClickUp
  r.post("/webhooks/clickup", async (req, res) => {
    await db.collection("integration_events").insertOne({ src: "clickup", at: new Date(), body: req.body });
    // optional: push to a queue, or ping n8n via webhook
    res.json({ ok: true });
  });

  // later: /agents/email/actions:extract and /search/files, etc.
  return r;
}

module.exports = createIntegrationsRouter;
