const fileBrowserController = require('../../controllers/fileBrowserController');

describe('File Browser Controller', () => {
    let req, res, next;
    let mockCollection;

    beforeEach(() => {
        mockCollection = {
            countDocuments: jest.fn(),
            find: jest.fn().mockReturnThis(),
            sort: jest.fn().mockReturnThis(),
            skip: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            toArray: jest.fn(),
            aggregate: jest.fn().mockReturnThis()
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
            query: {}
        };
        res = {
            json: jest.fn()
        };
        next = jest.fn();
    });

    describe('browseFiles', () => {
        it('should browse files with default parameters', async () => {
            mockCollection.countDocuments.mockResolvedValue(10);
            mockCollection.toArray.mockResolvedValue([
                { dirname: '/test/', filename: 'file1.txt', size: 1000, mtime: 1600000000 }
            ]);

            await fileBrowserController.browseFiles(req, res, next);

            expect(mockCollection.find).toHaveBeenCalledWith({});
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                status: 'success',
                data: expect.objectContaining({
                    files: expect.arrayContaining([
                        expect.objectContaining({ filename: 'file1.txt' })
                    ])
                })
            }));
        });

        it('should filter by search query', async () => {
            req.query.search = 'test';
            mockCollection.countDocuments.mockResolvedValue(1);
            mockCollection.toArray.mockResolvedValue([]);

            await fileBrowserController.browseFiles(req, res, next);

            expect(mockCollection.find).toHaveBeenCalledWith(expect.objectContaining({
                filename: { $regex: 'test', $options: 'i' }
            }));
        });
    });

    describe('getStats', () => {
        it('should return file statistics', async () => {
            const mockStats = [{
                byExtension: [{ _id: 'txt', count: 5, size: 5000 }],
                bySize: [{ _id: 1024, count: 5, totalSize: 5000 }],
                total: [{ count: 10, totalSize: 10000, avgSize: 1000 }]
            }];
            mockCollection.toArray.mockResolvedValue(mockStats);

            await fileBrowserController.getStats(req, res, next);

            expect(mockCollection.aggregate).toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                status: 'success',
                data: expect.objectContaining({
                    total: mockStats[0].total[0]
                })
            }));
        });
    });
});
