# n8n Integration Guide

This guide explains how to configure and use the DataAPI's n8n-specific endpoints for server-to-server automation workflows.

## Overview

The DataAPI now supports two authentication methods:
1. **Browser-based authentication**: Session cookies for web UI and browser-based API calls
2. **n8n API key authentication**: Header-based authentication for server-to-server automation (no sessions or cookies required)

## Configuration

### 1. Environment Variables

Add these variables to your `.env` file or environment configuration:

```bash
# Required: API key for n8n authentication
N8N_API_KEY=your-secure-random-string-here

# Optional: Restrict n8n access to LAN only (default: false)
N8N_LAN_ONLY=true
```

**Generating a secure API key:**
```bash
# Linux/Mac
openssl rand -hex 32

# Or using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. n8n HTTP Request Node Configuration

In your n8n workflow, configure the HTTP Request node:

**Authentication**: None (we use custom header)

**Headers**:
```
x-api-key: your-secure-random-string-here
```

**URL Examples**:
```
http://192.168.2.33:3003/api/v1/n8n/health
http://192.168.2.33:3003/api/v1/n8n/nas/files
http://192.168.2.33:3003/api/v1/n8n/nas/scan
```

## Available Endpoints

All endpoints are prefixed with `/api/v1/n8n/` and require the `x-api-key` header.

### Health Check

**GET** `/api/v1/n8n/health`

Check if the n8n API is accessible and authenticated.

**Response:**
```json
{
  "status": "success",
  "message": "n8n API is healthy",
  "timestamp": "2025-11-08T12:00:00.000Z",
  "source": "n8n"
}
```

### NAS File Management

#### Query Files

**GET** `/api/v1/n8n/nas/files`

**Query Parameters:**
- `extension` - Filter by file extension (e.g., "mp4", "jpg")
- `minSize` - Minimum file size in bytes
- `maxSize` - Maximum file size in bytes
- `scanId` - Filter by scan ID
- `limit` - Number of results (default: 100, max: 1000)
- `skip` - Number of results to skip for pagination

**Example:**
```
GET /api/v1/n8n/nas/files?extension=mp4&minSize=1000000&limit=50
```

**Response:**
```json
{
  "status": "success",
  "results": 50,
  "total": 234,
  "data": [
    {
      "path": "/mnt/nas/videos/movie.mp4",
      "size": 1500000,
      "extension": "mp4",
      "modified": "2025-11-01T10:00:00.000Z",
      "scanId": "abc123"
    }
  ]
}
```

#### Bulk Insert/Update Files

**POST** `/api/v1/n8n/nas/files`

Insert or update multiple files in a single request. Uses upsert logic (creates new records or updates existing ones based on file path).

**Request Body:**
```json
{
  "files": [
    {
      "path": "/mnt/nas/videos/movie.mp4",
      "size": 1500000,
      "extension": "mp4",
      "modified": "2025-11-01T10:00:00.000Z",
      "dirname": "/mnt/nas/videos",
      "filename": "movie.mp4"
    }
  ],
  "scanId": "abc123"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Files processed",
  "data": {
    "inserted": 5,
    "updated": 3,
    "matched": 8,
    "total": 8
  }
}
```

### Scan Management

#### Create Scan Record

**POST** `/api/v1/n8n/nas/scan`

Create a new scan record to track file system scanning operations.

**Request Body:**
```json
{
  "roots": ["/mnt/nas/videos", "/mnt/nas/photos"],
  "extensions": ["mp4", "avi", "jpg", "png"],
  "metadata": {
    "initiator": "n8n-workflow",
    "purpose": "weekly-scan"
  }
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Scan record created",
  "data": {
    "scanId": "674e5a1b2c3d4e5f6a7b8c9d",
    "scan": {
      "_id": "674e5a1b2c3d4e5f6a7b8c9d",
      "roots": ["/mnt/nas/videos"],
      "extensions": ["mp4"],
      "status": "pending",
      "startedAt": "2025-11-08T12:00:00.000Z",
      "filesFound": 0,
      "filesProcessed": 0,
      "source": "n8n"
    }
  }
}
```

#### Update Scan Status

**PATCH** `/api/v1/n8n/nas/scan/:scanId`

Update a scan's status and progress.

**Request Body:**
```json
{
  "status": "completed",
  "filesFound": 150,
  "filesProcessed": 150,
  "errors": []
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Scan updated",
  "data": {
    "scanId": "674e5a1b2c3d4e5f6a7b8c9d",
    "modified": true
  }
}
```

#### Get Scan Status

**GET** `/api/v1/n8n/nas/scan/:scanId`

Retrieve details about a specific scan.

**Response:**
```json
{
  "status": "success",
  "data": {
    "_id": "674e5a1b2c3d4e5f6a7b8c9d",
    "roots": ["/mnt/nas/videos"],
    "status": "completed",
    "startedAt": "2025-11-08T12:00:00.000Z",
    "completedAt": "2025-11-08T12:30:00.000Z",
    "filesFound": 150,
    "filesProcessed": 150
  }
}
```

#### List Recent Scans

**GET** `/api/v1/n8n/nas/scans`

Get a list of recent scans, sorted by start time (newest first).

**Query Parameters:**
- `limit` - Number of scans to return (default: 10)

**Response:**
```json
{
  "status": "success",
  "results": 10,
  "data": [
    {
      "_id": "674e5a1b2c3d4e5f6a7b8c9d",
      "status": "completed",
      "startedAt": "2025-11-08T12:00:00.000Z",
      "filesFound": 150
    }
  ]
}
```

### Statistics

**GET** `/api/v1/n8n/stats`

Get database statistics and the most recent scan information.

**Response:**
```json
{
  "status": "success",
  "data": {
    "collections": {
      "nas_files": 15234,
      "nas_scans": 45,
      "nas_directories": 892
    },
    "recentScan": {
      "_id": "674e5a1b2c3d4e5f6a7b8c9d",
      "status": "completed",
      "filesFound": 150
    },
    "timestamp": "2025-11-08T12:00:00.000Z"
  }
}
```

## Security Features

### API Key Authentication

All n8n endpoints require a valid `x-api-key` header. The key must match the `N8N_API_KEY` environment variable.

**Invalid/Missing Key Response (401):**
```json
{
  "status": "error",
  "message": "Unauthorized: Invalid or missing API key"
}
```

### LAN-Only Mode (Optional)

When `N8N_LAN_ONLY=true`, requests are restricted to local network IP addresses:
- `192.168.x.x`
- `10.x.x.x`
- `172.16.x.x`
- `127.0.0.1`
- `::1` (IPv6 localhost)

**Non-LAN Request Response (403):**
```json
{
  "status": "error",
  "message": "Forbidden: LAN access only"
}
```

### Session Bypass

n8n requests bypass the session middleware entirely, avoiding:
- Cookie domain warnings
- Session ID checks
- CSRF validation
- Origin validation

The session middleware automatically detects n8n requests by the presence of a valid `x-api-key` header and skips session processing.

## Example n8n Workflows

### 1. NAS File Sync Workflow

```
Trigger (Schedule: Daily 2 AM)
  ↓
