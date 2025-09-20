const { validationResult } = require('express-validator');
const Contact = require('../models/contactModel');
const { NotFoundError, BadRequest } = require('../utils/errors');

exports.index = async (req, res, next) => {
    try {
        let { skip = 0, limit = 5, sort = 'desc' } = req.query;
        skip = parseInt(skip) || 0;
        limit = parseInt(limit) || 10;
        skip = skip < 0 ? 0 : skip;
        limit = Math.min(50, Math.max(1, limit));

        const [total, data] = await Promise.all([
            Contact.countDocuments({}),
            Contact.find({}, {}, { sort: { created: sort === 'desc' ? -1 : 1 } }).skip(skip).limit(limit)
        ]);

        res.json({
            status: "success",
            message: 'Contacts retrieved successfully',
            data: data,
            meta: { total, sort, skip, limit, has_more: total - (skip + limit) > 0 }
        });
    } catch (err) {
        next(err);
    }
};

exports.new = async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return next(new BadRequest(errors.array()));
    }

    try {
        const contact = new Contact(req.body);
        await contact.save();
        res.status(201).json({ message: 'New contact created!', data: contact });
    } catch (err) {
        next(err);
    }
};

exports.view = async (req, res, next) => {
    try {
        const contact = await Contact.findById(req.params.contact_id);
        if (!contact) {
            return next(new NotFoundError('Contact not found'));
        }
        res.json({ status: 'success', message: 'Contact details loading..', data: contact });
    } catch (err) {
        next(err);
    }
};

exports.update = async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return next(new BadRequest(errors.array()));
    }

    try {
        const contact = await Contact.findById(req.params.contact_id);
        if (!contact) {
            return next(new NotFoundError('Contact not found'));
        }

        Object.assign(contact, req.body);

        await contact.save();
        res.json({ status: 'success', message: 'Contact Info updated', data: contact });
    } catch (err) {
        next(err);
    }
};

exports.delete = async (req, res, next) => {
    try {
        const result = await Contact.deleteOne({ _id: req.params.contact_id });
        if (result.deletedCount === 0) {
            return next(new NotFoundError('Contact not found'));
        }
        res.json({ status: 'success', message: 'Contact deleted' });
    } catch (err) {
        next(err);
    }
};