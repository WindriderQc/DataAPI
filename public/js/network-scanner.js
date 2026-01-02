document.addEventListener('DOMContentLoaded', () => {
    const scanForm = document.getElementById('scanForm');
    const scanBtn = document.getElementById('scanBtn');
    const scanStatus = document.getElementById('scanStatus');
    const deviceListBody = document.getElementById('deviceListBody');
    const refreshBtn = document.getElementById('refreshBtn');

    // Modal elements
    const editModalEl = document.getElementById('editDeviceModal');
    // We need to manage modal instance manually if using Bootstrap 5 vanilla
    // but assuming standard BS5 inclusion in footer/head
    let editModal;
    if (window.bootstrap) {
        editModal = new bootstrap.Modal(editModalEl);
    }

    const saveDeviceBtn = document.getElementById('saveDeviceBtn');

    // Helper: Format Date
    const formatDate = (isoString) => {
        if (!isoString) return 'Never';
        return new Date(isoString).toLocaleString();
    };

    // Helper: Render Status Icon
    const renderStatus = (status) => {
        if (status === 'online') return '<i class="fa fa-circle status-online" title="Online"></i>';
        return '<i class="fa fa-circle status-offline" title="Offline"></i>';
    };

    // Load Devices
    const loadDevices = async () => {
        try {
            const response = await fetch('/api/v1/network/devices');
            if (!response.ok) throw new Error('Failed to load devices');
            const data = await response.json();

            renderDevices(data.data.devices);
        } catch (error) {
            console.error('Error loading devices:', error);
            // Show toast or alert?
        }
    };

    // Render Device Table
    const renderDevices = (devices) => {
        deviceListBody.innerHTML = '';
        if (devices.length === 0) {
            deviceListBody.innerHTML = '<tr><td colspan="8" class="text-center">No devices found. Run a scan.</td></tr>';
            return;
        }

        devices.forEach(device => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${renderStatus(device.status)}</td>
                <td>${device.ip}</td>
                <td class="font-monospace">${device.mac}</td>
                <td>${device.hostname || '-'}</td>
                <td>${device.vendor || '-'}</td>
                <td>${device.alias || '-'}</td>
                <td>${formatDate(device.lastSeen)}</td>
                <td>
                    <button class="btn btn-sm btn-info edit-btn" data-id="${device._id}"><i class="fa fa-edit"></i></button>
                    <button class="btn btn-sm btn-warning enrich-btn" data-id="${device._id}" title="Deep Scan (OS/Services)"><i class="fa fa-search-plus"></i></button>
                </td>
            `;
            deviceListBody.appendChild(tr);

            // Attach event listeners for this row
            tr.querySelector('.edit-btn').addEventListener('click', () => openEditModal(device));
            tr.querySelector('.enrich-btn').addEventListener('click', () => enrichDevice(device._id));
        });
    };

    // Scan Network
    scanForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const target = document.getElementById('scanTarget').value;

        if (!target) return;

        setScanningState(true);

        try {
            const response = await fetch('/api/v1/network/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target })
            });

            const result = await response.json();

            if (response.ok) {
                // Success message
                console.log('Scan complete:', result);
                loadDevices();
            } else {
                alert('Scan failed: ' + result.message);
            }

        } catch (error) {
            console.error('Scan error:', error);
            alert('Scan error: ' + error.message);
        } finally {
            setScanningState(false);
        }
    });

    const setScanningState = (isScanning) => {
        if (isScanning) {
            scanBtn.disabled = true;
            scanBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Scanning...';
            scanStatus.textContent = 'Scanning...';
            scanStatus.className = 'badge bg-warning text-dark';
        } else {
            scanBtn.disabled = false;
            scanBtn.innerHTML = '<i class="fa fa-radar"></i> Scan Now';
            scanStatus.textContent = 'Idle';
            scanStatus.className = 'badge bg-secondary';
        }
    };

    // Enrich Device
    const enrichDevice = async (id) => {
        if (!confirm('Run deep scan (OS detection) on this device? This may take a minute.')) return;

        try {
            // Show some loading indicator on the row? For now just simple flow.
            const response = await fetch(`/api/v1/network/devices/${id}/enrich`, { method: 'POST' });
            if (response.ok) {
                alert('Enrichment complete!');
                loadDevices();
            } else {
                const err = await response.json();
                alert('Enrichment failed: ' + err.message);
            }
        } catch (error) {
            alert('Error: ' + error.message);
        }
    };

    // Edit Device Logic
    const openEditModal = (device) => {
        document.getElementById('editDeviceId').value = device._id;
        document.getElementById('editDeviceMac').value = device.mac;
        document.getElementById('editDeviceAlias').value = device.alias || '';
        document.getElementById('editDeviceLocation').value = device.location || '';
        document.getElementById('editDeviceNotes').value = device.notes || '';
        document.getElementById('editDeviceType').value = (device.hardware && device.hardware.type) ? device.hardware.type : 'unknown';

        if (editModal) editModal.show();
    };

    saveDeviceBtn.addEventListener('click', async () => {
        const id = document.getElementById('editDeviceId').value;
        const alias = document.getElementById('editDeviceAlias').value;
        const location = document.getElementById('editDeviceLocation').value;
        const notes = document.getElementById('editDeviceNotes').value;
        const type = document.getElementById('editDeviceType').value;

        try {
            const response = await fetch(`/api/v1/network/devices/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ alias, location, notes, type })
            });

            if (response.ok) {
                if (editModal) editModal.hide();
                loadDevices();
            } else {
                alert('Failed to update device');
            }
        } catch (error) {
            console.error(error);
        }
    });

    refreshBtn.addEventListener('click', loadDevices);

    // Initial Load
    loadDevices();
});
