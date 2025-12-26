// Storage Tool Client-Side Logic

import { formatFileSize } from '/js/utils/general-utils.js';

let currentScanId = null;
let pollInterval = null;

// Start a new scan
async function startScan() {
    const roots = document.getElementById('scanRoots').value
        .split('\n')
        .map(r => r.trim())
        .filter(r => r.length > 0);
    
    const extensions = document.getElementById('scanExtensions').value
        .split(',')
        .map(e => e.trim())
        .filter(e => e.length > 0);
    
    const batchSize = parseInt(document.getElementById('batchSize').value);

    if (roots.length === 0) {
        alert('Please enter at least one root directory');
        return;
    }

    if (extensions.length === 0) {
        alert('Please enter at least one file extension');
        return;
    }

    const startBtn = document.getElementById('startScanBtn');
    startBtn.disabled = true;
    startBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Starting...';

    try {
        const response = await fetch('/api/v1/storage/scan', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                roots,
                extensions,
                batch_size: batchSize
            })
        });

        const data = await response.json();

        if (data.status === 'success') {
            currentScanId = data.data.scan_id;
            document.getElementById('currentScanSection').style.display = 'block';
            document.getElementById('currentScanId').textContent = currentScanId;
            
            // Start polling for updates
            startPolling();
            
            // Show success message
            showNotification('Scan started successfully!', 'success');
        } else {
            alert('Error: ' + data.message);
        }
    } catch (error) {
        console.error('Error starting scan:', error);
        alert('Failed to start scan: ' + error.message);
    } finally {
        startBtn.disabled = false;
        startBtn.innerHTML = '<i class="fa fa-play"></i> Start Scan';
    }
}

// Stop current scan
async function stopCurrentScan() {
    if (!currentScanId) return;

    if (!confirm('Are you sure you want to stop this scan?')) {
        return;
    }

    try {
        const response = await fetch(`/api/v1/storage/stop/${currentScanId}`, {
            method: 'POST',
            credentials: 'include'
        });

        const data = await response.json();

        if (data.status === 'success') {
            showNotification('Stop request sent', 'info');
        } else {
            showNotification(data.message, 'warning');
        }
    } catch (error) {
        console.error('Error stopping scan:', error);
        alert('Failed to stop scan: ' + error.message);
    }
}

// Start polling for scan status
function startPolling() {
    if (pollInterval) {
        clearInterval(pollInterval);
    }
    
    // Poll every 5 seconds (avoid rate limiting)
    pollInterval = setInterval(updateScanStatus, 5000);
    
    // Update immediately
    updateScanStatus();
}

// Stop polling
function stopPolling() {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
}

// Update scan status from API
async function updateScanStatus() {
    if (!currentScanId) return;

    try {
        const response = await fetch(`/api/v1/storage/status/${currentScanId}`, {
            credentials: 'include'
        });
        const data = await response.json();

        if (data.status === 'success') {
            const scan = data.data;
            
            // Update status badge
            const statusBadge = document.getElementById('currentScanStatus');
            statusBadge.textContent = scan.status.charAt(0).toUpperCase() + scan.status.slice(1);
            statusBadge.className = 'badge status-badge ' + getStatusBadgeClass(scan.status);
            
            // Update live indicator
            const liveBadge = document.getElementById('currentScanLive');
            liveBadge.style.display = scan.live ? 'inline-block' : 'none';
            
            // Update counts
            document.getElementById('filesSeen').textContent = scan.counts?.files_seen || 0;
            document.getElementById('filesUpserted').textContent = scan.counts?.upserts || 0;
            document.getElementById('filesErrors').textContent = scan.counts?.errors || 0;
            
            // Update timestamps
            if (scan.started_at) {
                document.getElementById('scanStarted').textContent = new Date(scan.started_at).toLocaleString();
            }
            
            // Update progress bar (approximate based on activity)
            updateProgressBar(scan);
            
            // If scan is complete or stopped, stop polling and reload recent scans
            if (scan.status === 'complete' || scan.status === 'stopped') {
                stopPolling();
                setTimeout(() => {
                    loadRecentScans();
                    showCompletionNotification(scan);
                    // Hide the current scan section after showing completion
                    setTimeout(() => {
                        document.getElementById('currentScanSection').style.display = 'none';
                        currentScanId = null;
                    }, 3000); // Give user 3 seconds to see the completion state
                }, 1000);
            }
        }
    } catch (error) {
        console.error('Error fetching scan status:', error);
    }
}

