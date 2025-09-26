const { ObjectId } = require('mongodb');

const genericController = (collectionName) => ({
  getAll: async (req, res) => {
    try {
      const { db = 'datas' } = req.query;
      const dbs = req.app.locals.dbs;
      if (!dbs || !dbs[db]) {
        return res.status(404).json({ message: `Database '${db}' not found` });
      }
      const collection = dbs[db].collection(collectionName);
      const query = { ...req.query };
      delete query.db;
      const documents = await collection.find(query).toArray();
      res.json(documents);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  getById: async (req, res) => {
    try {
      const { db = 'datas' } = req.query;
      const dbs = req.app.locals.dbs;
      if (!dbs || !dbs[db]) {
        return res.status(404).json({ message: `Database '${db}' not found` });
      }
      const collection = dbs[db].collection(collectionName);
      if (!ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ message: 'Invalid ID format' });
      }
      const document = await collection.findOne({ _id: new ObjectId(req.params.id) });
      if (!document) {
        return res.status(404).json({ message: 'Document not found' });
      }
      res.json(document);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  create: async (req, res) => {
    try {
      const { db = 'datas' } = req.query;
      const dbs = req.app.locals.dbs;
      if (!dbs || !dbs[db]) {
        return res.status(404).json({ message: `Database '${db}' not found` });
      }
      const collection = dbs[db].collection(collectionName);
      const result = await collection.insertOne(req.body);
      if (result.ops && result.ops.length > 0) {
        res.status(201).json(result.ops[0]);
      } else {
        res.status(201).json({ ...req.body, _id: result.insertedId });
      }
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  update: async (req, res) => {
    try {
      const { db = 'datas' } = req.query;
      const collections = req.app.locals.collections;
      if (!collections || !collections[db] || !collections[db][collectionName]) {
        return res.status(404).json({ message: `Collection '${collectionName}' not found in db '${db}'` });
      }
      const collection = collections[db][collectionName];
      if (!ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ message: 'Invalid ID format' });
      }
      const result = await collection.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: req.body }
      );
       if (result.matchedCount === 0) {
        return res.status(404).json({ message: 'Document not found' });
      }
      res.json({ message: 'Document updated successfully' });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  delete: async (req, res) => {
    try {
      const { db = 'datas' } = req.query;
      const collections = req.app.locals.collections;
      if (!collections || !collections[db] || !collections[db][collectionName]) {
        return res.status(404).json({ message: `Collection '${collectionName}' not found in db '${db}'` });
      }
      const collection = collections[db][collectionName];
      if (!ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ message: 'Invalid ID format' });
      }
      const result = await collection.deleteOne({ _id: new ObjectId(req.params.id) });
      if (result.deletedCount === 0) {
        return res.status(404).json({ message: 'Document not found' });
      }
      res.json({ message: 'Document deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },
});

module.exports = genericController;