Create Scan Record (HTTP Request)
  ↓
Scan File System (Execute Command/FTP/etc.)
  ↓
Process Files (Loop)
    ↓
    Batch Insert Files (HTTP Request - POST /n8n/nas/files)
  ↓
Update Scan Status (HTTP Request - PATCH /n8n/nas/scan/:id)
  ↓
Send Notification (Email/Slack/etc.)
```

### 2. Health Check Workflow

```
Trigger (Schedule: Every 5 minutes)
  ↓
Check n8n API Health (HTTP Request - GET /n8n/health)
  ↓
IF status != "success"
    ↓
    Alert Admin (Email/Slack)
```

## Troubleshooting

### "Unauthorized: Invalid or missing API key"

**Cause**: Missing or incorrect `x-api-key` header

**Solution**: 
1. Verify `N8N_API_KEY` is set in the server environment
2. Ensure the `x-api-key` header exactly matches the environment variable
3. Check for whitespace or special characters in the key

### "Forbidden: LAN access only"

**Cause**: Request coming from non-LAN IP when `N8N_LAN_ONLY=true`

**Solution**:
1. Verify n8n is running on the same network
2. Set `N8N_LAN_ONLY=false` if you need to allow external access
3. Use a VPN to access the LAN if n8n is remote

### "Session cookie domain present but ignored"

**Cause**: This warning should no longer appear for n8n requests

**Solution**: 
1. Ensure you're using the `/api/v1/n8n/*` endpoints
2. Verify the `x-api-key` header is being sent
3. Check server logs for authentication success messages

### Rate Limiting

n8n endpoints are subject to the global API rate limiter. If you're hitting rate limits:

1. Reduce request frequency
2. Batch operations (use bulk endpoints like `POST /n8n/nas/files`)
3. Contact admin to adjust rate limits for n8n IP addresses

## Migration from Session-Based API

If you're currently using session-based API endpoints in n8n:

**Before (Session-based):**
```
GET /api/v1/storage/files
Headers: Cookie: specialblend.ca=...
```

**After (n8n API Key):**
```
GET /api/v1/n8n/nas/files
Headers: x-api-key: your-api-key-here
```

**Benefits:**
- No cookie management needed
- No session expiration issues
- Cleaner server logs
- Better separation of concerns
- Simpler n8n workflow configuration

## Best Practices

1. **Secure the API Key**: Store in n8n credentials, never hardcode in workflows
2. **Use LAN-Only Mode**: Enable `N8N_LAN_ONLY=true` for additional security
3. **Batch Operations**: Use bulk endpoints to reduce API calls
4. **Monitor Usage**: Check `/n8n/stats` regularly to track database growth
5. **Error Handling**: Always check response `status` field in n8n workflows
6. **Logging**: Enable n8n logging to track API interactions
7. **Scan Records**: Create scan records before bulk operations for better tracking

## Support

For issues or questions:
1. Check server logs for detailed error messages
2. Review n8n workflow execution logs
3. Test endpoints with curl or Postman first
4. Verify environment variables are loaded correctly

## Changelog

### v1.0.0 (2025-11-08)
- Initial release
- Added n8n authentication middleware
- Created dedicated n8n routes
- Session bypass for n8n requests
- LAN-only security option
- Comprehensive NAS file and scan management endpoints
