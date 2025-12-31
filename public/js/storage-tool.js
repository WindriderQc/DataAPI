document.addEventListener('DOMContentLoaded', () => {
  // === Initial Load ===
  loadRecentScans();
  loadMountStatus();
  loadN8nStatus();
  loadExportList(); // Trigger initial load of exports

  // === Polling ===
  setInterval(loadRecentScans, 5000);

  // === System Resources Polling ===
  updateSystemResources();
  setInterval(updateSystemResources, 10000); // Poll every 10 seconds

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
      // The controller returns { process: { cpu, memory, uptime }, system: { load_avg, ... } }
      // We need to map these correctly.
      
      const cpu = stats.process ? stats.process.cpu : 0;
      const memory = stats.process ? stats.process.memory : 0;
      const loadAvg = stats.system ? stats.system.load_avg : [0, 0, 0];
      const uptime = stats.process ? stats.process.uptime / 1000 : 0; // process uptime in seconds (was ms)

      // Update DOM elements (using IDs from template)
      if (document.getElementById('sysCpuVal'))
        document.getElementById('sysCpuVal').textContent = cpu.toFixed(1) + '%';

      if (document.getElementById('sysMemVal'))
        document.getElementById('sysMemVal').textContent = Math.round(memory / 1024 / 1024) + ' MB';

      if (document.getElementById('sysLoadVal'))
        document.getElementById('sysLoadVal').textContent = loadAvg[0].toFixed(2);

      // Format uptime
      const uptimeHrs = Math.floor(uptime / 3600);
      const uptimeMins = Math.floor((uptime % 3600) / 60);

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

function updateStatusTab(scan) {
  const idEl = document.getElementById('currentScanId');
  const statusEl = document.getElementById('currentScanStatus');
  const liveEl = document.getElementById('currentScanLive');
  const stopBtn = document.getElementById('stopScanBtn');
  const seenEl = document.getElementById('filesSeen');
  const upsertedEl = document.getElementById('filesUpserted');
  const errorsEl = document.getElementById('filesErrors');
  const startedEl = document.getElementById('scanStarted');
  const progressEl = document.getElementById('scanProgress');
  const progressTextEl = document.getElementById('progressText');

  if (idEl) idEl.textContent = scan._id;
  
  if (statusEl) {
    statusEl.textContent = scan.status;
    statusEl.className = `badge status-badge bg-${scan.status === 'running' ? 'primary' : (scan.status === 'complete' ? 'success' : 'secondary')}`;
  }
  
  if (liveEl) liveEl.style.display = scan.live ? 'inline-block' : 'none';
  if (stopBtn) stopBtn.disabled = !scan.live;

  const counts = scan.counts || {};
  const seen = counts.files_seen || counts.files_processed || 0;
  const upserts = (counts.inserted || 0) + (counts.updated || 0) + (counts.upserts || 0);
  const errors = counts.errors || 0;

  if (seenEl) seenEl.textContent = seen;
  if (upsertedEl) upsertedEl.textContent = upserts;
  if (errorsEl) errorsEl.textContent = errors;
  
  if (startedEl) startedEl.textContent = new Date(scan.started_at).toLocaleString();

  if (progressEl) {
      if (scan.status === 'running') {
          progressEl.style.width = '100%';
          progressEl.classList.add('progress-bar-striped', 'progress-bar-animated');
          if (progressTextEl) progressTextEl.textContent = 'Scanning...';
      } else {
          progressEl.style.width = '100%';
          progressEl.classList.remove('progress-bar-striped', 'progress-bar-animated');
          if (progressTextEl) progressTextEl.textContent = scan.status === 'complete' ? 'Complete' : scan.status;
      }
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

      if (scans.length > 0) {
        updateStatusTab(scans[0]);
      }

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
          <td>${scan.files_found || (scan.counts ? (scan.counts.files_processed || scan.counts.files_seen || 0) : 0)}</td>
          <td>${scan.counts ? ((scan.counts.inserted || 0) + (scan.counts.updated || 0) + (scan.counts.upserts || 0)) : 0}</td>
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

async function viewScanDetails(scanId) {
  const modalEl = document.getElementById('scanDetailsModal');
  const contentEl = document.getElementById('scanDetailsContent');
  
  if (!modalEl || !contentEl) {
    console.error('Modal elements not found');
    return;
  }

  // Show loading state
  contentEl.innerHTML = '<div class="text-center py-4"><i class="fa fa-spinner fa-spin fa-2x text-primary"></i><p class="mt-2 text-muted">Loading details...</p></div>';
  
  const modal = new bootstrap.Modal(modalEl);
  modal.show();

  try {
    // Fetch scan details
    // Note: We might need a dedicated endpoint for single scan details if the list endpoint doesn't provide enough info.
    // For now, we'll fetch the list and filter, or assume we have enough info if we passed the object.
    // But since we only passed ID, let's fetch the list again or create a new endpoint.
    // Let's try to find it in the recent scans list first if we have it in memory, 
    // but better to fetch fresh data.
    
    // Ideally: GET /api/v1/storage/scans/:id
    // But checking routes, we only have listScans.
    // Let's use listScans with a limit and filter client side for now, or just display what we can.
    // Actually, let's implement a proper fetch.
    
    const res = await fetch(`/api/v1/storage/scans?limit=50`); 
    const data = await res.json();
    
    if (data.status === 'success') {
        const scan = data.data.scans.find(s => s._id === scanId);
        
        if (scan) {
            const counts = scan.counts || {};
            const config = scan.config || {};
            
            contentEl.innerHTML = `
                <div class="row mb-4">
                    <div class="col-md-6">
                        <h6 class="text-muted text-uppercase small fw-bold">Status</h6>
                        <p>
                            ${renderStatusBadge(scan.status)}
                            ${scan.live ? '<span class="badge bg-success ms-1">Live</span>' : ''}
                        </p>
                        
                        <h6 class="text-muted text-uppercase small fw-bold mt-3">Timing</h6>
                        <ul class="list-unstyled small">
                            <li><strong>Started:</strong> ${new Date(scan.started_at).toLocaleString()}</li>
                            <li><strong>Finished:</strong> ${scan.finished_at ? new Date(scan.finished_at).toLocaleString() : '-'}</li>
                            <li><strong>Duration:</strong> ${scan.duration ? scan.duration + 's' : '-'}</li>
                        </ul>
                    </div>
                    <div class="col-md-6">
                        <h6 class="text-muted text-uppercase small fw-bold">Statistics</h6>
                        <ul class="list-group list-group-flush small">
                            <li class="list-group-item d-flex justify-content-between align-items-center px-0">
                                Files Seen
                                <span class="badge bg-primary rounded-pill">${counts.files_seen || counts.files_processed || 0}</span>
                            </li>
                            <li class="list-group-item d-flex justify-content-between align-items-center px-0">
                                Upserted
                                <span class="badge bg-success rounded-pill">${(counts.inserted || 0) + (counts.updated || 0) + (counts.upserts || 0)}</span>
                            </li>
                            <li class="list-group-item d-flex justify-content-between align-items-center px-0">
                                Errors
                                <span class="badge bg-danger rounded-pill">${counts.errors || 0}</span>
                            </li>
                             <li class="list-group-item d-flex justify-content-between align-items-center px-0">
                                Batches
                                <span class="badge bg-secondary rounded-pill">${counts.batches || 0}</span>
                            </li>
                        </ul>
                    </div>
                </div>
                
                <div class="mb-3">
                    <h6 class="text-muted text-uppercase small fw-bold">Configuration</h6>
                    <div class="bg-light p-3 rounded border small">
                        <div class="mb-2"><strong>Roots:</strong><br><code>${(config.roots || []).join('<br>')}</code></div>
                        <div class="mb-2"><strong>Extensions:</strong> <code>${(config.extensions || []).join(', ')}</code></div>
                        <div><strong>Batch Size:</strong> ${config.batch_size || 'N/A'}</div>
                    </div>
                </div>

                ${scan.last_error ? `
                <div class="alert alert-danger small">
                    <strong>Last Error:</strong> ${escapeHtml(scan.last_error)}
                </div>
                ` : ''}
                
                ${scan.status === 'running' ? `
                <div class="text-end mt-3 border-top pt-3">
                    <button class="btn btn-danger" onclick="stopScan('${scan._id}'); bootstrap.Modal.getInstance(document.getElementById('scanDetailsModal')).hide();">
                        <i class="fa fa-stop me-1"></i> Stop Scan
                    </button>
                </div>
                ` : ''}
            `;
        } else {
            contentEl.innerHTML = '<div class="alert alert-warning">Scan details not found.</div>';
        }
    } else {
        contentEl.innerHTML = '<div class="alert alert-danger">Failed to load scan details.</div>';
    }
  } catch (err) {
    console.error(err);
    contentEl.innerHTML = `<div class="alert alert-danger">Error: ${err.message}</div>`;
  }
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
                const safeName = escapeHtml(file.filename);
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
                        <a href="/exports/${safeName}" download class="btn btn-sm btn-link text-primary p-0 me-1" title="Download">
                            <i class="fa fa-download"></i>
                        </a>
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
        // Removed tab switching logic since we are now side-by-side
        
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
