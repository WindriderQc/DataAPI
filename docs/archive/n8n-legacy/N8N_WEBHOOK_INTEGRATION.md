# n8n Webhook Integration Guide

This guide explains how DataAPI can trigger n8n workflows using webhooks for event-driven automation.

## Overview

DataAPI can now **push** events to n8n workflows, enabling real-time automation triggered by DataAPI events like:
- NAS scan completions
- File exports
- Storage alerts
- Custom events

## Architecture

```
DataAPI Events → n8n Webhooks → n8n Workflows
```

**Direction**: DataAPI → n8n (DataAPI sends notifications TO n8n)

This is the reverse of the n8n API endpoints where n8n calls DataAPI.

## Setup

### 1. Create a Webhook in n8n

1. Open your n8n workflow
2. Add a **"Webhook"** node as the trigger
3. Configure:
   - **HTTP Method**: POST
   - **Path**: Leave as auto-generated or customize
   - **Authentication**: None (webhooks are from trusted DataAPI)
   - **Response Mode**: "Immediately"

4. n8n will show you the webhook URL, for example:
   ```
   https://n8n.specialblend.icu/webhook-test/c1deca83-ecb4-48ad-b485-59195cee9a61
   ```

5. Copy the webhook ID: `c1deca83-ecb4-48ad-b485-59195cee9a61`

### 2. Configure DataAPI Environment Variables

Add to your `.env` file:

```bash
# n8n Webhook Base URL
N8N_WEBHOOK_BASE_URL=https://n8n.specialblend.icu

# Webhook IDs for different event types
N8N_WEBHOOK_SCAN_COMPLETE=c1deca83-ecb4-48ad-b485-59195cee9a61
N8N_WEBHOOK_FILES_EXPORTED=c1deca83-ecb4-48ad-b485-59195cee9a61
N8N_WEBHOOK_STORAGE_ALERT=c1deca83-ecb4-48ad-b485-59195cee9a61
N8N_WEBHOOK_GENERIC=c1deca83-ecb4-48ad-b485-59195cee9a61
```

**Note**: You can use the same webhook ID for all events, or create separate webhooks for each event type.

### 3. Restart DataAPI

```bash
pm2 restart data-api
# or
npm run dev
```

## Automatic Event Triggers

DataAPI automatically triggers webhooks for these events:

### 1. NAS Scan Complete

**Triggered**: When a storage scan finishes

**Payload**:
```json
{
  "event": "nas_scan_complete",
  "scan": {
    "scanId": "674e5a1b2c3d4e5f6a7b8c9d",
    "status": "complete",
    "filesFound": 1523,
    "upserts": 1500,
    "errors": 0,
    "duration": 45000,
    "roots": ["/mnt/nas/videos"]
  },
  "timestamp": "2025-11-14T12:00:00.000Z",
  "source": "dataapi"
}
```

**Use Cases**:
- Send notification when scan completes
- Trigger downstream processing
- Update monitoring dashboards
- Archive scan results

### 2. Files Exported

**Triggered**: When file export completes

**Payload**:
```json
{
  "event": "files_exported",
  "export": {
    "exportId": "export-abc123",
    "type": "full",
    "fileCount": 1000,
    "fileSize": 5242880000,
    "path": "/exports/report-2025-11-14.csv"
  },
  "timestamp": "2025-11-14T12:00:00.000Z",
  "source": "dataapi"
}
```

### 3. Storage Alert

**Triggered**: When storage thresholds are exceeded

**Payload**:
```json
{
  "event": "storage_alert",
  "alert": {
    "type": "disk_full",
    "severity": "warning",
    "currentUsage": 85,
    "threshold": 80,
    "path": "/mnt/nas"
  },
  "timestamp": "2025-11-14T12:00:00.000Z",
  "source": "dataapi"
}
```

## Manual Webhook Triggers

You can also manually trigger webhooks via the API.

### Trigger Specific Webhook

**POST** `/api/v1/n8n/trigger/:webhookId`

```bash
curl -X POST \
  http://192.168.2.33:3003/api/v1/n8n/trigger/c1deca83-ecb4-48ad-b485-59195cee9a61 \
  -H "x-api-key: 5d648db791e2a0584f87e1ca3f1c3be3efcf96fc12fd613f9a621c63651e0cd2" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Test from DataAPI",
    "data": {
      "test": true
    }
  }'
```

**Response**:
```json
{
  "status": "success",
  "message": "Triggered n8n webhook: c1deca83-ecb4-48ad-b485-59195cee9a61",
  "data": {
    // n8n webhook response
  }
}
```

### Trigger Predefined Event

**POST** `/api/v1/n8n/event/:eventType`

Event types: `scan_complete`, `files_exported`, `storage_alert`, `custom`

```bash
# Trigger scan complete event
curl -X POST \
  http://192.168.2.33:3003/api/v1/n8n/event/scan_complete \
  -H "x-api-key: 5d648db791e2a0584f87e1ca3f1c3be3efcf96fc12fd613f9a621c63651e0cd2" \
  -H "Content-Type: application/json" \
  -d '{
    "scanId": "test-123",
    "filesFound": 100,
    "status": "complete"
  }'

# Trigger custom event
curl -X POST \
  http://192.168.2.33:3003/api/v1/n8n/event/custom \
  -H "x-api-key: 5d648db791e2a0584f87e1ca3f1c3be3efcf96fc12fd613f9a621c63651e0cd2" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "custom_operation_complete",
    "data": {
      "operationId": "op-456",
      "result": "success"
    }
  }'
```

## Using Webhooks in Code

### Import the Webhook Utility

```javascript
const { triggers } = require('../utils/n8nWebhook');
```

### Trigger Scan Complete

