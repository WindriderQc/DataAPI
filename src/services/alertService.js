const Alert = require('../../models/Alert');

class AlertService {
    static #instance;

    static getInstance() {
        if (!AlertService.#instance) {
            AlertService.#instance = new AlertService();
        }
        return AlertService.#instance;
    }

    normalizeSeverity(severity) {
        if (!severity) return 'info';
        const normalized = String(severity).trim().toLowerCase();
        if (normalized === 'error') return 'critical';
        return normalized;
    }

    async createAlert(data = {}) {
        const {
            title,
            message,
            severity,
            status,
            source,
            ruleId,
            context,
        } = data;

        const alert = await Alert.create({
            title,
            message,
            severity: this.normalizeSeverity(severity),
            status: status ? String(status).trim().toLowerCase() : undefined,
            source: source ? String(source).trim() : undefined,
            ruleId,
            context,
        });

        await this.sendNotification(alert);
        return alert;
    }

    // Placeholder - rule engine will be added in a later track.
    async evaluateRule(_event) {
        return null;
    }

    // Placeholder notification transport - just logs for now.
    async sendNotification(alert) {
        // eslint-disable-next-line no-console
        console.log('[alertService] notification placeholder', {
            id: alert?._id?.toString?.(),
            severity: alert?.severity,
            status: alert?.status,
            title: alert?.title,
            source: alert?.source,
        });
    }
}

module.exports = AlertService.getInstance();
module.exports.AlertService = AlertService;
