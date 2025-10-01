const { ObjectId } = require('mongodb');
const { BadRequest, NotFoundError } = require('../utils/errors');

const genericController = (collectionName) => ({
  getAll: async (req, res, next) => {
    try {
      const { db = 'datas' } = req.query;
      const dbs = req.app.locals.dbs;
      if (!dbs || !dbs[db]) {
        return next(new NotFoundError(`Database '${db}' not found`));
      }
      const collection = dbs[db].collection(collectionName);
      const query = { ...req.query };
      delete query.db;
      const documents = await collection.find(query).toArray();
      res.json({
        status: 'success',
        message: 'Documents retrieved successfully',
        data: documents,
      });
    } catch (error) {
      next(error);
    }
  },

  getById: async (req, res, next) => {
    try {
      const { db = 'datas' } = req.query;
      const dbs = req.app.locals.dbs;
      if (!dbs || !dbs[db]) {
        return next(new NotFoundError(`Database '${db}' not found`));
      }
      const collection = dbs[db].collection(collectionName);
      if (!ObjectId.isValid(req.params.id)) {
        return next(new BadRequest('Invalid ID format'));
      }
      const document = await collection.findOne({ _id: new ObjectId(req.params.id) });
      if (!document) {
        return next(new NotFoundError('Document not found'));
      }
      res.json({
        status: 'success',
        message: 'Document retrieved successfully',
        data: document,
      });
    } catch (error) {
      next(error);
    }
  },

  create: async (req, res, next) => {
    try {
      const { db = 'datas' } = req.query;
      const dbs = req.app.locals.dbs;
      if (!dbs || !dbs[db]) {
        return next(new NotFoundError(`Database '${db}' not found`));
      }
      const collection = dbs[db].collection(collectionName);
      const result = await collection.insertOne(req.body);
      const createdDocument = { ...req.body, _id: result.insertedId };
      res.status(201).json({
        status: 'success',
        message: 'Document created successfully',
        data: createdDocument,
      });
    } catch (error) {
      next(new BadRequest(error.message));
    }
  },

  update: async (req, res, next) => {
    try {
      const { db = 'datas' } = req.query;
      const dbs = req.app.locals.dbs;
      if (!dbs || !dbs[db]) {
        return next(new NotFoundError(`Database '${db}' not found`));
      }
      const collection = dbs[db].collection(collectionName);
      if (!ObjectId.isValid(req.params.id)) {
        return next(new BadRequest('Invalid ID format'));
      }
      const result = await collection.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: req.body }
      );
       if (result.matchedCount === 0) {
        return next(new NotFoundError('Document not found'));
      }
      res.json({ status: 'success', message: 'Document updated successfully' });
    } catch (error) {
      next(new BadRequest(error.message));
    }
  },

  delete: async (req, res, next) => {
    try {
      const { db = 'datas' } = req.query;
      const dbs = req.app.locals.dbs;
      if (!dbs || !dbs[db]) {
        return next(new NotFoundError(`Database '${db}' not found`));
      }
      const collection = dbs[db].collection(collectionName);
      if (!ObjectId.isValid(req.params.id)) {
        return next(new BadRequest('Invalid ID format'));
      }
      const result = await collection.deleteOne({ _id: new ObjectId(req.params.id) });
      if (result.deletedCount === 0) {
        return next(new NotFoundError('Document not found'));
      }
      res.json({ status: 'success', message: 'Document deleted successfully' });
    } catch (error) {
      next(error);
    }
  },
});

module.exports = genericController;