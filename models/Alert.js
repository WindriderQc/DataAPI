const mongoose = require('mongoose');

const config = require('../config/config');

const SEVERITIES = ['info', 'warning', 'critical'];
const STATUSES = ['active', 'acknowledged', 'resolved'];

const AlertSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
        },
        message: {
            type: String,
            required: true,
            trim: true,
        },
        severity: {
            type: String,
            enum: SEVERITIES,
            default: 'info',
        },
        status: {
            type: String,
            enum: STATUSES,
            default: 'active',
        },
        source: {
            type: String,
            default: 'system',
            trim: true,
        },
        ruleId: {
            type: String,
            required: false,
            trim: true,
        },
        context: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
        resolvedAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

// Accept legacy/alternate severity "error" by mapping it to "critical".
AlertSchema.pre('validate', function (next) {
    if (typeof this.severity === 'string') {
        const normalized = this.severity.trim().toLowerCase();
        if (normalized === 'error') {
            this.severity = 'critical';
        }
    }
    next();
});

// Ensure resolvedAt is set/unset consistently when status changes via update.
AlertSchema.pre('findOneAndUpdate', function (next) {
    const update = this.getUpdate() || {};
    const $set = update.$set || update;

    if ($set && typeof $set.status === 'string') {
        const normalizedStatus = $set.status.trim().toLowerCase();
        if (normalizedStatus === 'resolved') {
            update.$set = { ...(update.$set || {}), resolvedAt: new Date() };
            this.setUpdate(update);
        }
        if (normalizedStatus !== 'resolved' && Object.prototype.hasOwnProperty.call($set, 'resolvedAt')) {
            // Leave explicit resolvedAt updates as-is.
        }
    }

    next();
});

AlertSchema.index({ status: 1, createdAt: -1 });
AlertSchema.index({ severity: 1, createdAt: -1 });
AlertSchema.index({ ruleId: 1, createdAt: -1 });

// Use the primary database name from the centralized configuration
const mainDbConnection = mongoose.connection.useDb(config.db.mainDb, { useCache: true });

module.exports = mainDbConnection.model('Alert', AlertSchema);
