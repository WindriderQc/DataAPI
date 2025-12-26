describe.skip('chatkitController.createSessionToken', () => {
    const originalEnv = { ...process.env };
    const originalFetch = global.fetch;

    const createReqRes = (body = {}, session = {}, user = {}) => {
        const req = { body, session };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
            locals: { user }
        };
        return { req, res };
    };

    afterEach(() => {
        Object.keys(process.env).forEach((key) => {
            if (!(key in originalEnv)) {
                delete process.env[key];
            }
        });
        Object.keys(originalEnv).forEach((key) => {
            process.env[key] = originalEnv[key];
        });

        if (originalFetch) {
            global.fetch = originalFetch;
        } else {
            delete global.fetch;
        }

        jest.resetModules();
        jest.clearAllMocks();
    });

    it('returns 400 when no agent id is provided', async () => {
        jest.resetModules();
        const { createSessionToken } = require('../../controllers/chatkitController');
        const { req, res } = createReqRes();

        await createSessionToken(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            status: 'error',
            message: 'Chat agent ID is not configured.'
        }));
    });

    it('returns 500 when API key is missing', async () => {
        process.env.CHATKIT_AGENT_ID = 'agent-123';
        jest.resetModules();
        const { createSessionToken } = require('../../controllers/chatkitController');
        const { req, res } = createReqRes();

        await createSessionToken(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            status: 'error',
            message: 'Chat agent is not available. Contact the administrator.'
        }));
    });

    it('returns success payload when token is issued', async () => {
        process.env.OPENAI_API_KEY = 'test-key';
        const agentId = 'agent-xyz';
        const tokenValue = 'token-123';
        const expiresAt = '2025-12-25T00:00:00Z';

        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
                client_secret: {
                    value: tokenValue,
                    expires_at: expiresAt
                },
                id: 'session-1'
            })
        });

        jest.resetModules();
        const { createSessionToken } = require('../../controllers/chatkitController');
        const { req, res } = createReqRes({ agentId }, { userId: 'user-1' }, { email: 'admin@example.com' });

        await createSessionToken(req, res);

        expect(fetch).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith({
            status: 'success',
            message: 'Chat session token issued.',
            data: {
                token: {
                    value: tokenValue,
                    expires_at: expiresAt
                },
                sessionId: 'session-1',
                agentId
            }
        });
    });

    it('bubbles up upstream error responses', async () => {
        process.env.OPENAI_API_KEY = 'test-key';
        const agentId = 'agent-xyz';

        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 403,
            json: () => Promise.resolve({
                error: {
                    message: 'Forbidden'
                }
            })
        });

        jest.resetModules();
        const { createSessionToken } = require('../../controllers/chatkitController');
        const { req, res } = createReqRes({ agentId });

        await createSessionToken(req, res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({
            status: 'error',
            message: 'Forbidden',
            details: {
                message: 'Forbidden'
            }
        });
    });
});
