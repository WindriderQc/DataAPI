const { Router } = require("express");
const { apiKey, hmacVerify } = require("../middleware/integrationsAuth");

function createIntegrationsRouter(db) {
  const r = Router();

  // generic inbox: n8n can POST anything here (for logging / quick glue)
  r.post("/events/n8n", apiKey, hmacVerify, async (req, res) => {
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
