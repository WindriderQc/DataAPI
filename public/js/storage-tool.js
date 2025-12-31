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
  document.getElementById('startScanBtn').addEventListener('click', async () => {
    const roots = document.getElementById('rootDirs').value.split('\n').filter(p => p.trim() !== '');
    const extensions = document.getElementById('fileExts').value.split(',').map(e => e.trim());
    const batchSize = parseInt(document.getElementById('batchSize').value, 10);

    if (roots.length === 0) {
      alert('Please specify at least one root directory.');
      return;
    }

    try {
      const res = await fetch('/api/v1/storage/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roots, extensions, batchSize })
      });

      const data = await res.json();
      if (data.status === 'success') {
        alert('Scan started successfully! Scan ID: ' + data.scanId);
        loadRecentScans();
      } else {
        alert('Error starting scan: ' + (data.message || 'Unknown error'));
      }
    } catch (err) {
      console.error(err);
      alert('Network error starting scan.');
    }
  });

  // SMB Mount Toggle (Simple accordion behavior if needed, usually handled by Bootstrap)

  // Test N8n Connection Button
  const testN8nBtn = document.getElementById('testN8nBtn');
  if (testN8nBtn) {
    testN8nBtn.addEventListener('click', async () => {
      try {
        testN8nBtn.disabled = true;
        testN8nBtn.textContent = 'Testing...';

        const res = await fetch('/api/v1/storage/n8n/test', {
          method: 'POST'
        });
        const data = await res.json();

        if (data.status === 'success') {
          alert('Test webhook sent successfully! Check n8n execution log.');
          loadN8nStatus(); // Refresh events
        } else {
          alert('Error sending test webhook: ' + (data.message || 'Unknown error'));
        }
      } catch (err) {
        console.error(err);
        alert('Network error testing connection.');
      } finally {
        testN8nBtn.disabled = false;
        testN8nBtn.textContent = 'Test Connection';
      }
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

      // Update DOM elements
      document.getElementById('sys-cpu').textContent = stats.cpu.toFixed(1) + '%';
      document.getElementById('sys-mem').textContent = Math.round(stats.memory / 1024 / 1024) + ' MB';
      document.getElementById('sys-load').textContent = stats.loadAvg[0].toFixed(2);

      // Format uptime
      const uptimeHrs = Math.floor(stats.uptime / 3600);
      const uptimeMins = Math.floor((stats.uptime % 3600) / 60);
      document.getElementById('sys-uptime').textContent = `${uptimeHrs}h ${uptimeMins}m`;

      // Update timestamp
      document.getElementById('sys-updated').textContent = 'Updated: ' + new Date().toLocaleTimeString();
    }
  } catch (err) {
    // console.warn('Failed to fetch system resources', err);
  }
}

async function loadRecentScans() {
  const container = document.getElementById('recentScansBody');
  if (!container) return;

  try {
    // Fetch generic collection items for 'scans'
    // Note: If you have a specific endpoint for scans, use that.
    // Otherwise we might need to use the generic collection API if allowed,
    // or the storage controller should provide a history endpoint.
    // Assuming /api/v1/collection/scans/items works and is allowed:
    
    // However, the prompt implies we might not have a direct endpoint for listing scans in the snippet provided.
    // Let's assume we implemented one or use the generic one.
    // The storageController in the original code didn't have a 'list' method exposed.
    // But typically we can query the 'scans' collection via the generic API if 'scans' is in the allowlist.
    
    // For now, let's try to fetch from the generic endpoint.
    const res = await fetch('/api/v1/collection/scans/items?limit=10&sort=-created_at');
    const data = await res.json();
    
    if (data.status === 'success') {
      const scans = data.data;
      if (scans.length === 0) {
        container.innerHTML = '<tr><td colspan="8" class="text-center">No recent scans found.</td></tr>';
        return;
      }

      container.innerHTML = scans.map(scan => `
        <tr>
          <td><span class="text-danger">${scan._id}</span></td>
          <td>${renderStatusBadge(scan.status)}</td>
          <td>${scan.files_found || 0}</td>
          <td>${scan.files_processed || 0}</td>
          <td>${scan.errors || 0}</td>
          <td>${new Date(scan.created_at).toLocaleString()}</td>
          <td>${calculateDuration(scan.created_at, scan.finished_at)}</td>
          <td>
            <button class="btn btn-sm btn-outline-primary" onclick="viewScanDetails('${scan._id}')">
              <i class="fas fa-eye"></i>
            </button>
             ${scan.status === 'running' ? `
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
  // If backend supports it, fetch status here.
}

async function loadN8nStatus() {
  try {
    const res = await fetch('/api/v1/storage/n8n/status');
    const data = await res.json();
    
    if (data.status === 'success') {
      const { configured, url, events } = data.data;

      // Update Status Badge
      const statusBadge = document.getElementById('n8nStatusBadge');
      const configUrl = document.getElementById('n8nConfigUrl');

      if (configured) {
        statusBadge.innerHTML = '<span class="badge bg-success">Active</span>';
        configUrl.textContent = url;
      } else {
        statusBadge.innerHTML = '<span class="badge bg-warning text-dark">Not Configured</span>';
        configUrl.textContent = 'None';
      }

      // Update Events Table
      const tbody = document.getElementById('n8nEventsBody');
      if (events && events.length > 0) {
        tbody.innerHTML = events.map(e => `
          <tr>
            <td>${new Date(e.created_at).toLocaleString()}</td>
            <td>${escapeHtml(e.type)}</td>
            <td class="text-truncate" style="max-width: 300px;" title="${escapeHtml(e.message)}">
              ${escapeHtml(e.message)}
            </td>
            <td>
              <span class="badge ${e.status === 'success' ? 'bg-success' : 'bg-danger'}">
                ${escapeHtml(e.status)}
              </span>
            </td>
          </tr>
        `).join('');
      } else {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No recent integration events.</td></tr>';
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
  // Implement scan details view if needed, or redirect
  alert('Details for scan ' + scanId);
}
