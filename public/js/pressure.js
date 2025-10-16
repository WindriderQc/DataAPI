document.addEventListener('DOMContentLoaded', () => {
    const pressureElement = document.getElementById('pressure');
    const mqttStatusElement = document.getElementById('mqtt-status');

    const ctx = document.getElementById('pressureChart').getContext('2d');
    const pressureChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Barometric Pressure',
                data: [],
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.1
            }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: false
                }
            }
        }
    });

    function updateChart(time, pressure) {
        pressureChart.data.labels.push(time);
        pressureChart.data.datasets[0].data.push(pressure);
        if (pressureChart.data.labels.length > 20) {
            pressureChart.data.labels.shift();
            pressureChart.data.datasets[0].data.shift();
        }
        pressureChart.update();
    }

    const client = mqtt.connect(mqttConfig.brokerUrl, {
        username: mqttConfig.username,
        password: mqttConfig.password
    });

    client.on('connect', () => {
        mqttStatusElement.textContent = 'Connected';
        mqttStatusElement.classList.remove('disconnected');
        mqttStatusElement.classList.add('connected');
        client.subscribe(mqttConfig.pressureTopic, (err) => {
            if (err) {
                console.error('Subscription error:', err);
            }
        });
    });

    client.on('message', (topic, message) => {
        const data = JSON.parse(message.toString());
        if (topic === mqttConfig.pressureTopic) {
            const pressure = data.pressure.toFixed(2);
            const time = new Date(data.timeStamp).toLocaleTimeString();
            pressureElement.textContent = `${pressure} hPa`;
            updateChart(time, pressure);
        }
    });

    client.on('error', (error) => {
        console.error('MQTT client error:', error);
        mqttStatusElement.textContent = 'Error';
        mqttStatusElement.classList.remove('connected');
        mqttStatusElement.classList.add('disconnected');
    });
});