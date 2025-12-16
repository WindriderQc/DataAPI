const { Router } = require("express");
const { apiKey, hmacVerify } = require("../middleware/integrationsAuth");
const { triggers } = require("../utils/n8nWebhook");

function createIntegrationsRouter(db) {
  const r = Router();

  // Server-side n8n dispatch for trusted tool clients (e.g., AgentX).
  // Protected by DATAAPI_API_KEY via `requireToolKey` at the mount point in `data_serv.js`.
  // This avoids exposing n8n secrets to any browser/client code.
  r.post('/n8n/trigger', async (req, res) => {
    const { eventName, data } = req.body || {};

    if (!eventName || typeof eventName !== 'string') {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required field: eventName'
      });
    }

    const result = await triggers.event(eventName, data || {});
    return res.json({
      status: 'success',
      message: 'n8n trigger dispatched',
      data: result
    });
  });

  // generic inbox: n8n can POST anything here (for logging / quick glue)
  // Removed hmacVerify to simplify n8n integration
  // Removed apiKey middleware as this route is already protected by requireToolKey at the router level
  r.post("/events/n8n", async (req, res) => {
    const doc = { src: "n8n", at: new Date(), body: req.body };
    await db.collection("integration_events").insertOne(doc);
    res.json({ ok: true, id: doc._id });
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
