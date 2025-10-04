/* global p5, mqtt */

// This script expects a global `mqttConfig` object to be defined in the EJS template
if (typeof p5 !== 'undefined' && typeof mqtt !== 'undefined' && typeof mqttConfig !== 'undefined') {
    new p5(p => {
        let worldMapImg;
        let iss = { lat: 0, lon: 0 };
        const brokerUrl = mqttConfig.brokerUrl;
        const topic = mqttConfig.issTopic;
        const options = {
            username: mqttConfig.username,
            password: mqttConfig.password,
            clientId: 'mqttjs_' + Math.random().toString(16).substr(2, 8),
        };

        // Preload the map image
        p.preload = () => {
            worldMapImg = p.loadImage('https://upload.wikimedia.org/wikipedia/commons/8/83/Equirectangular_projection_SW.jpg');
        };

        p.setup = () => {
            const container = document.getElementById('iss-map-container');
            const canvas = p.createCanvas(container.offsetWidth, container.offsetHeight);
            canvas.parent('iss-map-container');
            p.image(worldMapImg, 0, 0, p.width, p.height);

            // Connect to MQTT broker
            const client = mqtt.connect(brokerUrl, options);

            client.on('connect', () => {
                console.log('Connected to MQTT broker from the frontend.');
                client.subscribe(topic, (err) => {
                    if (err) {
                        console.error('Subscription error:', err);
                    }
                });
            });

            client.on('message', (receivedTopic, message) => {
                if (receivedTopic === topic) {
                    const data = JSON.parse(message.toString());
                    iss = {
                        lat: parseFloat(data.latitude),
                        lon: parseFloat(data.longitude)
                    };
                    document.getElementById('lat').textContent = iss.lat.toFixed(4);
                    document.getElementById('lon').textContent = iss.lon.toFixed(4);
                    p.redraw();
                }
            });

            client.on('error', (err) => {
                console.error('MQTT connection error:', err);
                client.end();
            });

            p.noLoop(); // Redraw only on new data
        };

        p.draw = () => {
            p.image(worldMapImg, 0, 0, p.width, p.height);
            const x = p.map(iss.lon, -180, 180, 0, p.width);
            const y = p.map(iss.lat, 90, -90, 0, p.height);
            p.fill(255, 0, 0);
            p.noStroke();
            p.ellipse(x, y, 10, 10);
        };

        p.windowResized = () => {
            const container = document.getElementById('iss-map-container');
            p.resizeCanvas(container.offsetWidth, container.offsetHeight);
            p.redraw();
        };
    });
} else {
    console.error('p5.js, MQTT.js, or mqttConfig is not available.');
}