document.addEventListener('DOMContentLoaded', () => {
  // === Initial Load ===
  loadRecentScans();
  loadMountStatus();
  loadN8nStatus();

  // === System Resources Polling ===
  updateSystemResources();
  setInterval(updateSystemResources, 5000); // Poll every 5 seconds

  // === Event Listeners ===

  // Start Scan Button
  const startBtn = document.getElementById('startScanBtn');
  if (startBtn) {
    startBtn.addEventListener('click', async () => {
        // This listener is redundant if we use onclick="startScan()" but good for safety
        // We will implement the logic in the global function and rely on that.
    });
  }
});

// === Helper Functions ===

function escapeHtml(text) {
  if (text == null) return '';
  return text
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function updateSystemResources() {
  try {
    const res = await fetch('/api/v1/system/resources');
    if (!res.ok) return; // Silent fail on error to not spam console
    
    const data = await res.json();
    if (data.status === 'success') {
      const stats = data.data;

      // Update DOM elements (using IDs from template)
      if (document.getElementById('sysCpuVal'))
        document.getElementById('sysCpuVal').textContent = stats.cpu.toFixed(1) + '%';

      if (document.getElementById('sysMemVal'))
        document.getElementById('sysMemVal').textContent = Math.round(stats.memory / 1024 / 1024) + ' MB';

      if (document.getElementById('sysLoadVal'))
        document.getElementById('sysLoadVal').textContent = stats.loadAvg[0].toFixed(2);

      // Format uptime
      const uptimeHrs = Math.floor(stats.uptime / 3600);
      const uptimeMins = Math.floor((stats.uptime % 3600) / 60);

      if (document.getElementById('sysUptimeVal'))
        document.getElementById('sysUptimeVal').textContent = `${uptimeHrs}h ${uptimeMins}m`;

      // Update timestamp
      if (document.getElementById('sysResUpdated'))
        document.getElementById('sysResUpdated').textContent = 'Updated: ' + new Date().toLocaleTimeString();
    }
  } catch (err) {
    // console.warn('Failed to fetch system resources', err);
  }
}

async function loadRecentScans() {
  const container = document.getElementById('recentScansBody');
  if (!container) return;

  try {
    // Use the dedicated storage scan list endpoint
    const res = await fetch('/api/v1/storage/scans?limit=10');
    const data = await res.json();
    
    if (data.status === 'success') {
      // API returns { data: { scans: [], count: 0 } }
      const scans = data.data.scans;
      if (scans.length === 0) {
        container.innerHTML = '<tr><td colspan="8" class="text-center">No recent scans found.</td></tr>';
        return;
      }

      container.innerHTML = scans.map(scan => `
        <tr>
          <td><span class="text-danger">${scan._id}</span></td>
          <td>${renderStatusBadge(scan.status)}</td>
          <td>${scan.files_found || (scan.counts ? scan.counts.files_processed : 0)}</td>
          <td>${scan.counts ? scan.counts.inserted + scan.counts.updated : 0}</td>
          <td>${scan.errors || 0}</td>
          <td>${new Date(scan.started_at).toLocaleString()}</td>
          <td>${scan.duration ? scan.duration + 's' : '-'}</td>
          <td>
            <button class="btn btn-sm btn-outline-primary" onclick="viewScanDetails('${scan._id}')">
              <i class="fas fa-eye"></i>
            </button>
             ${scan.live ? `
              <button class="btn btn-sm btn-outline-danger" onclick="stopScan('${scan._id}')">
                <i class="fas fa-stop"></i>
              </button>
            ` : ''}
          </td>
        </tr>
      `).join('');
    } else {
      container.innerHTML = '<tr><td colspan="8" class="text-center text-danger">Failed to load scans.</td></tr>';
    }
  } catch (err) {
    console.error(err);
    container.innerHTML = '<tr><td colspan="8" class="text-center text-danger">Error loading scans.</td></tr>';
  }
}

async function loadMountStatus() {
  // Placeholder for SMB mount status checking
}

async function loadN8nStatus() {
  try {
    const res = await fetch('/api/v1/storage/n8n/status');

    if (!res.ok) {
       console.warn('Failed to load n8n status:', res.status);
       return;
    }

    const data = await res.json();
    
    if (data.status === 'success') {
      const { configured, url, events } = data.data;

      // Update Status Badge
      const statusBadge = document.getElementById('n8nStatusIndicator'); // Correct ID from EJS
      const configUrl = document.getElementById('n8nWebhookUrl');     // Correct ID from EJS

      if (statusBadge && configured) {
        statusBadge.innerHTML = '<span class="badge bg-success">Active</span>';
      } else if (statusBadge) {
        statusBadge.innerHTML = '<span class="badge bg-warning text-dark">Not Configured</span>';
      }

      if (configUrl) {
          configUrl.textContent = configured ? url : 'None';
      }

      // Update Events Table
      const tbody = document.getElementById('n8nEventsBody');
      if (tbody) {
          if (events && events.length > 0) {
            tbody.innerHTML = events.map(e => `
              <tr>
                <td><span class="badge bg-${e.type === 'Incoming' ? 'info' : 'secondary'}">${escapeHtml(e.type)}</span></td>
                <td class="text-truncate" style="max-width: 300px;" title="${escapeHtml(e.message)}">
                  ${escapeHtml(e.message)}
                </td>
                <td class="small text-muted">${new Date(e.timestamp).toLocaleTimeString()}</td>
              </tr>
            `).join('');
          } else {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">No recent integration events.</td></tr>';
          }
      }
    }
  } catch (err) {
    console.error('Failed to load n8n status', err);
  }
}

function renderStatusBadge(status) {
  let color = 'secondary';
  if (status === 'running') color = 'primary';
  if (status === 'complete' || status === 'completed') color = 'success';
  if (status === 'error' || status === 'stopped') color = 'warning';

  return `<span class="badge bg-${color}">${status || 'undefined'}</span>`;
}

function calculateDuration(start, end) {
  if (!start) return '-';
  const startTime = new Date(start).getTime();
  const endTime = end ? new Date(end).getTime() : Date.now();
  const diff = Math.floor((endTime - startTime) / 1000);
  return diff + 's';
}

async function stopScan(scanId) {
  if (!confirm('Are you sure you want to stop this scan?')) return;

  try {
    const res = await fetch(`/api/v1/storage/stop/${scanId}`, { method: 'POST' });
    const data = await res.json();
    if (data.status === 'success') {
      alert('Scan stopped.');
      loadRecentScans();
    } else {
      alert('Error stopping scan: ' + data.message);
    }
  } catch (err) {
    console.error(err);
    alert('Network error stopping scan.');
  }
}

function viewScanDetails(scanId) {
  alert('Details for scan ' + scanId);
}

// === Global Exports for onclick Handlers ===

window.startScan = async function() {
    const roots = document.getElementById('scanRoots').value.split('\n').filter(p => p.trim() !== '');
    const extensions = document.getElementById('scanExtensions').value.split(',').map(e => e.trim());
    const batchSize = parseInt(document.getElementById('batchSize').value, 10);

    if (roots.length === 0) {
      alert('Please specify at least one root directory.');
      return;
    }

    try {
      const res = await fetch('/api/v1/storage/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roots, extensions, batch_size: batchSize })
      });

      const data = await res.json();
      if (data.status === 'success') {
        alert('Scan started successfully! Scan ID: ' + data.data.scan_id);
        loadRecentScans();
      } else {
        alert('Error starting scan: ' + (data.message || 'Unknown error'));
      }
    } catch (err) {
      console.error(err);
      alert('Network error starting scan.');
    }
};

window.testN8nWebhook = async function() {
  const btn = document.getElementById('testN8nBtn') || document.querySelector('button[onclick="testN8nWebhook()"]');

  if (!btn) {
      console.error('Test button not found');
      return;
  }

  try {
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Testing...';

    const res = await fetch('/api/v1/storage/n8n/test', {
      method: 'POST'
    });

    if (!res.ok) {
        let errMsg = `HTTP ${res.status}`;
        try {
          const errData = await res.json();
          if (errData.message) errMsg = errData.message;
        } catch (e) {}
        throw new Error(errMsg);
    }

    const data = await res.json();

    if (data.status === 'success') {
      alert('Test webhook sent successfully! Check n8n execution log.');
      loadN8nStatus(); // Refresh events
    } else {
      alert('Error sending test webhook: ' + (data.message || 'Unknown error'));
    }
  } catch (err) {
    console.error(err);
    alert('Error testing connection: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa fa-paper-plane"></i> Test Connection';
  }
};

window.loadRecentScans = loadRecentScans;
window.stopScan = stopScan;
window.viewScanDetails = viewScanDetails;
window.loadExportList = function() { alert('Export feature pending implementation'); };
window.generateExport = function() { alert('Export feature pending implementation'); };
