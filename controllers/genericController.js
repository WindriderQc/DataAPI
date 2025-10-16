const { ObjectId } = require('mongodb');
const { BadRequest, NotFoundError } = require('../utils/errors');
const { normalizeCountryData } = require('../utils/location-normalizer');

// All collections now live in the same active database (mainDb).
const geocodeCandidates = new Set(['quakes', 'isses']);

const genericController = (collectionName) => {
  const dbKey = 'mainDb';

  return {
    getAll: async (req, res, next) => {
      try {
        const db = req.app.locals.dbs[dbKey];
        if (!db) {
          return next(new NotFoundError(`Database connection '${dbKey}' not found for collection '${collectionName}'.`));
        }
        const collection = db.collection(collectionName);
        
        // Parse pagination parameters
        let { skip = 0, limit = 10, sort = 'desc' } = req.query;
        skip = parseInt(skip) || 0;
        limit = parseInt(limit) || 10;
        skip = skip < 0 ? 0 : skip;
        limit = Math.min(100, Math.max(1, limit)); // Clamp limit between 1 and 100
        
        const sortBy = sort === 'desc' ? -1 : 1;
        
        // Build query (remove pagination params from query filter)
        const query = { ...req.query };
        delete query.skip;
        delete query.limit;
        delete query.sort;
        delete query.db;
        
        // Execute query with pagination
        const [total, documents] = await Promise.all([
          collection.countDocuments(query),
          collection.find(query).skip(skip).limit(limit).sort({ _id: sortBy }).toArray()
        ]);
        
        // Provide DB and collection/document identifiers so normalization can use cache/queue
        const enrichedDocuments = await Promise.all(
          documents.map(d => normalizeCountryData(d, db, collectionName, d._id))
        );
        
        res.json({
          status: 'success',
          message: 'Documents retrieved successfully',
          data: enrichedDocuments,
          meta: {
            total,
            skip,
            limit,
            sort,
            has_more: total - (skip + limit) > 0,
          },
        });
      } catch (error) {
        next(error);
      }
    },

    getById: async (req, res, next) => {
      try {
        const db = req.app.locals.dbs[dbKey];
        if (!db) {
          return next(new NotFoundError(`Database connection '${dbKey}' not found for collection '${collectionName}'.`));
        }
        const collection = db.collection(collectionName);
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
        const db = req.app.locals.dbs[dbKey];
        if (!db) {
          return next(new NotFoundError(`Database connection '${dbKey}' not found for collection '${collectionName}'.`));
        }
        const collection = db.collection(collectionName);
        const result = await collection.insertOne(req.body);
        // If this collection likely needs geocoding, enqueue a job
        try {
          if (geocodeCandidates.has(collectionName)) {
            const latKey = Object.keys(req.body).find(k => ['lat','latitude','y'].includes(k.toLowerCase()));
            const lonKey = Object.keys(req.body).find(k => ['lon','lng','longitude','long','x'].includes(k.toLowerCase()));
            if (latKey && lonKey) {
              const lat = Number(req.body[latKey]);
              const lon = Number(req.body[lonKey]);
              if (Number.isFinite(lat) && Number.isFinite(lon)) {
                await db.collection('geocodeJobs').insertOne({ collection: collectionName, docId: result.insertedId, lat, lon, status: 'pending', attempts: 0, createdAt: new Date(), nextRun: new Date() });
              }
            }
          }
        } catch (e) {
          // enqueue failures shouldn't block the main flow; log and continue
          console.warn('Failed to enqueue geocode job:', e && e.message ? e.message : e);
        }
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
        const db = req.app.locals.dbs[dbKey];
        if (!db) {
          return next(new NotFoundError(`Database connection '${dbKey}' not found for collection '${collectionName}'.`));
        }
        const collection = db.collection(collectionName);
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
        const db = req.app.locals.dbs[dbKey];
        if (!db) {
          return next(new NotFoundError(`Database connection '${dbKey}' not found for collection '${collectionName}'.`));
        }
        const collection = db.collection(collectionName);
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
  };
};

module.exports = genericController;