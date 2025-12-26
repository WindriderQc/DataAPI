# n8n Integration Quick Start

## 1. Generate API Key

```bash
openssl rand -hex 32
```

## 2. Add to Environment

Add to your `.env` file or server environment:

```bash
# Required
N8N_API_KEY=your-generated-key-here

# Optional: Restrict to LAN only (recommended)
N8N_LAN_ONLY=true
```

## 3. Restart Server

```bash
npm start
# or for development
npm run dev
```

## 4. Configure n8n HTTP Request Node

**Method**: GET/POST/PATCH (as needed)

**URL**: `http://192.168.2.33:3003/api/v1/n8n/health`

**Authentication**: None

**Headers**:
```
Name: x-api-key
Value: your-generated-key-here
```

## Available Endpoints

- `GET /api/v1/n8n/health` - Health check
- `GET /api/v1/n8n/stats` - Database statistics
- `POST /api/v1/n8n/nas/scan` - Create scan record
- `PATCH /api/v1/n8n/nas/scan/:scanId` - Update scan
- `GET /api/v1/n8n/nas/scans` - List scans
- `GET /api/v1/n8n/nas/scan/:scanId` - Get scan details
- `POST /api/v1/n8n/nas/files` - Bulk insert/update files
- `GET /api/v1/n8n/nas/files` - Query files

See [N8N_INTEGRATION.md](./N8N_INTEGRATION.md) for complete documentation.

## Troubleshooting

### "Unauthorized" error
- Verify `N8N_API_KEY` is set in server environment
- Ensure `x-api-key` header matches exactly
- Restart server after setting environment variable

### "Forbidden: LAN only" error
- Check if `N8N_LAN_ONLY=true`
- Verify n8n is on the same network (192.168.x.x, 10.x.x.x, 172.16.x.x)
- Set `N8N_LAN_ONLY=false` to allow external access

### Session warnings in logs
- These should not appear for n8n requests
- Verify you're using `/api/v1/n8n/*` endpoints
- Check that `x-api-key` header is present

## Test the Integration

```bash
# Health check
curl -H "x-api-key: your-key" http://localhost:3003/api/v1/n8n/health

# Get stats
curl -H "x-api-key: your-key" http://localhost:3003/api/v1/n8n/stats
```

Expected response:
```json
{
  "status": "success",
  "message": "n8n API is healthy",
  "timestamp": "2025-11-08T12:00:00.000Z",
  "source": "n8n"
}
```
