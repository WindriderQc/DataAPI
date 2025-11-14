# n8n HTTP Request Node Configuration Guide

## Step-by-Step Setup

### 1. Create/Edit HTTP Request Node in n8n

```
┌─────────────────────────────────────────┐
│   HTTP Request Node Configuration      │
├─────────────────────────────────────────┤
│                                         │
│  Method: [GET ▼]                       │
│                                         │
│  URL: http://192.168.2.33:3003/api/v1/n8n/health
│                                         │
│  Authentication: [None ▼]              │
│                                         │
│  ┌──── Headers ────┐                   │
│  │ + Add Option    │                   │
│  │                 │                   │
│  │ Name:  x-api-key                   │
│  │ Value: your-api-key-here           │
│  │                 │                   │
│  └─────────────────┘                   │
│                                         │
│  [Test workflow]                       │
│                                         │
└─────────────────────────────────────────┘
```

### 2. Common Endpoint URLs

**Health Check:**
```
http://192.168.2.33:3003/api/v1/n8n/health
Method: GET
```

**Get Stats:**
```
http://192.168.2.33:3003/api/v1/n8n/stats
Method: GET
```

**Create Scan:**
```
http://192.168.2.33:3003/api/v1/n8n/nas/scan
Method: POST
Body: {
  "roots": ["/mnt/nas/videos"],
  "extensions": ["mp4", "avi"]
}
```

**Query Files:**
```
http://192.168.2.33:3003/api/v1/n8n/nas/files?extension=mp4&limit=100
Method: GET
```

**Bulk Insert Files:**
```
http://192.168.2.33:3003/api/v1/n8n/nas/files
Method: POST
Body: {
  "files": [...],
  "scanId": "scan-id-here"
}
```

### 3. Example Workflow: Health Check

```
┌──────────────┐
│   Schedule   │ Every 5 minutes
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────┐
│   HTTP Request                   │
│   GET /api/v1/n8n/health        │
│   Headers: x-api-key: ***       │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────┐
│   IF Node    │ Check status === 'success'
└──────┬───────┘
       │
   ┌───┴───┐
   │       │
   ▼       ▼
  OK     Error
         │
         ▼
    ┌────────────┐
    │ Send Alert │
    └────────────┘
```

### 4. Example Workflow: File Sync

```
┌──────────────┐
│   Schedule   │ Daily at 2 AM
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────┐
│   HTTP Request                   │
│   POST /api/v1/n8n/nas/scan     │
│   Create scan record            │
└──────┬───────────────────────────┘
       │
       ▼ (capture scanId)
┌──────────────┐
│   Execute    │ Run file scanner
│   Command    │ or FTP sync
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Split      │ Process files in batches
│   in Batches │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────┐
│   HTTP Request                   │
│   POST /api/v1/n8n/nas/files    │
│   Upload batch of files         │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│   HTTP Request                   │
│   PATCH /api/v1/n8n/nas/scan/:id│
│   Update scan status: completed │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────┐
│   Slack      │ Send completion
│   Message    │ notification
└──────────────┘
```

## Header Configuration Details

### In n8n UI:

1. Click on the HTTP Request node
2. Scroll to "Headers" section
3. Click "+ Add Option" or "+ Add Header"
4. Add header:
   - **Name**: `x-api-key` (exactly as shown, case-sensitive)
   - **Value**: Your API key (the 64-character hex string)

### Important Notes:

- ❌ Do NOT use n8n's built-in "Authentication" dropdown
- ✅ DO use the "Headers" section
- ❌ Do NOT add "Bearer " prefix to the key
- ✅ DO paste the key exactly as generated
- ❌ Do NOT use session/cookie auth
- ✅ DO use the `/api/v1/n8n/*` endpoints

## Testing in n8n

### Method 1: Test Workflow Button

1. Configure the HTTP Request node
2. Click "Test workflow" button
3. Check the output panel
4. Look for `status: "success"`

### Method 2: Execute Node

1. Right-click the HTTP Request node
2. Select "Execute Node"
3. View the output in the right panel

### Expected Success Response:

```json
{
  "status": "success",
  "message": "n8n API is healthy",
  "timestamp": "2025-11-08T12:00:00.000Z",
  "source": "n8n"
}
```

### Common Error Responses:

**401 Unauthorized:**
```json
{
  "status": "error",
  "message": "Unauthorized: Invalid or missing API key"
}
```
**Fix:** Check that x-api-key header is present and matches server config

**403 Forbidden:**
```json
{
  "status": "error",
  "message": "Forbidden: LAN access only"
}
```
**Fix:** Verify n8n is on the same network or disable LAN-only mode

**404 Not Found:**
```
Cannot GET /api/v1/n8n/helth
```
**Fix:** Check URL spelling (e.g., "health" not "helth")

## Advanced Configuration

### Using Credentials in n8n

1. Go to **Credentials** in n8n
2. Click **+ New**
3. Select **Header Auth**
4. Set:
   - **Name**: `DataAPI n8n Key`
   - **Header Name**: `x-api-key`
   - **Header Value**: Your API key
5. Save credentials
6. In HTTP Request node, select these credentials

### Query Parameters

For GET requests with filters:

```
URL: http://192.168.2.33:3003/api/v1/n8n/nas/files

Query Parameters:
  extension = mp4
  minSize = 1000000
  limit = 50
```

n8n will automatically format as:
```
.../nas/files?extension=mp4&minSize=1000000&limit=50
```

### Request Body (POST/PATCH)

For POST/PATCH requests:

1. Set **Body** to **JSON**
2. Add your JSON data:

```json
{
  "roots": ["/mnt/nas/videos"],
  "extensions": ["mp4", "avi", "mkv"]
}
```

## Troubleshooting Checklist

- [ ] API key set in server environment (`N8N_API_KEY`)
- [ ] Server restarted after setting env var
- [ ] Using `/api/v1/n8n/*` endpoints (not `/api/v1/*`)
- [ ] Header name is exactly `x-api-key` (lowercase)
- [ ] Header value matches server key exactly
- [ ] No extra whitespace in header value
- [ ] Using correct HTTP method (GET/POST/PATCH)
- [ ] n8n can reach the server IP address
- [ ] Port 3003 is accessible from n8n
- [ ] If LAN-only: n8n on same network

## Getting Help

1. Check server logs: `pm2 logs` or check console output
2. Test with curl first:
   ```bash
   curl -H "x-api-key: your-key" http://192.168.2.33:3003/api/v1/n8n/health
   ```
3. Review documentation: `N8N_INTEGRATION.md`
4. Check test results: `npm test -- tests/n8n.test.js`
