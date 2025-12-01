const ollamaController = require('../controllers/ollamaController');
const fetchUtils = require('../utils/fetch-utils');

jest.mock('../utils/fetch-utils');

describe('Ollama Controller', () => {
    let req, res;

    beforeEach(() => {
        req = { body: {}, query: {} };
        res = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis()
        };
        fetchUtils.fetchWithTimeoutAndRetry.mockClear();
    });

    describe('listModels', () => {
        it('should return list of models', async () => {
            const mockModels = { models: [{ name: 'llama3:latest' }] };
            fetchUtils.fetchWithTimeoutAndRetry.mockResolvedValue({
                json: async () => mockModels,
                ok: true
            });

            await ollamaController.listModels(req, res);

            expect(fetchUtils.fetchWithTimeoutAndRetry).toHaveBeenCalledWith(
                expect.stringContaining('/api/tags'),
                expect.any(Object)
            );
            expect(res.json).toHaveBeenCalledWith({
                status: 'success',
                data: mockModels.models
            });
        });

        it('should use target host if provided', async () => {
            req.query = { target: '192.168.1.50' };
            const mockModels = { models: [] };
            fetchUtils.fetchWithTimeoutAndRetry.mockResolvedValue({
                json: async () => mockModels,
                ok: true
            });

            await ollamaController.listModels(req, res);

            expect(fetchUtils.fetchWithTimeoutAndRetry).toHaveBeenCalledWith(
                'http://192.168.1.50:11434/api/tags',
                expect.any(Object)
            );
        });

        it('should handle errors', async () => {
            fetchUtils.fetchWithTimeoutAndRetry.mockRejectedValue(new Error('Connection failed'));

            await ollamaController.listModels(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                status: 'error'
            }));
        });
    });

    describe('chat', () => {
        it('should use target host if provided', async () => {
            req.body = { prompt: 'Hello', target: '192.168.1.99' };
            const mockResponse = { message: { content: 'Hi' } };

            fetchUtils.fetchWithTimeoutAndRetry.mockResolvedValue({
                json: async () => mockResponse,
                ok: true
            });

            await ollamaController.chat(req, res);

            expect(fetchUtils.fetchWithTimeoutAndRetry).toHaveBeenCalledWith(
                'http://192.168.1.99:11434/api/chat',
                expect.any(Object)
            );
        });

        it('should send prompt and return output', async () => {
            req.body = { prompt: 'Hello', model: 'llama3' };
            const mockResponse = {
                message: { content: 'Hi there' },
                done: true,
                model: 'llama3',
                total_duration: 123,
                eval_count: 10
            };

            fetchUtils.fetchWithTimeoutAndRetry.mockResolvedValue({
                json: async () => mockResponse,
                ok: true
            });

            await ollamaController.chat(req, res);

            expect(fetchUtils.fetchWithTimeoutAndRetry).toHaveBeenCalledWith(
                expect.stringContaining('/api/chat'),
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify({
                        model: 'llama3',
                        messages: [{ role: 'user', content: 'Hello' }],
                        stream: false
                    })
                })
            );

            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                status: 'success',
                output: 'Hi there'
            }));
        });

        it('should default model if not provided', async () => {
            req.body = { prompt: 'Hello' };
             const mockResponse = {
                message: { content: 'Hi there' },
                done: true
            };

            fetchUtils.fetchWithTimeoutAndRetry.mockResolvedValue({
                json: async () => mockResponse,
                ok: true
            });

            await ollamaController.chat(req, res);

             expect(fetchUtils.fetchWithTimeoutAndRetry).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    body: expect.stringContaining('"model":"llama3"') // Default
                })
            );
        });

        it('should return 400 if prompt missing', async () => {
            req.body = { model: 'llama3' };
            await ollamaController.chat(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });
    });
});
