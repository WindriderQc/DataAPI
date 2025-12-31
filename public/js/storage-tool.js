document.addEventListener('DOMContentLoaded', () => {
  // === Initial Load ===
  loadRecentScans();
  loadMountStatus();
  loadN8nStatus();
  loadExportList(); // Trigger initial load of exports

  // === System Resources Polling ===
  updateSystemResources();
  setInterval(updateSystemResources, 5000); // Poll every 5 seconds

  // === Event Listeners ===
  // ...
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

function formatBytes(bytes) {
  if (typeof bytes !== 'number' || !isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = Math.floor(Math.log(bytes) / Math.log(k));
  if (i < 0) i = 0;
  if (i >= sizes.length) i = sizes.length - 1;
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
    const res = await fetch('/api/v1/storage/scans?limit=10');
    const data = await res.json();
    
    if (data.status === 'success') {
      const scans = data.data.scans;
      if (scans.length === 0) {
        container.innerHTML = '<tr><td colspan="6" class="text-center">No recent scans found.</td></tr>';
        return;
      }

      container.innerHTML = scans.map(scan => {
        const safeId = escapeHtml(scan._id);
        const safeStartedAt = escapeHtml(new Date(scan.started_at).toLocaleString());
        const safeStartedTime = escapeHtml(new Date(scan.started_at).toLocaleTimeString());

        return `
        <tr>
          <td><span class="text-danger">${safeId.substring(0, 8)}...</span></td>
          <td>${renderStatusBadge(scan.status)}</td>
          <td>${scan.files_found || (scan.counts ? scan.counts.files_processed : 0)}</td>
          <td>${scan.counts ? scan.counts.inserted + scan.counts.updated : 0}</td>
          <td title="${safeStartedAt}">${safeStartedTime}</td>
          <td>
            <button class="btn btn-sm btn-link p-0" onclick="viewScanDetails('${safeId}')">
              <i class="fas fa-eye"></i>
            </button>
             ${scan.live ? `
              <button class="btn btn-sm btn-link text-danger p-0 ms-2" onclick="stopScan('${safeId}')">
                <i class="fas fa-stop"></i>
              </button>
            ` : ''}
          </td>
        </tr>
      `}).join('');
    } else {
      container.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Failed to load scans.</td></tr>';
    }
  } catch (err) {
    console.error(err);
    container.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Error loading scans.</td></tr>';
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
      const statusBadge = document.getElementById('n8nStatusIndicator');
      const configUrl = document.getElementById('n8nWebhookUrl');

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
                <td class="text-truncate" style="max-width: 150px;" title="${escapeHtml(e.message)}">
                  ${escapeHtml(e.message)}
                </td>
                <td class="small text-muted">${new Date(e.timestamp).toLocaleTimeString()}</td>
              </tr>
            `).join('');
          } else {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">No recent events.</td></tr>';
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

  return `<span class="badge bg-${color}">${escapeHtml(status) || 'undefined'}</span>`;
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

// === Export Functions ===

async function loadExportList() {
    const tbody = document.getElementById('exportsListBody');
    if (!tbody) return;

    try {
        const res = await fetch('/api/v1/files/exports');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json = await res.json();

        if (json.status === 'success') {
            const files = json.data;
            if (files.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No reports available.</td></tr>';
                return;
            }

            tbody.innerHTML = files.map(file => {
                const safeName = escapeHtml(file.name);
                const safeModified = escapeHtml(new Date(file.modified).toLocaleString());
                const safeDate = escapeHtml(new Date(file.modified).toLocaleDateString());

                return `
                <tr>
                    <td>
                        <a href="/exports/${safeName}" target="_blank" class="text-decoration-none text-truncate d-inline-block" style="max-width: 150px;" title="${safeName}">
                            <i class="fa fa-file-alt me-1"></i> ${safeName}
                        </a>
                    </td>
                    <td class="small">${formatBytes(file.size)}</td>
                    <td class="small" title="${safeModified}">
                        ${safeDate}
                    </td>
                    <td>
                        <button class="btn btn-sm btn-link text-danger p-0" onclick="deleteExport('${safeName}')" title="Delete Report">
                            <i class="fa fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `}).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">Failed to load reports.</td></tr>';
        }
    } catch (err) {
        console.error('Error loading exports:', err);
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">Error loading reports.</td></tr>';
    }
}

async function generateExport() {
    const typeSelect = document.getElementById('exportType');
    const formatSelect = document.getElementById('exportFormat');
    // More robust selector (assuming button has an ID or using the specific onclick if unique)
    // Adding ID in EJS plan is next step, for now use current robust selector
    const btn = document.getElementById('generateExportBtn') || document.querySelector('button[onclick="generateExport()"]');

    if (!typeSelect || !formatSelect) return;

    const type = typeSelect.value;
    const format = formatSelect.value;

    if (btn) {
        btn.disabled = true;
        const originalHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i>';

        try {
            const res = await fetch('/api/v1/files/export', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, format })
            });

            const json = await res.json();

            if (json.status === 'success') {
                // Refresh list
                await loadExportList();
            } else {
                alert('Export failed: ' + (json.message || 'Unknown error'));
            }
        } catch (err) {
            console.error('Export error:', err);
            alert('Export request failed: ' + err.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }
    }
}

async function deleteExport(filename) {
    if (!confirm(`Are you sure you want to delete report "${filename}"?`)) return;

    try {
        const res = await fetch(`/api/v1/files/exports/${filename}`, {
            method: 'DELETE'
        });

        const json = await res.json();

        if (json.status === 'success') {
            loadExportList();
        } else {
            alert('Delete failed: ' + (json.message || 'Unknown error'));
        }
    } catch (err) {
        console.error('Delete error:', err);
        alert('Delete request failed: ' + err.message);
    }
}

// === Global Exports ===

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
        const statusTabTrigger = document.querySelector('#status-tab');
        if (statusTabTrigger) {
            const tab = new bootstrap.Tab(statusTabTrigger);
            tab.show();
        }

        const statusBadge = document.getElementById('currentScanStatus');
        if (statusBadge) {
            statusBadge.textContent = 'Running';
            statusBadge.className = 'badge bg-primary status-badge';
        }

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
    btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i>';

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
      alert('Test webhook sent successfully!');
      loadN8nStatus(); // Refresh events
    } else {
      alert('Error sending test webhook: ' + (data.message || 'Unknown error'));
    }
  } catch (err) {
    console.error(err);
    alert('Error testing connection: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Test';
  }
};

window.loadRecentScans = loadRecentScans;
window.stopScan = stopScan;
window.viewScanDetails = viewScanDetails;
window.loadExportList = loadExportList;
window.generateExport = generateExport;
window.deleteExport = deleteExport;