// Update progress bar
function updateProgressBar(scan) {
    const progressBar = document.getElementById('scanProgress');
    const progressText = document.getElementById('progressText');
    
    if (scan.status === 'complete') {
        progressBar.style.width = '100%';
        progressBar.classList.remove('progress-bar-animated');
        progressText.textContent = `Complete: ${scan.counts?.files_seen || 0} files processed`;
    } else if (scan.status === 'stopped') {
        progressBar.classList.remove('progress-bar-animated');
        progressBar.classList.add('bg-warning');
        progressText.textContent = `Stopped: ${scan.counts?.files_seen || 0} files processed`;
    } else if (scan.live) {
        // Keep it animated while running
        progressBar.style.width = '75%';
        progressText.textContent = `Processing: ${scan.counts?.files_seen || 0} files...`;
    } else {
        progressBar.style.width = '50%';
        progressText.textContent = 'Starting...';
    }
}

// Get badge class based on status
function getStatusBadgeClass(status) {
    switch(status) {
        case 'running': return 'bg-primary';
        case 'complete': return 'bg-success';
        case 'stopped': return 'bg-warning';
        default: return 'bg-secondary';
    }
}

// Show completion notification
function showCompletionNotification(scan) {
    const message = scan.status === 'complete' 
        ? `Scan completed! Processed ${scan.counts?.files_seen || 0} files with ${scan.counts?.errors || 0} errors.`
        : `Scan stopped. Processed ${scan.counts?.files_seen || 0} files.`;
    
    showNotification(message, scan.status === 'complete' ? 'success' : 'warning');
}

