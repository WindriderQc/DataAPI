// p5.js helper tools for live-data visualizations
// Global Tools object expected by live-data.js

const Tools = {
    p5: {
        displayGrid: (r, l, color = 0, weight = 1) => {
            for (var x = -width / 2; x < width / 2; x += width / r) {
                for (var y = -height / 2; y < height / 2; y += height / l) {
                    stroke(color);
                    strokeWeight(weight);
                    line(x, -height / 2, x, height / 2);
                    line(-width / 2, y, width / 2, y);
                }
            }
        },

        mercX: (lon) => {
            lon = radians(lon);
            var a = (256 / PI) * pow(2, zoom);
            var b = lon + PI;
            return a * b;
        },

        mercY: (lat) => {
            lat = radians(lat);
            var a = (256 / PI) * pow(2, zoom);
            var b = tan(PI / 4 + lat / 2);
            var c = PI - log(b);
            return a * c;
        },

        getMercatorCoord: (lon, lat, offsetx = 0, offsety = 0) => {
            let cx = Tools.p5.mercX(offsetx);
            let cy = Tools.p5.mercY(offsety);

            let x = Tools.p5.mercX(lon) - cx;
            let y = Tools.p5.mercY(lat) - cy;

            return { x, y };
        },

        getSphereCoord: (rayon, latitude, longitude) => {
            var theta = radians(latitude);
            var phi = radians(longitude) + HALF_PI;
            var x = rayon * cos(theta) * cos(phi);
            var y = -rayon * sin(theta);
            var z = -rayon * cos(theta) * sin(phi);
            let vecCoord = createVector(x, y, z);
            return vecCoord;
        },

        getLatLonFromSphereCoord: (x, y, z, rayon) => {
            if (rayon === 0) return { lat: 0, lon: 0 };
            let valForAsin = -y / rayon;
            valForAsin = Math.max(-1.0, Math.min(1.0, valForAsin));
            let theta = Math.asin(valForAsin);
            let latDegrees = degrees(theta);
            let phi_offset_calc;
            if (Math.abs(Math.cos(theta)) < 0.00001) {
                phi_offset_calc = 0;
            } else {
                phi_offset_calc = Math.atan2(-z, x);
            }
            let lonRadians = phi_offset_calc - HALF_PI;
            while (lonRadians <= -Math.PI) lonRadians += 2 * Math.PI;
            while (lonRadians > Math.PI) lonRadians -= 2 * Math.PI;
            let lonDegrees = degrees(lonRadians);
            return { lat: latDegrees, lon: lonDegrees };
        }
    }
};
