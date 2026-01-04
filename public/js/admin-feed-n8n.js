import { PollingController } from './utils/polling-controller.js';

let n8nEvents = [];
let workflowFilter = '';
let eventTypeFilter = '';

function formatTimestamp(ts) {
  const d = new Date(ts);
  return d.toLocaleString('en-CA', { hour12: false }).replace(',', '');
}

function renderN8nEvents() {
  const container = document.getElementById('n8n-events');
  if (!container) return;

  const filtered = n8nEvents.filter((evt) => {
    if (workflowFilter && evt?.body?.workflow_id !== workflowFilter) return false;
    if (eventTypeFilter && evt?.body?.event_type !== eventTypeFilter) return false;
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = '<div style="color:#94a3b8; text-align:center; padding:20px;">No events yet</div>';
    return;
  }

  container.innerHTML = filtered.slice(0, 50).map((evt) => {
    const wf = evt?.body?.workflow_id || 'unknown';
    const et = evt?.body?.event_type || 'event';
    const ts = formatTimestamp(evt.at);
    const data = JSON.stringify(evt?.body?.data || {}, null, 2);

    return `<div class="n8n-event">
        <div class="n8n-event-header">
            <div>
                <span class="n8n-workflow-id">${wf}</span>
                <span class="n8n-event-type"> • ${et}</span>
            </div>
            <span class="n8n-timestamp">${ts}</span>
        </div>
        <div class="n8n-data">${data}</div>
    </div>`;
  }).join('');
}

function updateFilters() {
  const workflowIds = [...new Set(n8nEvents.map((e) => e?.body?.workflow_id).filter(Boolean))];
  const eventTypes = [...new Set(n8nEvents.map((e) => e?.body?.event_type).filter(Boolean))];

  const wfSelect = document.getElementById('workflow-filter');
  const etSelect = document.getElementById('event-type-filter');

  if (wfSelect) {
    const currentWf = wfSelect.value;
    wfSelect.innerHTML = '<option value="">All Workflows</option>' +
      workflowIds.map((id) => `<option value="${id}"${id === currentWf ? ' selected' : ''}>${id}</option>`).join('');
  }

  if (etSelect) {
    const currentEt = etSelect.value;
    etSelect.innerHTML = '<option value="">All Event Types</option>' +
      eventTypes.map((t) => `<option value="${t}"${t === currentEt ? ' selected' : ''}>${t}</option>`).join('');
  }
}

async function loadN8nEvents() {
  try {
    const res = await fetch('/api/v1/integrations/events/n8n');
    if (!res.ok) return;

    n8nEvents = await res.json();
    updateFilters();
    renderN8nEvents();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to load n8n events:', err);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const wfSelect = document.getElementById('workflow-filter');
  const etSelect = document.getElementById('event-type-filter');

  if (wfSelect) {
    wfSelect.addEventListener('change', (e) => {
      workflowFilter = e.target.value;
      renderN8nEvents();
    });
  }

  if (etSelect) {
    etSelect.addEventListener('change', (e) => {
      eventTypeFilter = e.target.value;
      renderN8nEvents();
    });
  }

  loadN8nEvents();

  const poller = new PollingController();
  poller.addTask('n8n-events', loadN8nEvents, 10000, { runOnStart: false });
  poller.start();
});