// Load recent scans
async function loadRecentScans() {
    const tbody = document.getElementById('recentScansBody');
    const refreshBtn = document.querySelector('button[onclick="loadRecentScans()"]');
    
    // Show loading state
    if (refreshBtn) {
        refreshBtn.disabled = true;
        refreshBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Loading...';
    }
    
    tbody.innerHTML = `
        <tr>
            <td colspan="8" class="text-center">
                <i class="fa fa-spinner fa-spin"></i> Loading recent scans...
            </td>
        </tr>
    `;
    
    try {
        const response = await fetch('/api/v1/storage/scans?limit=20', {
            credentials: 'include'
        });
        const data = await response.json();
        
        if (data.status === 'success' && data.data.scans.length > 0) {
            tbody.innerHTML = data.data.scans.map(scan => {
                const statusClass = scan.status === 'complete' ? 'success' 
                                  : scan.status === 'running' ? 'primary'
                                  : scan.status === 'stopped' ? 'warning'
                                  : 'secondary';
                
                const duration = scan.duration ? `${scan.duration}s` : '-';
                const startedAt = new Date(scan.started_at).toLocaleString();
                
                return `
                    <tr>
                        <td><code class="small">${scan._id}</code></td>
                        <td>
                            <span class="badge bg-${statusClass}">${scan.status}</span>
                            ${scan.live ? '<span class="badge bg-success ms-1"><i class="fa fa-circle"></i> Live</span>' : ''}
                        </td>
                        <td>${scan.counts?.files_seen || 0}</td>
                        <td>${scan.counts?.upserts || 0}</td>
                        <td>${scan.counts?.errors || 0}</td>
                        <td>${startedAt}</td>
                        <td>${duration}</td>
                        <td>
                            <button class="btn btn-sm btn-outline-primary" onclick="viewScanDetails('${scan._id}')" title="View Details">
                                <i class="fa fa-eye"></i>
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
            showNotification('Recent scans refreshed', 'success');
        } else {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center text-muted">
                        <em>No scans found. Start your first scan above!</em>
                    </td>
                </tr>
            `;
        }
    } catch (error) {
        console.error('Error loading recent scans:', error);
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center text-danger">
                    <i class="fa fa-exclamation-triangle"></i> Failed to load recent scans
                </td>
            </tr>
        `;
        showNotification('Failed to refresh scans', 'danger');
    } finally {
        // Restore button state
        if (refreshBtn) {
            refreshBtn.disabled = false;
            refreshBtn.innerHTML = '<i class="fa fa-refresh"></i> Refresh';
        }
    }
}

// View scan details in modal
async function viewScanDetails(scanId) {
    const modal = new bootstrap.Modal(document.getElementById('scanDetailsModal'));
    const content = document.getElementById('scanDetailsContent');
    
    // Show modal with loading state
    modal.show();
    content.innerHTML = `
        <div class="text-center py-5">
            <i class="fa fa-spinner fa-spin fa-3x text-primary"></i>
            <p class="mt-3">Loading scan details...</p>
        </div>
    `;
    
    try {
        const response = await fetch(`/api/v1/storage/status/${scanId}`, {
            credentials: 'include'
        });
        const data = await response.json();
        
        if (data.status === 'success') {
            const scan = data.data;
            
            // Calculate duration
            let duration = '-';
            if (scan.started_at) {
                const start = new Date(scan.started_at);
                const end = scan.finished_at ? new Date(scan.finished_at) : new Date();
                duration = ((end - start) / 1000).toFixed(2) + 's';
            }
            
            // Format timestamps
            const startedAt = scan.started_at ? new Date(scan.started_at).toLocaleString() : '-';
            const finishedAt = scan.finished_at ? new Date(scan.finished_at).toLocaleString() : '-';
            
            // Status badge color
            const statusClass = scan.status === 'complete' ? 'success' 
                              : scan.status === 'running' ? 'primary'
                              : scan.status === 'stopped' ? 'warning'
                              : 'secondary';
            
            content.innerHTML = `
                <div class="container-fluid">
                    <!-- Status Overview -->
                    <div class="row mb-4">
                        <div class="col-12">
                            <div class="card">
                                <div class="card-body">
                                    <h6 class="card-title text-muted mb-3">Scan Overview</h6>
                                    <div class="row">
                                        <div class="col-md-6">
                                            <p><strong>Scan ID:</strong> <code>${scan._id}</code></p>
                                            <p><strong>Status:</strong> 
                                                <span class="badge bg-${statusClass}">${scan.status}</span>
                                                ${scan.live ? '<span class="badge bg-success ms-1"><i class="fa fa-circle"></i> Live</span>' : ''}
                                            </p>
                                        </div>
                                        <div class="col-md-6">
                                            <p><strong>Started:</strong> ${startedAt}</p>
                                            <p><strong>Finished:</strong> ${finishedAt}</p>
                                            <p><strong>Duration:</strong> ${duration}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Statistics -->
                    <div class="row mb-4">
                        <div class="col-md-3">
                            <div class="card text-center">
                                <div class="card-body">
                                    <i class="fa fa-file fa-2x text-primary mb-2"></i>
                                    <h4 class="mb-0">${scan.counts?.files_seen || 0}</h4>
                                    <small class="text-muted">Files Scanned</small>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="card text-center">
                                <div class="card-body">
                                    <i class="fa fa-check fa-2x text-success mb-2"></i>
                                    <h4 class="mb-0">${scan.counts?.upserts || 0}</h4>
                                    <small class="text-muted">Upserted</small>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="card text-center">
                                <div class="card-body">
                                    <i class="fa fa-exclamation-triangle fa-2x text-warning mb-2"></i>
                                    <h4 class="mb-0">${scan.counts?.errors || 0}</h4>
                                    <small class="text-muted">Errors</small>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="card text-center">
                                <div class="card-body">
                                    <i class="fa fa-database fa-2x text-info mb-2"></i>
                                    <h4 class="mb-0">${scan.counts?.batches || 0}</h4>
                                    <small class="text-muted">Batches</small>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Configuration -->
                    <div class="row mb-4">
                        <div class="col-12">
                            <div class="card">
                                <div class="card-body">
                                    <h6 class="card-title text-muted mb-3">Scan Configuration</h6>
                                    <div class="row">
                                        <div class="col-md-6">
                                            <p><strong>Root Directories:</strong></p>
                                            <ul class="small">
                                                ${scan.config?.roots?.map(r => `<li><code>${r}</code></li>`).join('') || '<li>None specified</li>'}
                                            </ul>
                                        </div>
                                        <div class="col-md-6">
                                            <p><strong>File Extensions:</strong></p>
                                            <p class="small">
                                                ${scan.config?.extensions?.map(e => `<span class="badge bg-secondary me-1">${e}</span>`).join('') || 'None specified'}
                                            </p>
                                            <p><strong>Batch Size:</strong> ${scan.config?.batch_size || 'N/A'}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Errors (if any) -->
                    ${scan.counts?.errors > 0 ? `
                    <div class="row">
                        <div class="col-12">
                            <div class="card border-warning">
                                <div class="card-body">
                                    <h6 class="card-title text-warning mb-3">
                                        <i class="fa fa-exclamation-triangle"></i> Errors Encountered
                                    </h6>
                                    <div class="alert alert-warning small mb-0">
                                        This scan encountered ${scan.counts.errors} error(s). 
                                        Check the server logs for detailed error information.
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    ` : ''}
                </div>
            `;
        } else {
            content.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fa fa-exclamation-triangle"></i> Failed to load scan details: ${data.message}
                </div>
            `;
        }
    } catch (error) {
        console.error('Error fetching scan details:', error);
        content.innerHTML = `
            <div class="alert alert-danger">
                <i class="fa fa-exclamation-triangle"></i> Error loading scan details: ${error.message}
            </div>
        `;
    }
}

// Show notification (simple implementation)
function showNotification(message, type = 'info') {
    const alertClass = type === 'success' ? 'alert-success' 
                     : type === 'warning' ? 'alert-warning'
                     : type === 'danger' ? 'alert-danger'
                     : 'alert-info';
    
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert ${alertClass} alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3`;
    alertDiv.style.zIndex = '9999';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(alertDiv);
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}

// Export functionality
async function generateExport() {
    const type = document.getElementById('exportType').value;
    const format = document.getElementById('exportFormat').value;
    const statusElement = document.getElementById('exportStatus');
    
    if (!type || !format) {
        alert('Please select both report type and format');
        return;
    }

    statusElement.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Generating...';

    try {
        const response = await fetch('/api/v1/files/export', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include', // Include session cookies
            body: JSON.stringify({
                type,
                format
            })
        });

        const data = await response.json();

        if (data.status === 'success') {
            statusElement.innerHTML = '<i class="fa fa-check text-success"></i> Generated!';
            showNotification(`Report generated: ${data.data.filename}`, 'success');
            
            // Refresh the exports list
            setTimeout(() => {
                loadExportList();
                statusElement.innerHTML = '';
            }, 2000);
        } else {
            statusElement.innerHTML = '<i class="fa fa-times text-danger"></i> Failed';
            showNotification('Error: ' + data.message, 'danger');
        }
    } catch (error) {
        console.error('Error generating export:', error);
        statusElement.innerHTML = '<i class="fa fa-times text-danger"></i> Error';
        showNotification('Failed to generate export: ' + error.message, 'danger');
    }
}

// Load available exports list
async function loadExportList() {
    const tbody = document.getElementById('exportsListBody');
    
    try {
        const response = await fetch('/api/v1/files/exports', {
            credentials: 'include'
        });
        const data = await response.json();

        if (data.status === 'success' && data.data.length > 0) {
            tbody.innerHTML = data.data.map(file => `
                <tr>
                    <td>
                        <i class="fa fa-file-${file.filename.endsWith('.csv') ? 'excel' : 'code'}-o"></i>
                        ${file.filename}
                    </td>
                    <td>${formatFileSize(file.size)}</td>
                    <td>${formatDate(file.created)}</td>
                    <td>
                        <a href="/exports/${file.filename}" class="btn btn-sm btn-success" download>
                            <i class="fa fa-download"></i> Download
                        </a>
                        <button class="btn btn-sm btn-outline-danger ms-1" onclick="deleteExport('${file.filename}')">
                            <i class="fa fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center text-muted">
                        <em>No export files found. Generate your first report above!</em>
                    </td>
                </tr>
            `;
        }
    } catch (error) {
        console.error('Error loading exports:', error);
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="text-center text-danger">
                    <i class="fa fa-exclamation-triangle"></i> Failed to load exports
                </td>
            </tr>
        `;
    }
}

// Delete an export file
async function deleteExport(filename) {
    if (!confirm(`Are you sure you want to delete ${filename}?`)) {
        return;
    }

    try {
        const response = await fetch(`/api/v1/files/exports/${filename}`, {
            method: 'DELETE',
            credentials: 'include'
        });

        const data = await response.json();

        if (data.status === 'success') {
            showNotification(`Deleted ${filename}`, 'success');
            loadExportList(); // Refresh the list
        } else {
            showNotification('Error: ' + data.message, 'danger');
        }
    } catch (error) {
        console.error('Error deleting export:', error);
        showNotification('Failed to delete file: ' + error.message, 'danger');
    }
}

// Format date for display
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString();
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    loadRecentScans();
    loadExportList(); // Load export list on page load
});

// Export functions to global scope for onclick handlers
window.startScan = startScan;
window.stopCurrentScan = stopCurrentScan;
window.generateExport = generateExport;
window.viewScanDetails = viewScanDetails;
window.deleteExport = deleteExport;
window.loadRecentScans = loadRecentScans;
window.loadExportList = loadExportList;
