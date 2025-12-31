const pidusage = require('pidusage');
const os = require('os');

const getSystemStats = async (req, res) => {
    try {
        const stats = await pidusage(process.pid);

        const data = {
            process: {
                cpu: stats.cpu, // percentage
                memory: stats.memory, // bytes
                uptime: stats.elapsed, // ms
                pid: stats.pid
            },
            system: {
                total_mem: os.totalmem(),
                free_mem: os.freemem(),
                load_avg: os.loadavg(),
                cpus: os.cpus().length,
                platform: os.platform(),
                uptime: os.uptime() // seconds
            },
            timestamp: new Date()
        };

        res.json({
            status: 'success',
            data
        });
    } catch (error) {
        console.error('Error fetching system stats:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch system stats',
            error: error.message
        });
    }
};

module.exports = {
    getSystemStats
};
