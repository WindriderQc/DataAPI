# n8n Workflows Requirements for SBQC Stack

**Last Updated:** December 26, 2025  
**n8n Instance:** https://n8n.specialblend.icu (192.168.2.199:5678)

---

## Overview

This document specifies n8n workflows needed to complete Priority 1 (SBQC Ops Agent) and Priority 2 (Datalake Janitor) implementation. DataAPI now provides all backend endpoints - n8n orchestrates the automation layer.

---

## Prerequisites

### Credentials Setup in n8n

**DataAPI Header Auth:**
- Type: Header Auth
- Name: `DataAPI-Key`
- Header Name: `x-api-key`
- Header Value: `<YOUR_API_KEY>`

**AgentX Header Auth:**
- Type: Header Auth  
- Name: `AgentX-Key`
- Header Name: `x-api-key`
- Header Value: `<YOUR_API_KEY>`

---

## Priority 1: System Health Monitoring

### Workflow: System Health Check (Every 5 Minutes)

**Purpose:** Monitor DataAPI, AgentX, MongoDB, and Ollama hosts. Alert SBQC Ops agent on failures.

**Trigger:** Schedule (cron: `*/5 * * * *`)

**Nodes:**

1. **Schedule Trigger**
   - Interval: Every 5 minutes

2. **HTTP Request: DataAPI System Health**
   - Method: `GET`
   - URL: `http://192.168.2.33:3003/api/v1/system/health`
   - Authentication: Header Auth (DataAPI-Key)
   - Continue On Fail: Yes
   - Expected Response:
     ```json
     {
       "status": "success",
       "data": {
         "dataapi": {"status": "ok"},
         "mongodb": {"status": "connected"},
         "ollama_99": {"status": "ok", "models": 4},
         "ollama_12": {"status": "ok", "models": 4},
         "overall": "healthy"
       }
     }
     ```

3. **HTTP Request: AgentX Health**
   - Method: `GET`
   - URL: `http://192.168.2.33:3080/api/n8n/health`
   - Authentication: Header Auth (AgentX-Key)
   - Continue On Fail: Yes

4. **Code Node: Aggregate Results**
   ```javascript
   const dataapi = $('DataAPI System Health').first()?.json?.data || {};
   const agentx = $('AgentX Health').first()?.json || {};
   
   const results = {
     timestamp: new Date().toISOString(),
     dataapi: dataapi.overall || 'error',
     mongodb: dataapi.mongodb?.status || 'error',
     ollama_99: dataapi.ollama_99?.status || 'error',
     ollama_12: dataapi.ollama_12?.status || 'error',
     agentx: agentx.status || 'error'
   };
   
   results.overall_healthy = Object.values(results).every(v => 
     v === 'ok' || v === 'connected' || v === 'healthy' || typeof v === 'string' && v.includes('T')
   );
   
   return [{ json: results }];
   ```

5. **IF Node: Check Health**
   - Condition: `{{ $json.overall_healthy }}` equals `false`

6. **HTTP Request: Log Alert to DataAPI** (if unhealthy)
   - Method: `POST`
   - URL: `http://192.168.2.33:3003/integrations/events/n8n`
   - Body:
     ```json
     {
       "workflow_id": "health_check",
       "event_type": "system_alert",
       "severity": "warning",
       "data": "{{ $json }}"
     }
     ```

7. **Email/Slack Alert** (optional, if unhealthy)
   - Configure based on your notification preference

---

## Priority 2: Datalake Janitor Workflows

### Workflow: File Scanner with SHA256 Hashing (Daily)

**Purpose:** Scan NAS directories, compute SHA256 hashes for deduplication.

**Trigger:** Schedule (cron: `0 2 * * *` - Daily at 2 AM)

**Nodes:**

1. **Schedule Trigger**
   - Cron: `0 2 * * *`

2. **HTTP Request: Start Scan**
   - Method: `POST`
   - URL: `http://192.168.2.33:3003/api/v1/storage/scan`
   - Authentication: Header Auth (DataAPI-Key)
   - Body:
     ```json
     {
       "roots": ["/mnt/nas/media", "/mnt/nas/documents"],
       "extensions": ["mp4", "mkv", "avi", "mov", "pdf", "docx"],
       "compute_hashes": true,
       "hash_max_size": 1073741824
     }
     ```
   - Expected Response:
     ```json
     {
       "status": "success",
       "data": {
         "scan_id": "...",
         "status": "running"
       }
     }
     ```

