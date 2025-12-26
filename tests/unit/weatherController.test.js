const weatherController = require('../../controllers/weatherController');
const { BadRequest } = require('../../utils/errors');

describe('Weather Controller', () => {
    let req, res, next;
    let mockCollection;

    beforeEach(() => {
        mockCollection = {
            findOne: jest.fn(),
            insertOne: jest.fn()
        };
        req = {
            app: {
                locals: {
                    dbs: {
                        mainDb: {
                            collection: jest.fn().mockReturnValue(mockCollection)
                        }
                    }
                }
            },
            body: {} // Initialize body
        };
        res = {
            locals: {
                user: { lat: 45.5, lon: -73.5 } // Default valid user location
            },
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        next = jest.fn();
    });

    it('should register a new location', async () => {
        mockCollection.findOne.mockResolvedValue(null);
        mockCollection.insertOne.mockResolvedValue({});

        await weatherController.registerLocation(req, res, next);

        expect(mockCollection.findOne).toHaveBeenCalledWith({ lat: 45.5, lon: -73.5 });
        expect(mockCollection.insertOne).toHaveBeenCalledWith({ lat: 45.5, lon: -73.5 });
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'success' }));
    });

    it('should register a provided location from body', async () => {
        req.body = { lat: 10.0, lon: 20.0 };
        mockCollection.findOne.mockResolvedValue(null);
        mockCollection.insertOne.mockResolvedValue({});

        await weatherController.registerLocation(req, res, next);

        expect(mockCollection.findOne).toHaveBeenCalledWith({ lat: 10.0, lon: 20.0 });
        expect(mockCollection.insertOne).toHaveBeenCalledWith({ lat: 10.0, lon: 20.0 });
        expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should not register if location already exists', async () => {
        mockCollection.findOne.mockResolvedValue({ lat: 45.5, lon: -73.5 });

        await weatherController.registerLocation(req, res, next);

        expect(mockCollection.findOne).toHaveBeenCalled();
        expect(mockCollection.insertOne).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Location already registered.' }));
    });

    it('should throw BadRequest if user has no location', async () => {
        res.locals.user = {}; // No lat/lon

        await weatherController.registerLocation(req, res, next);

        expect(next).toHaveBeenCalledWith(expect.any(BadRequest));
    });

    it('should handle database errors', async () => {
        mockCollection.findOne.mockRejectedValue(new Error('DB Error'));

        await weatherController.registerLocation(req, res, next);

        expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
});
