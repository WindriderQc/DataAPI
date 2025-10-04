/* global p5 */

// Ensure p5.js is loaded before running the sketch
if (typeof p5 !== 'undefined') {
    new p5(p => {
        let worldMapImg;
        let iss = { lat: 0, lon: 0 };

        // Preload the map image
        p.preload = () => {
            worldMapImg = p.loadImage('https://upload.wikimedia.org/wikipedia/commons/8/83/Equirectangular_projection_SW.jpg');
        };

        p.setup = () => {
            const container = document.getElementById('iss-map-container');
            const canvas = p.createCanvas(container.offsetWidth, container.offsetHeight);
            canvas.parent('iss-map-container');
            p.image(worldMapImg, 0, 0, p.width, p.height);

            // Connect to the Server-Sent Events endpoint
            const eventSource = new EventSource('/live-data/iss');

            eventSource.onmessage = (event) => {
                const data = JSON.parse(event.data);
                iss = {
                    lat: parseFloat(data.latitude),
                    lon: parseFloat(data.longitude)
                };

                // Update the latitude and longitude display
                document.getElementById('lat').textContent = iss.lat.toFixed(4);
                document.getElementById('lon').textContent = iss.lon.toFixed(4);

                // Redraw the map with the new ISS location
                p.redraw();
            };

            eventSource.onerror = (err) => {
                console.error('EventSource failed:', err);
                eventSource.close();
            };

            // No need for a continuous loop, only redraw when new data arrives
            p.noLoop();
        };

        p.draw = () => {
            // Draw the map
            p.image(worldMapImg, 0, 0, p.width, p.height);

            // Calculate the ISS position on the map
            const x = p.map(iss.lon, -180, 180, 0, p.width);
            const y = p.map(iss.lat, 90, -90, 0, p.height);

            // Draw the ISS marker
            p.fill(255, 0, 0);
            p.noStroke();
            p.ellipse(x, y, 10, 10);
        };

        // Handle window resizing
        p.windowResized = () => {
            const container = document.getElementById('iss-map-container');
            p.resizeCanvas(container.offsetWidth, container.offsetHeight);
            p.redraw();
        };
    });
} else {
    console.error('p5.js is not loaded.');
}