3. **Wait Node**
   - Wait: 5 seconds

4. **HTTP Request: Poll Scan Status**
   - Method: `GET`
   - URL: `http://192.168.2.33:3003/api/v1/storage/status/{{ $('Start Scan').first().json.data.scan_id }}`
   - Authentication: Header Auth (DataAPI-Key)
   - Loop Until: `status` equals `"complete"`
   - Max Iterations: 120 (10 minutes)

5. **HTTP Request: Log Completion Event**
   - Method: `POST`
   - URL: `http://192.168.2.33:3003/integrations/events/n8n`
   - Body:
     ```json
     {
       "workflow_id": "file_scanner",
       "event_type": "scan_complete",
       "data": "{{ $json }}"
     }
     ```

---

### Workflow: Duplicate Detection & Cleanup Suggestions

**Purpose:** Find duplicates by SHA256 hash, suggest deletions, send to RAG for embedding.

**Trigger:** Webhook OR Manual

**Nodes:**

1. **Webhook/Manual Trigger**

2. **HTTP Request: Find Duplicates**
   - Method: `GET`
   - URL: `http://192.168.2.33:3003/api/v1/files/duplicates?minGroupSize=2`
   - Authentication: Header Auth (DataAPI-Key)
   - Expected Response:
     ```json
     {
       "status": "success",
       "data": {
         "hash_groups": [...],
         "fallback_groups": [...]
       }
     }
     ```

3. **Code Node: Format for Janitor**
   ```javascript
   const duplicates = $json.data.hash_groups || [];
   
   return duplicates.map(group => ({
     json: {
       hash: group.hash,
       size: group.size,
       count: group.count,
       total_waste: group.totalSize,
       files: group.files,
       suggestion: 'Keep newest, delete others'
     }
   }));
   ```

4. **HTTP Request: Suggest Deletions**
   - Method: `POST`
   - URL: `http://192.168.2.33:3003/api/v1/janitor/suggest`
   - Authentication: Header Auth (DataAPI-Key)
   - Body:
     ```json
     {
       "path": "/mnt/nas/media",
       "policies": ["delete_duplicates"]
     }
     ```
   - Expected Response:
     ```json
     {
       "suggestions_count": 10,
       "total_space_saved": 1073741824,
       "suggestions": [
         {
           "policy": "delete_duplicates",
           "action": "delete",
           "files": ["/path/to/duplicate.mp4"],
           "reason": "Duplicate of /path/to/original.mp4",
           "space_saved": 104857600
         }
       ]
     }
     ```

5. **HTTP Request: Get File Metadata for RAG** (optional - for embedding)
   - Method: `GET`
   - URL: `http://192.168.2.33:3003/api/v1/rag/file-metadata?limit=1000&extensions=mp4,mkv,pdf`
   - Authentication: Header Auth (DataAPI-Key)
   - Expected Response:
     ```json
     {
       "status": "success",
       "data": {
         "files": [
           {
             "id": "...",
             "path": "/path/to/file.mp4",
             "text": "File: file.mp4 (mp4) in /path/to/. Size: 1024 bytes..."
           }
         ]
       }
     }
     ```

6. **HTTP Request: Send to AgentX for RAG Embedding** (optional)
   - Method: `POST`
   - URL: `http://192.168.2.33:3080/api/n8n/rag/ingest`
   - Authentication: Header Auth (AgentX-Key)
   - Body:
     ```json
     {
       "documents": "{{ $json.data.files }}",
       "collection": "nas_files"
     }
     ```

---

### Workflow: Execute Cleanup

**Purpose:** Execute file deletions from Janitor suggestions (with dry_run safety).

**Trigger:** Manual OR Webhook from admin UI

**Nodes:**

1. **Code Node: Collect Files to Delete**
   - Collect file paths from previous suggestion workflow
   - Filter based on human approval if needed

