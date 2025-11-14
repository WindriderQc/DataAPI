const { fetchWithTimeoutAndRetry } = require('./fetch-utils');
const { log } = require('./logger');

/**
 * Trigger an n8n webhook
 * @param {string} webhookId - The webhook ID from n8n
 * @param {object} data - Payload to send to n8n
 * @param {object} options - Optional configuration
 * @returns {Promise<object>} n8n response
 */
async function triggerWebhook(webhookId, data = {}, options = {}) {
  const n8nBaseUrl = process.env.N8N_WEBHOOK_BASE_URL || 'https://n8n.specialblend.icu';
  const url = `${n8nBaseUrl}/webhook-test/${webhookId}`;

  try {
    log(`Triggering n8n webhook: ${webhookId}`, 'info');
    
    const response = await fetchWithTimeoutAndRetry(url, {
      method: options.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      body: JSON.stringify(data),
      timeout: options.timeout || 5000,
      retries: options.retries || 1,
      name: 'n8n-webhook'
    });

    const result = await response.json();
    
    log(`n8n webhook response: ${webhookId}`, 'info');
    
    return {
      success: true,
      status: response.status,
      data: result
    };
  } catch (error) {
    log(`Failed to trigger n8n webhook: ${webhookId} - ${error.message}`, 'warn');
    
    // Don't throw - just log and return failure
    // This prevents n8n being down from breaking DataAPI
    return {
      success: false,
      error: error.message,
      webhookId
    };
  }
}

/**
 * Common webhook triggers for DataAPI events
 */
const triggers = {
  /**
   * Trigger when a NAS scan completes
   */
  scanComplete: async (scanData) => {
    const webhookId = process.env.N8N_WEBHOOK_SCAN_COMPLETE || 'c1deca83-ecb4-48ad-b485-59195cee9a61';
    const summary = `NAS scan completed: ${scanData.filesFound || 0} files found, ${scanData.upserts || 0} processed`;
    return triggerWebhook(webhookId, {
      chatInput: summary,
      event: 'nas_scan_complete',
      scan: scanData,
      timestamp: new Date().toISOString(),
      source: 'dataapi'
    });
  },

  /**
   * Trigger when files are exported
   */
  filesExported: async (exportData) => {
    const webhookId = process.env.N8N_WEBHOOK_FILES_EXPORTED || 'c1deca83-ecb4-48ad-b485-59195cee9a61';
    const summary = `File export completed: ${exportData.fileCount || 0} files exported`;
    return triggerWebhook(webhookId, {
      chatInput: summary,
      event: 'files_exported',
      export: exportData,
      timestamp: new Date().toISOString(),
      source: 'dataapi'
    });
  },

  /**
   * Trigger when storage threshold is exceeded
   */
  storageAlert: async (alertData) => {
    const webhookId = process.env.N8N_WEBHOOK_STORAGE_ALERT || 'c1deca83-ecb4-48ad-b485-59195cee9a61';
    const summary = `Storage alert: ${alertData.type || 'unknown'} - ${alertData.message || 'threshold exceeded'}`;
    return triggerWebhook(webhookId, {
      chatInput: summary,
      event: 'storage_alert',
      alert: alertData,
      timestamp: new Date().toISOString(),
      source: 'dataapi'
    });
  },

  /**
   * Generic event trigger
   */
  event: async (eventName, eventData) => {
    const webhookId = process.env.N8N_WEBHOOK_GENERIC || 'c1deca83-ecb4-48ad-b485-59195cee9a61';
    const summary = `Event: ${eventName}`;
    return triggerWebhook(webhookId, {
      chatInput: summary,
      event: eventName,
      data: eventData,
      timestamp: new Date().toISOString(),
      source: 'dataapi'
    });
  }
};

module.exports = {
  triggerWebhook,
  triggers
};
