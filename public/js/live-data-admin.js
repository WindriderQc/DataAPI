// Live Data Configuration Management (admin only)

document.addEventListener('DOMContentLoaded', async () => {
  const toggleLiveData = document.getElementById('toggleLiveData');
  const toggleISS = document.getElementById('toggleISS');
  const toggleQuakes = document.getElementById('toggleQuakes');
  const toggleWeather = document.getElementById('toggleWeather');
  const statusDiv = document.getElementById('configStatus');

  if (!toggleLiveData || !toggleISS || !toggleQuakes || !toggleWeather || !statusDiv) return;

  async function loadConfig() {
    try {
      const response = await fetch('/api/v1/livedata/config', {
        credentials: 'include'
      });

      const data = await response.json();

      if (data.status === 'success') {
        toggleLiveData.checked = data.data.liveDataEnabled || false;
        toggleISS.checked = data.data.iss || false;
        toggleQuakes.checked = data.data.quakes || false;
        toggleWeather.checked = data.data.weather || false;
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to load config:', error);
      showStatus('Failed to load configuration', 'danger');
    }
  }

  async function updateConfig(service, enabled) {
    try {
      const response = await fetch('/api/v1/livedata/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ service, enabled })
      });

      const data = await response.json();

      if (data.status === 'success') {
        const serviceName = service === 'liveDataEnabled' ? 'Live Data' : String(service).toUpperCase();
        showStatus(`${serviceName} ${enabled ? 'enabled' : 'disabled'}`, 'success');

        // Update local config state so frontend logic responds immediately
        if (typeof mqttConfig !== 'undefined' && mqttConfig && mqttConfig.serviceState) {
          mqttConfig.serviceState[service] = enabled;
        }

        // If toggling master switch, reload page to connect/disconnect MQTT properly
        if (service === 'liveDataEnabled') {
          setTimeout(() => window.location.reload(), 1000);
        }
      } else {
        showStatus('Failed to update configuration', 'danger');
        await loadConfig();
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to update config:', error);
      showStatus('Failed to update configuration', 'danger');
      await loadConfig();
    }
  }

  function showStatus(message, type) {
    statusDiv.className = `mt-3 alert alert-${type}`;
    statusDiv.textContent = message;
    statusDiv.classList.remove('d-none');

    setTimeout(() => {
      statusDiv.classList.add('d-none');
    }, 3000);
  }

  toggleLiveData.addEventListener('change', (e) => {
    updateConfig('liveDataEnabled', e.target.checked);
  });

  toggleISS.addEventListener('change', (e) => {
    updateConfig('iss', e.target.checked);
  });

  toggleQuakes.addEventListener('change', (e) => {
    updateConfig('quakes', e.target.checked);
  });

  toggleWeather.addEventListener('change', (e) => {
    updateConfig('weather', e.target.checked);
  });

  await loadConfig();
});