2. **HTTP Request: Execute Dry Run**
   - Method: `POST`
   - URL: `http://192.168.2.33:3003/api/v1/janitor/execute`
   - Authentication: Header Auth (DataAPI-Key)
   - Body:
     ```json
     {
       "files": ["{{ $json.files }}"],
       "dry_run": true
     }
     ```
   - Review response to verify what would be deleted

3. **Manual Approval Node** (requires human review)
   - Present list of files that would be deleted
   - Approve/Reject

4. **HTTP Request: Execute Deletion** (if approved)
   - Method: `POST`
   - URL: `http://192.168.2.33:3003/api/v1/janitor/execute`
   - Authentication: Header Auth (DataAPI-Key)
   - Body:
     ```json
     {
       "files": ["{{ $json.files }}"],
       "dry_run": false
     }
     ```

5. **HTTP Request: Log Deletion Event**
   - Method: `POST`
   - URL: `http://192.168.2.33:3003/integrations/events/n8n`
   - Body:
     ```json
     {
       "workflow_id": "janitor_cleanup",
       "event_type": "files_deleted",
       "data": "{{ $json }}"
     }
     ```

---

## Priority 3: RAG Embedding Automation

### Workflow: Batch Embed File Metadata

**Purpose:** Periodically embed file metadata into AgentX RAG for semantic search.

**Trigger:** Schedule (Weekly) OR Manual

**Nodes:**

1. **Schedule/Manual Trigger**

2. **HTTP Request: Get Storage Summary**
   - Method: `GET`
   - URL: `http://192.168.2.33:3003/api/v1/storage/summary`
   - Authentication: Header Auth (DataAPI-Key)

3. **Loop:** For each file extension with high counts

4. **HTTP Request: Get File Metadata**
   - Method: `GET`
   - URL: `http://192.168.2.33:3003/api/v1/rag/file-metadata?extensions={{ $json.ext }}&limit=500&skip={{ $json.offset }}`
   - Authentication: Header Auth (DataAPI-Key)

5. **HTTP Request: Batch Embed to AgentX**
   - Method: `POST`
   - URL: `http://192.168.2.33:3080/api/rag/ingest/batch`
   - Authentication: Header Auth (AgentX-Key)
   - Body:
     ```json
     {
       "documents": "{{ $json.data.files }}",
       "collection": "datalake_files",
       "embed_field": "text"
     }
     ```

---

## Testing Workflows

### Test Health Check

```bash
# Manually trigger the workflow, or wait 5 minutes
# Check DataAPI event log:
curl -H "x-api-key: KEY" http://192.168.2.33:3003/api/v1/events?type=system_alert
```

### Test File Scanner

```bash
# Manually trigger scan workflow
# Verify scan record:
curl -H "x-api-key: KEY" http://192.168.2.33:3003/api/v1/storage/scans
```

### Test Duplicate Detection

```bash
# Trigger duplicate workflow
# Check pending deletions:
curl -H "x-api-key: KEY" http://192.168.2.33:3003/api/v1/janitor/pending-deletions
```

---

## Workflow Dependencies

| Workflow | Requires | Frequency |
|----------|----------|-----------|
| System Health Check | DataAPI `/system/health`, AgentX `/n8n/health` | Every 5 min |
| File Scanner | DataAPI `/storage/scan`, SMB mounts on n8n host | Daily |
| Duplicate Detection | Scanner results with SHA256 hashes | Weekly |
| Manual Deletion | Pending deletions from Janitor | On-demand |
| RAG Embedding | DataAPI `/rag/file-metadata`, AgentX RAG API | Weekly |

---

## Next Steps

1. **Configure SMB mounts** on n8n host (192.168.2.199) for NAS access
2. **Create credentials** in n8n for DataAPI and AgentX
3. **Build workflows** using the specifications above
4. **Test each workflow** individually before scheduling
5. **Monitor events** via DataAPI `/integrations/events/n8n` endpoint

---

## Related Documentation

- [DataAPI README](../README.md) - All endpoints documented
- [SBQC Stack Architecture](../../SBQC-Stack-Final/01-ARCHITECTURE.md)
- [DataAPI Tasks](../../SBQC-Stack-Final/02-DATAAPI-TASKS.md)
- [n8n Workflows Spec](../../SBQC-Stack-Final/04-N8N-WORKFLOWS.md)
