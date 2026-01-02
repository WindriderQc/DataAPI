const { spawn } = require('child_process');
const xml2js = require('xml2js');
const parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true });

class NetworkScanner {
    constructor() {
        this.isScanning = false;
        this.scanTimeout = 600000; // 10 minutes default timeout
    }

    /**
     * Parse Nmap XML Output
     * @param {string} xmlData
     * @returns {Promise<Array>} List of devices
     */
    async parseNmapOutput(xmlData) {
        try {
            const result = await parser.parseStringPromise(xmlData);
            if (!result.nmaprun || !result.nmaprun.host) {
                return [];
            }

            const hosts = Array.isArray(result.nmaprun.host) ? result.nmaprun.host : [result.nmaprun.host];

            return hosts.map(host => {
                // Check if host is up
                if (host.status.state !== 'up') return null;

                // Address handling
                let ip = '';
                let mac = '';
                let vendor = '';

                const addresses = Array.isArray(host.address) ? host.address : [host.address];
                addresses.forEach(addr => {
                    if (addr.addrtype === 'ipv4') ip = addr.addr;
                    if (addr.addrtype === 'mac') {
                        mac = addr.addr;
                        vendor = addr.vendor || '';
                    }
                });

                // If no MAC (local scan vs remote scan issue), use IP as fallback key if needed,
                // but for our model we need MAC.
                // Note: nmap -sn only shows MACs if run as root/sudo on local subnet.
                // If we can't get MAC, we might skip or flag it.
                if (!mac) return null;

                // Hostnames
                let hostname = '';
                if (host.hostnames && host.hostnames.hostname) {
                    const hNames = Array.isArray(host.hostnames.hostname)
                        ? host.hostnames.hostname
                        : [host.hostnames.hostname];
                    hostname = hNames[0].name;
                }

                return {
                    ip,
                    mac,
                    vendor,
                    hostname,
                    status: 'online',
                    lastSeen: new Date()
                };
            }).filter(device => device !== null);

        } catch (error) {
            console.error('Error parsing Nmap XML:', error);
            return [];
        }
    }

    /**
     * Run a quick ping scan (ARP-like on local net)
     * @param {string} targetCIDR
     * @returns {Promise<Array>}
     */
    scanNetwork(targetCIDR) {
        return new Promise((resolve, reject) => {
            // Use a proper lock to prevent race conditions
            if (this.isScanning) {
                return reject(new Error('Scan already in progress'));
            }
            this.isScanning = true;

            const nmap = spawn('nmap', ['-sn', '-oX', '-', targetCIDR]);
            let xmlOutput = '';
            let errorOutput = '';
            let scanCompleted = false;

            // Set a timeout to prevent hanging scans
            const timeoutId = setTimeout(() => {
                if (!scanCompleted) {
                    console.error('Scan timeout exceeded. Terminating nmap process.');
                    nmap.kill('SIGTERM');
                    this.isScanning = false;
                    reject(new Error('Scan timeout: operation exceeded maximum allowed time'));
                }
            }, this.scanTimeout);

            nmap.stdout.on('data', (data) => {
                xmlOutput += data.toString();
            });

            nmap.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });

            nmap.on('close', async (code) => {
                scanCompleted = true;
                clearTimeout(timeoutId);
                this.isScanning = false;
                
                if (code !== 0) {
                    console.error('Nmap Error:', errorOutput);
                    return reject(new Error(`Nmap exited with code ${code}`));
                }

                try {
                    const devices = await this.parseNmapOutput(xmlOutput);
                    resolve(devices);
                } catch (err) {
                    reject(err);
                }
            });

            nmap.on('error', (err) => {
                scanCompleted = true;
                clearTimeout(timeoutId);
                this.isScanning = false;
                reject(err);
            });
        });
    }

    /**
     * Enrich a specific device with OS/Service detection
     * @param {string} ip
     * @returns {Promise<Object>}
     */
    enrichDevice(ip) {
        return new Promise((resolve, reject) => {
            // -O for OS detection, -sV for version detection
            // Note: -O requires root privileges.
            const nmap = spawn('nmap', ['-O', '-sV', '--top-ports', '100', '-oX', '-', ip]);
            let xmlOutput = '';
            let errorOutput = '';

            nmap.stdout.on('data', (data) => {
                xmlOutput += data.toString();
            });

            nmap.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });

            nmap.on('close', async (code) => {
                if (code !== 0) {
                    // Non-critical if enrichment fails, but log error details for debugging
                    console.error('Nmap enrichment error output:', errorOutput);
                    console.error(`Nmap enrichment exited with code ${code}`);
                    return resolve(null);
                }

                try {
                    const result = await parser.parseStringPromise(xmlOutput);
                    if (!result.nmaprun || !result.nmaprun.host) return resolve(null);

                    const host = result.nmaprun.host;

                    let osMatch = '';
                    if (host.os && host.os.osmatch) {
                        const matches = Array.isArray(host.os.osmatch) ? host.os.osmatch : [host.os.osmatch];
                        osMatch = matches[0].name;
                    }

                    const ports = [];
                    if (host.ports && host.ports.port) {
                        const portList = Array.isArray(host.ports.port) ? host.ports.port : [host.ports.port];
                        portList.forEach(p => {
                            if (p.state.state === 'open') {
                                ports.push({
                                    port: parseInt(p.portid),
                                    protocol: p.protocol,
                                    service: p.service ? p.service.name : 'unknown',
                                    state: 'open'
                                });
                            }
                        });
                    }

                    resolve({
                        ip,
                        hardware: { os: osMatch },
                        openPorts: ports
                    });

                } catch (err) {
                    resolve(null);
                }
            });
        });
    }
}

module.exports = new NetworkScanner();
