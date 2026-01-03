const express = require('express');
const { body, param, validationResult } = require('express-validator');

const Alert = require('../models/Alert');
const alertService = require('../src/services/alertService');
const { BadRequest, NotFoundError } = require('../utils/errors');

const router = express.Router();

/**
 * POST /alerts
 * Create a manual alert
 */
router.post(
    '/',
    [
        body('title').isString().trim().notEmpty(),
        body('message').isString().trim().notEmpty(),
        body('severity').optional().isString().trim(),
        body('status').optional().isString().trim(),
        body('source').optional().isString().trim(),
        body('ruleId').optional().isString().trim(),
        body('context').optional().isObject(),
    ],
    async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return next(new BadRequest(errors.array()));
        }

        try {
            const alert = await alertService.createAlert(req.body);
            return res.status(201).json({
                status: 'success',
                message: 'Alert created successfully',
                data: alert,
            });
        } catch (err) {
            return next(err);
        }
    }
);

/**
 * GET /alerts
 * List alerts (filter by status/severity/source/ruleId)
 */
router.get('/', async (req, res, next) => {
    try {
        let { skip = 0, limit = 50, sort = 'desc' } = req.query;
        skip = parseInt(skip, 10) || 0;
        limit = parseInt(limit, 10) || 50;
        skip = skip < 0 ? 0 : skip;
        limit = Math.min(100, Math.max(1, limit));

        const filter = {};

        if (req.query.status) {
            filter.status = String(req.query.status).trim().toLowerCase();
        }
        if (req.query.severity) {
            const sev = String(req.query.severity).trim().toLowerCase();
            filter.severity = sev === 'error' ? 'critical' : sev;
        }
        if (req.query.source) {
            filter.source = String(req.query.source).trim();
        }
        if (req.query.ruleId) {
            filter.ruleId = String(req.query.ruleId).trim();
        }

        const sortBy = String(sort).trim().toLowerCase() === 'asc' ? 1 : -1;

        const [total, data] = await Promise.all([
            Alert.countDocuments(filter),
            Alert.find(filter)
                .sort({ createdAt: sortBy })
                .skip(skip)
                .limit(limit)
                .lean(),
        ]);

        return res.json({
            status: 'success',
            message: 'Alerts retrieved successfully',
            data,
            meta: {
                total,
                sort,
                skip,
                limit,
                has_more: total - (skip + limit) > 0,
            },
        });
    } catch (err) {
        return next(err);
    }
});

/**
 * PATCH /alerts/:id/status
 * Update alert status (acknowledged/resolved)
 */
router.patch(
    '/:id/status',
    [
        param('id').isMongoId(),
        body('status').isString().trim().toLowerCase().isIn(['acknowledged', 'resolved']),
    ],
    async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return next(new BadRequest(errors.array()));
        }

        try {
            const id = req.params.id;
            const status = String(req.body.status).trim().toLowerCase();

            const update = { status };
            if (status === 'resolved') {
                update.resolvedAt = new Date();
            }

            const alert = await Alert.findByIdAndUpdate(id, update, {
                new: true,
                runValidators: true,
            });

            if (!alert) {
                return next(new NotFoundError('Alert not found'));
            }

            return res.json({
                status: 'success',
                message: 'Alert status updated successfully',
                data: alert,
            });
        } catch (err) {
            return next(err);
        }
    }
);

module.exports = router;
