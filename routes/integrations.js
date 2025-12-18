const { Router } = require("express");
const { apiKey, hmacVerify } = require("../middleware/integrationsAuth");

function createIntegrationsRouter(db) {
  const r = Router();

  // NOTE: n8n integration has been moved to AgentX.
  // DataAPI now focuses on data management and APIs.
  // If you need to trigger n8n workflows, call AgentX's /api/n8n/trigger endpoints.
  
  // generic inbox: n8n can POST anything here (for logging / quick glue)
  // This endpoint allows n8n to send events to DataAPI for logging purposes only
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
