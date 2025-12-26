# Archived n8n Documentation

**Archived:** December 26, 2025  
**Reason:** n8n integration endpoints have been migrated to AgentX

---

## Why These Files Were Archived

These documents reference `/api/v1/n8n/*` endpoints that were **removed from DataAPI** and migrated to **AgentX** (port 3080).

### Current Architecture

| Feature | Old Location (DataAPI:3003) | New Location (AgentX:3080) |
|---------|----------------------------|---------------------------|
| n8n health check | `/api/v1/n8n/health` ❌ | `/api/n8n/health` ✅ |
| n8n diagnostic | `/api/v1/n8n/diagnostic` ❌ | `/api/n8n/diagnostic` ✅ |
| Trigger webhooks | `/api/v1/n8n/trigger/:id` ❌ | `/api/n8n/trigger/:webhookId` ✅ |
| RAG ingest trigger | N/A | `/api/n8n/rag/ingest` ✅ |
| Chat complete trigger | N/A | `/api/n8n/chat/complete` ✅ |
| Analytics trigger | N/A | `/api/n8n/analytics` ✅ |

### What DataAPI Still Provides

DataAPI (port 3003) continues to provide:

- `/health` - Basic health check
- `/api/v1/storage/*` - Storage scanning endpoints
- `/api/v1/files/*` - File browsing endpoints
- `/integrations/events/n8n` - Event sink (receives POSTs **from** n8n for logging)

### For n8n Workflow Development

If you're building n8n workflows that need to trigger AI operations, use **AgentX** endpoints:

```
Base URL: http://192.168.2.33:3080
Authentication: Header Auth with x-api-key

POST /api/n8n/rag/ingest     - Trigger RAG document ingestion
POST /api/n8n/chat/complete  - Trigger chat completion
POST /api/n8n/analytics      - Trigger analytics event
POST /api/n8n/trigger/:id    - Generic webhook trigger
POST /api/n8n/event/:type    - Event trigger
```

---

## Archived Files

| File | Description |
|------|-------------|
| `N8N_INTEGRATION.md` | Original n8n integration guide |
| `N8N_QUICKSTART.md` | Quick start for n8n setup |
| `N8N_WEBHOOK_INTEGRATION.md` | Webhook configuration details |
| `N8N_NODE_SETUP.md` | n8n node configuration |
| `N8N_IMPLEMENTATION_SUMMARY.md` | Implementation summary |
| `SBQC.json` | n8n workflow export (outdated endpoints) |
| `Ollama.14b.Chatbot.json` | n8n workflow export (outdated endpoints) |

⚠️ **Note:** The JSON workflow exports contain hardcoded API keys and reference 
deprecated `/api/v1/n8n/*` endpoints. They should NOT be used without significant updates.

These files are preserved for historical reference only.
