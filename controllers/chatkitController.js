const http = require('http');
const https = require('https');
const { URL } = require('url');
const { log } = require('../utils/logger');

const CHATKIT_BETA_HEADER = 'agents=v1';
const CHATKIT_TIMEOUT_MS = 10000;

const performHttpRequest = (url, options = {}) => {
    const targetUrl = new URL(url);
    const transport = targetUrl.protocol === 'https:' ? https : http;

    return new Promise((resolve, reject) => {
        const requestOptions = {
            protocol: targetUrl.protocol,
            hostname: targetUrl.hostname,
            port: targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
            path: `${targetUrl.pathname}${targetUrl.search}`,
            method: options.method || 'GET',
            headers: options.headers || {}
        };

        const req = transport.request(requestOptions, (res) => {
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
                const buffer = Buffer.concat(chunks);
                const text = buffer.toString('utf8');
                const response = {
                    status: res.statusCode,
                    ok: res.statusCode >= 200 && res.statusCode < 300,
                    headers: res.headers,
                    async text() {
                        return text;
                    },
                    async json() {
                        if (!text) {
                            return {};
                        }
                        try {
                            return JSON.parse(text);
                        } catch (err) {
                            log(`ChatKit session response JSON parse failed: ${err.message}`, 'warn');
                            return {};
                        }
                    }
                };
                resolve(response);
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.setTimeout(CHATKIT_TIMEOUT_MS, () => {
            req.destroy(new Error('ChatKit session request timed out'));
        });

        if (options.body) {
            req.write(options.body);
        }

        req.end();
    });
};

const sendSessionRequest = (url, options) => {
    if (typeof fetch === 'function') {
        return fetch(url, options);
    }
    return performHttpRequest(url, options);
};

const getAgentId = (bodyAgentId) => {
    if (bodyAgentId && typeof bodyAgentId === 'string' && bodyAgentId.trim().length > 0) {
        return bodyAgentId.trim();
    }
    if (process.env.CHATKIT_AGENT_ID && process.env.CHATKIT_AGENT_ID.trim().length > 0) {
        return process.env.CHATKIT_AGENT_ID.trim();
    }
    return null;
};

const createSessionToken = async (req, res) => {
    const agentId = getAgentId(req.body && req.body.agentId);
    if (!agentId) {
        return res.status(400).json({
            status: 'error',
            message: 'Chat agent ID is not configured.'
        });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        log('ChatKit token requested but OPENAI_API_KEY is not set.', 'error');
        return res.status(500).json({
            status: 'error',
            message: 'Chat agent is not available. Contact the administrator.'
        });
    }

    try {
        const metadata = {};
        if (req.session && req.session.userId) {
            metadata.userId = req.session.userId;
        }
        if (res.locals && res.locals.user) {
            if (res.locals.user.email) {
                metadata.email = res.locals.user.email;
            }
            if (res.locals.user.name) {
                metadata.name = res.locals.user.name;
            }
        }

        const payload = {};
        if (Object.keys(metadata).length > 0) {
            payload.metadata = metadata;
        }

        const response = await sendSessionRequest(`https://api.openai.com/v1/agents/${agentId}/sessions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                Authorization: `Bearer ${apiKey}`,
                'OpenAI-Beta': CHATKIT_BETA_HEADER,
                'User-Agent': 'DataAPI-ChatKit/1.0'
            },
            body: JSON.stringify(payload)
        });

        const session = await (response && typeof response.json === 'function'
            ? response.json().catch(() => ({}))
            : Promise.resolve({}));

        if (!response.ok) {
            const errorMessage = session && session.error && session.error.message
                ? session.error.message
                : `Failed to create ChatKit session (status ${response.status}).`;
            log(`ChatKit session creation failed: ${errorMessage}`, 'error');
            return res.status(response.status).json({
                status: 'error',
                message: errorMessage
            });
        }

        const token = session && session.client_secret && session.client_secret.value
            ? session.client_secret.value
            : null;

        if (!token) {
            log('ChatKit session response did not include a client secret.', 'error');
            return res.status(502).json({
                status: 'error',
                message: 'Invalid response from ChatKit session service.'
            });
        }

        return res.json({
            status: 'success',
            message: 'Chat session token issued.',
            data: {
                token,
                expiresAt: session.client_secret.expires_at || null,
                sessionId: session.id || null,
                agentId
            }
        });
    } catch (error) {
        log(`Unexpected error creating ChatKit session: ${error.message}`, 'error');
        return res.status(500).json({
            status: 'error',
            message: 'Unable to create chat session at this time.'
        });
    }
};

module.exports = {
    createSessionToken
};