```javascript
await triggers.scanComplete({
  scanId: '674e5a1b',
  status: 'complete',
  filesFound: 1500,
  upserts: 1450,
  errors: 0,
  duration: 45000,
  roots: ['/mnt/nas/videos']
});
```

### Trigger File Export

```javascript
await triggers.filesExported({
  exportId: 'export-123',
  type: 'full',
  fileCount: 1000,
  path: '/exports/report.csv'
});
```

### Trigger Storage Alert

```javascript
await triggers.storageAlert({
  type: 'disk_full',
  severity: 'critical',
  currentUsage: 95,
  threshold: 80,
  path: '/mnt/nas'
});
```

### Trigger Custom Event

```javascript
await triggers.event('custom_event_name', {
  anything: 'you want',
  customData: 123
});
```

## n8n Workflow Examples

### Example 1: Scan Complete Notification

```
Webhook Trigger (scan_complete)
  ↓
IF Node (check filesFound > 1000)
  ↓
Send Slack Message
  "NAS Scan Complete: {{ $json.scan.filesFound }} files found"
```

### Example 2: Export Processing

```
Webhook Trigger (files_exported)
  ↓
Download Export File (HTTP Request)
  ↓
Process Data (Code Node)
  ↓
Upload to Cloud Storage
  ↓
Send Email Notification
```

### Example 3: Storage Alert Handler

```
Webhook Trigger (storage_alert)
  ↓
IF Node (severity === 'critical')
  ↓
Send SMS Alert
  ↓
Create ServiceNow Ticket
  ↓
Log to Database
```

## Accessing Data in n8n

In your n8n workflow, access webhook data using expressions:

```javascript
// Event type
{{ $json.event }}

// Timestamp
{{ $json.timestamp }}

// Scan data
{{ $json.scan.scanId }}
{{ $json.scan.filesFound }}
{{ $json.scan.status }}

// Export data
{{ $json.export.exportId }}
{{ $json.export.fileCount }}

// Alert data
{{ $json.alert.severity }}
{{ $json.alert.currentUsage }}

// Custom data
{{ $json.data.anything }}
```

## Error Handling

Webhook triggers are **fire-and-forget** - if the webhook fails:

1. DataAPI logs a warning but continues normally
2. The triggering operation (scan, export, etc.) is NOT affected
3. You can retry manually using the API endpoints

**Example log**:
```
warn: Failed to trigger n8n webhook: c1deca83-ecb4-48ad-b485-59195cee9a61 - Network error
```

## Testing

### Test with curl

```bash
# Test the webhook directly (bypass DataAPI)
curl -X POST \
  https://n8n.specialblend.icu/webhook-test/c1deca83-ecb4-48ad-b485-59195cee9a61 \
  -H "Content-Type: application/json" \
  -d '{
    "event": "test",
    "message": "Hello from curl"
  }'

# Test via DataAPI
curl -X POST \
  http://192.168.2.33:3003/api/v1/n8n/trigger/c1deca83-ecb4-48ad-b485-59195cee9a61 \
  -H "x-api-key: 5d648db791e2a0584f87e1ca3f1c3be3efcf96fc12fd613f9a621c63651e0cd2" \
  -H "Content-Type: application/json" \
  -d '{
    "test": true,
    "timestamp": "2025-11-14T12:00:00Z"
  }'
```

### Verify in n8n

1. Check the workflow execution history
2. Inspect the webhook trigger output
3. Verify the data structure matches expectations

## Best Practices

1. **Separate Webhooks**: Use different webhook IDs for different event types for better organization
2. **Error Handling**: Always handle webhook failures gracefully in n8n workflows
3. **Validation**: Validate webhook data in n8n before processing
4. **Logging**: Log webhook receipts for debugging
5. **Retry Logic**: Implement retry logic in n8n for critical operations
6. **Testing**: Test webhooks thoroughly before deploying to production

## Troubleshooting

### Webhook Not Triggering

1. **Check logs**: Look for webhook trigger messages in DataAPI logs
2. **Test direct**: Test webhook URL directly with curl
3. **Verify URL**: Ensure `N8N_WEBHOOK_BASE_URL` is correct
4. **Check n8n**: Verify webhook node is active in n8n

### Webhook Timing Out

1. **Increase timeout**: Set timeout in trigger options
2. **Check n8n**: Ensure n8n is responding quickly
3. **Response mode**: Use "Immediately" in webhook node settings

### Wrong Data Structure

1. **Check payload**: Log the actual payload being sent
2. **Update workflow**: Adjust n8n workflow to match actual data structure
3. **Validate**: Add validation in n8n to handle unexpected formats

## Security Considerations

1. **HTTPS**: Always use HTTPS for webhook URLs in production
2. **Webhook Secrets**: Consider adding webhook secrets in future updates
3. **LAN Only**: If possible, keep webhooks on internal network
4. **Validation**: Validate webhook source in n8n if exposed publicly

## Comparison: API vs Webhooks

| Feature | n8n API Endpoints | DataAPI Webhooks |
|---------|-------------------|------------------|
| Direction | n8n → DataAPI | DataAPI → n8n |
| Auth | API Key (x-api-key) | None (trusted) |
| Use Case | n8n queries/controls DataAPI | DataAPI notifies n8n |
| Initiated By | n8n workflows | DataAPI events |
| Examples | Get stats, query files | Scan complete, alerts |

**Both work together** to enable bidirectional automation!

## Related Documentation

- [N8N_INTEGRATION.md](./N8N_INTEGRATION.md) - n8n API endpoints (n8n → DataAPI)
- [N8N_QUICKSTART.md](./N8N_QUICKSTART.md) - Quick setup guide
- [N8N_NODE_SETUP.md](./N8N_NODE_SETUP.md) - HTTP Request node configuration
