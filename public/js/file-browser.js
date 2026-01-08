import { formatFileSize, formatDate } from './utils/index.js';

const FileBrowser = {
  currentPage: 1,
  
  async init() {
    await this.loadHeaderStats();
    // Initialize search and browse
    this.setupEventListeners();
    await this.browseFiles();
  },

  async loadHeaderStats() {
    try {
      const statsRes = await fetch('/api/v1/files/stats');
      const stats = await statsRes.json();

      if (stats.status === 'success') {
        document.getElementById('totalFiles').textContent = 
          stats.data.total.count.toLocaleString();
        document.getElementById('totalSize').textContent = 
          formatFileSize(stats.data.total.totalSize);
        document.getElementById('totalExtensions').textContent = 
          stats.data.byExtension.length;
        
        // Populate extension filter
        const extFilter = document.getElementById('extensionFilter');
        stats.data.byExtension.forEach(ext => {
          const option = document.createElement('option');
          option.value = ext.extension;
          option.textContent = `${ext.extension} (${ext.count})`;
          extFilter.appendChild(option);
        });
      }
    } catch (error) {
      console.error('Failed to load header stats:', error);
    }
  },

  async search(page = 1) {
    try {
      const search = document.getElementById('searchInput').value;
      const ext = document.getElementById('extFilter').value;
      const dirname = document.getElementById('dirFilter').value;
      const sizeFilter = document.getElementById('sizeFilter').value;
      const sortBy = document.getElementById('sortBy').value;

      const params = new URLSearchParams({
        search,
        ext,
        dirname,
        sortBy,
        page,
        limit: 50
      });

      // Handle size filter
      if (sizeFilter === 'large') {
        params.append('minSize', 104857600); // 100MB
      } else if (sizeFilter === 'medium') {
        params.append('minSize', 10485760); // 10MB
        params.append('maxSize', 104857600);
      } else if (sizeFilter === 'small') {
        params.append('maxSize', 10485760);
      }

      const response = await fetch(`/api/v1/files/browse?${params}`);
      const data = await response.json();
      
      this.displayFiles(data.data);
      this.currentPage = page;
    } catch (error) {
      console.error('Failed to search files:', error);
      this.showError('Failed to search files');
    }
  },

  displayFiles(data) {
    const tbody = document.getElementById('filesTableBody');
    const resultCount = document.getElementById('resultCount');
    
    resultCount.textContent = data.pagination.total;

    if (data.files.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center text-muted">No files found</td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = data.files.map(file => `
      <tr class="file-row">
        <td>
          <i class="fas fa-file me-2 text-muted"></i>
          <strong>${this.escapeHtml(file.filename)}</strong>
        </td>
        <td><small class="text-muted">${this.escapeHtml(file.dirname)}</small></td>
        <td><span class="badge bg-secondary">${file.ext || 'none'}</span></td>
        <td><code class="size-badge">${file.sizeFormatted}</code></td>
        <td><small>${formatDate(new Date(file.mtimeFormatted))}</small></td>
      </tr>
    `).join('');

    this.renderPagination(data.pagination);
  },

  renderPagination(pagination) {
    const container = document.getElementById('pagination');
    const { page, pages } = pagination;

    if (pages <= 1) {
      container.innerHTML = '';
      return;
    }

    const buttons = [];
    const maxButtons = 5;
    let start = Math.max(1, page - Math.floor(maxButtons / 2));
    let end = Math.min(pages, start + maxButtons - 1);

    if (end - start < maxButtons - 1) {
      start = Math.max(1, end - maxButtons + 1);
    }

    buttons.push(`
      <button class="btn btn-sm btn-outline-primary" 
        onclick="FileBrowser.search(${page - 1})" 
        ${page === 1 ? 'disabled' : ''}>
        <i class="fas fa-chevron-left"></i>
      </button>
    `);

    for (let i = start; i <= end; i++) {
      buttons.push(`
        <button class="btn btn-sm ${i === page ? 'btn-primary' : 'btn-outline-primary'}" 
          onclick="FileBrowser.search(${i})">
          ${i}
        </button>
      `);
    }

    buttons.push(`
      <button class="btn btn-sm btn-outline-primary" 
        onclick="FileBrowser.search(${page + 1})" 
        ${page === pages ? 'disabled' : ''}>
        <i class="fas fa-chevron-right"></i>
      </button>
    `);

    container.innerHTML = `
      <div class="btn-group" role="group">
        ${buttons.join('')}
      </div>
      <small class="ms-3 text-muted">
        Page ${page} of ${pages}
      </small>
    `;
  },

  async loadStats() {
    try {
      const response = await fetch('/api/v1/files/stats');
      const result = await response.json();
      const { byExtension, sizeCategories, total } = result.data;

      this.renderExtensionChart(byExtension);
      this.renderSizeChart(sizeCategories);
      this.renderExtensionTable(byExtension, total.totalSize);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  },

  renderExtensionChart(extensions) {
    const ctx = document.getElementById('extensionChart');
    
    if (this.charts.extension) {
      this.charts.extension.destroy();
    }

    this.charts.extension = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: extensions.map(e => e.extension),
        datasets: [{
          data: extensions.map(e => e.size),
          backgroundColor: [
            '#667eea', '#764ba2', '#f093fb', '#4facfe',
            '#43e97b', '#fa709a', '#fee140', '#30cfd0',
            '#a8edea', '#fed6e3'
          ]
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'right' },
          tooltip: {
            callbacks: {
              label: (context) => {
                return `${context.label}: ${formatFileSize(context.raw)}`;
              }
            }
          }
        }
      }
    });
  },

  renderSizeChart(categories) {
    const ctx = document.getElementById('sizeChart');
    
    if (this.charts.size) {
      this.charts.size.destroy();
    }

    this.charts.size = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: Object.keys(categories),
        datasets: [{
          label: 'Number of Files',
          data: Object.values(categories),
          backgroundColor: '#667eea'
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: { beginAtZero: true }
        }
      }
    });
  },

  renderExtensionTable(extensions, totalSize) {
    const tbody = document.getElementById('extensionTableBody');
    
    tbody.innerHTML = extensions.map(ext => {
      const percentage = ((ext.size / totalSize) * 100).toFixed(2);
      return `
        <tr>
          <td><code>.${ext.extension}</code></td>
          <td>${ext.count.toLocaleString()}</td>
          <td><strong>${ext.sizeFormatted}</strong></td>
          <td>
            <div class="progress" style="height: 20px;">
              <div class="progress-bar" role="progressbar" 
                style="width: ${percentage}%"
                aria-valuenow="${percentage}" aria-valuemin="0" aria-valuemax="100">
                ${percentage}%
              </div>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  async loadDuplicates() {
    try {
      const response = await fetch('/api/v1/files/duplicates');
      const result = await response.json();
      const container = document.getElementById('duplicatesList');

      if (result.data.duplicates.length === 0) {
        container.innerHTML = `
          <div class="alert alert-success">
            <i class="fas fa-check-circle"></i>
            No duplicate files found!
          </div>
        `;
        return;
      }

      container.innerHTML = result.data.duplicates.map((dup, index) => `
        <div class="card mb-3">
          <div class="card-header d-flex justify-content-between align-items-center">
            <div>
              <strong>${this.escapeHtml(dup.filename)}</strong>
              <span class="badge duplicate-badge ms-2">${dup.count} copies</span>
            </div>
            <div>
              <span class="text-danger">
                <i class="fas fa-exclamation-triangle"></i>
                Wasted: ${dup.wastedSpaceFormatted}
              </span>
            </div>
          </div>
          <div class="card-body">
            <p><strong>File size:</strong> ${dup.sizeFormatted}</p>
            <p><strong>Locations:</strong></p>
            <ul class="list-unstyled">
              ${dup.locations.map(loc => `
                <li><code>${this.escapeHtml(loc.path || this.joinPath(loc.dirname, dup.filename))}</code></li>
              `).join('')}
            </ul>
          </div>
        </div>
      `).join('');
    } catch (error) {
      console.error('Failed to load duplicates:', error);
      this.showError('Failed to load duplicates');
    }
  },

  async loadCleanupRecommendations() {
    try {
      const response = await fetch('/api/v1/files/cleanup-recommendations');
      const result = await response.json();
      const container = document.getElementById('recommendationsList');

      container.innerHTML = result.data.recommendations.map(rec => `
        <div class="card recommendation-card recommendation-${rec.priority} mb-3">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start">
              <div>
                <h5>
                  <i class="fas ${this.getRecommendationIcon(rec.type)}"></i>
                  ${rec.message}
                </h5>
                <p class="text-muted">${this.getRecommendationDescription(rec.type)}</p>
              </div>
              <span class="badge bg-${rec.priority === 'high' ? 'danger' : 'warning'}">
                ${rec.priority.toUpperCase()}
              </span>
            </div>
            ${rec.potentialSavings ? `
              <div class="alert alert-warning mt-3">
                <strong>Potential savings:</strong> ${formatFileSize(rec.potentialSavings)}
              </div>
            ` : ''}
            ${rec.files ? `
              <details class="mt-3">
                <summary class="btn btn-sm btn-outline-primary">View files (${rec.files.length})</summary>
                <ul class="list-group mt-2">
                  ${rec.files.slice(0, 10).map(f => `
                    <li class="list-group-item d-flex justify-content-between align-items-center">
                      <code>${this.escapeHtml(f.path || '')}</code>
                      <span class="badge bg-secondary">${f.sizeFormatted || f.size}</span>
                    </li>
                  `).join('')}
                </ul>
              </details>
            ` : `<p class="mt-2">${rec.action}</p>`}
          </div>
        </div>
      `).join('');
    } catch (error) {
      console.error('Failed to load recommendations:', error);
      this.showError('Failed to load recommendations');
    }
  },

  getRecommendationIcon(type) {
    const icons = {
      large_files: 'fa-file-archive',
      old_files: 'fa-clock',
      duplicates: 'fa-clone'
    };
    return icons[type] || 'fa-info-circle';
  },

  getRecommendationDescription(type) {
    const descriptions = {
      large_files: 'Large files consume significant storage space. Review and archive or compress if possible.',
      old_files: 'Old files may no longer be needed. Consider archiving or removing files not accessed recently.',
      duplicates: 'Duplicate files waste storage space. Review and keep only necessary copies.'
    };
    return descriptions[type] || '';
  },

  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  },

  joinPath(dirname, filename) {
    if (!dirname) {
      return filename || '';
    }
    const normalizedDir = dirname.endsWith('/') ? dirname : `${dirname}/`;
    return `${normalizedDir}${filename || ''}`;
  },

  showError(message) {
    // Simple error display - could be enhanced with a toast notification
    console.error(message);
    alert(message);
  }
};

// Make FileBrowser globally available for inline onclick handlers
window.FileBrowser = FileBrowser;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => FileBrowser.init());

export default FileBrowser;
