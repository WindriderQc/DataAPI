import { DOM } from '/js/utils/index.js';

document.addEventListener('DOMContentLoaded', () => {
    // userList and deviceList are expected to be on the window object,
    // defined by an inline script in the EJS template.
    if (typeof userList === 'undefined' || typeof deviceList === 'undefined') {
        console.error('userList or deviceList is not defined. Make sure they are passed from the server.');
        return;
    }

    console.log("userlist: ", userList);
    console.log("devicelist: ", deviceList);

    const setUserList = () => {
        const select = document.getElementById('user_select');
        if (!select) return;
        // Add a default placeholder option
        select.options[select.options.length] = new Option('Select a user...', '');
        userList.forEach((user, index) => {
            select.options[select.options.length] = new Option(user.email, index);
        });
    };

    const setDeviceList = () => {
        const select = document.getElementById('device_select');
        if (!select) return;
        // Add a default placeholder option
        select.options[select.options.length] = new Option('Select a device...', '');
        deviceList.forEach((device, index) => {
            select.options[select.options.length] = new Option(device.id, index);
        });
    };

    const selectUser = () => {
        const sel = document.getElementById('user_select');
        // Ensure an option is selected
        if (!sel || sel.value === "") return;
        const user = userList[sel.value];
        if (user) {
            console.log(user);
            DOM.fillForm('userForm', user);
        }
    };

    const selectDevice = () => {
        const sel = document.getElementById('device_select');
        // Ensure an option is selected
        if (!sel || sel.value === "") return;
        const device = deviceList[sel.value];
        if (device) {
            console.log(device);
            DOM.fillForm('deviceForm', device);
        }
    };

    // Initial page setup
    setUserList();
    setDeviceList();

    if (deviceList && deviceList.length > 0) {
        DOM.showArrayOnDOM(deviceList, "deviceList");
    }

    // Replace onClick attributes with event listeners
    const userSelectButton = document.querySelector('button[onClick="selectUser()"]');
    if (userSelectButton) {
        userSelectButton.addEventListener('click', selectUser);
        userSelectButton.removeAttribute('onClick');
    }

    const deviceSelectButton = document.querySelector('button[onClick="selectDevice()"]');
    if (deviceSelectButton) {
        deviceSelectButton.addEventListener('click', selectDevice);
        deviceSelectButton.removeAttribute('onClick');
    }

    // Admin-only trigger for test error
    const triggerBtn = document.getElementById('triggerErrorBtn');
    if (triggerBtn) {
        triggerBtn.addEventListener('click', async () => {
            triggerBtn.disabled = true;
            const resEl = document.getElementById('triggerResult');
            resEl.textContent = 'Triggering...';
            try {
                const resp = await fetch('/admin/trigger-error', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
                if (!resp.ok) {
                    const text = await resp.text();
                    resEl.textContent = `Error triggering test: ${resp.status} ${text}`;
                } else {
                    resEl.textContent = 'Triggered test error (check admin feed).';
                }
            } catch (e) {
                resEl.textContent = `Trigger failed: ${e.message}`;
            }
            triggerBtn.disabled = false;
        });
    }
});