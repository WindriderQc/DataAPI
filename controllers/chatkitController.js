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
    log(`ChatKit token request received. Body: ${JSON.stringify(req.body)}`, 'debug');
    log(`Environment CHATKIT_AGENT_ID: ${process.env.CHATKIT_AGENT_ID ? 'SET' : 'NOT SET'}`, 'debug');
    
    const agentId = getAgentId(req.body && req.body.agentId);
    if (!agentId) {
        log(`ChatKit agent ID not found. Body agentId: ${req.body?.agentId}, Env CHATKIT_AGENT_ID: ${process.env.CHATKIT_AGENT_ID}`, 'error');
        return res.status(400).json({
            status: 'error',
            message: 'Chat agent ID is not configured.',
            debug: {
                bodyAgentId: req.body?.agentId || null,
                envAgentIdSet: !!process.env.CHATKIT_AGENT_ID
            }
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
        // Generate a unique user identifier
        let userId = 'anonymous';
        
        if (req.session && req.session.userId) {
            userId = req.session.userId;
        }
        if (res.locals && res.locals.user) {
            if (res.locals.user.email) {
                userId = res.locals.user.email;
            }
        }

        const payload = {
            workflow: {
                id: agentId
            },
            user: userId
        };

        const apiUrl = `https://api.openai.com/v1/chatkit/sessions`;
        log(`Attempting to create ChatKit session. URL: ${apiUrl}, Workflow ID: ${agentId}, User: ${userId}`, 'info');
        log(`Payload: ${JSON.stringify(payload)}`, 'debug');

        const response = await sendSessionRequest(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                Authorization: `Bearer ${apiKey}`,
                'OpenAI-Beta': 'agents=v1',
                'User-Agent': 'DataAPI-ChatKit/1.0'
            },
            body: JSON.stringify(payload)
        });

        const session = await (response && typeof response.json === 'function'
            ? response.json().catch(() => ({}))
            : Promise.resolve({}));

        log(`OpenAI API response status: ${response.status}, OK: ${response.ok}`, 'debug');
        log(`Session response: ${JSON.stringify(session)}`, 'debug');

        if (!response.ok) {
            const errorMessage = session && session.error && session.error.message
                ? session.error.message
                : `Failed to create ChatKit session (status ${response.status}).`;
            log(`ChatKit session creation failed: ${errorMessage}`, 'error');
            log(`Full error response: ${JSON.stringify(session)}`, 'error');
            return res.status(response.status).json({
                status: 'error',
                message: errorMessage,
                details: session.error || null
            });
        }

        const token = session && session.client_secret
            ? session.client_secret
            : null;

        if (!token) {
            log('ChatKit session response did not include a client_secret.', 'error');
            log(`Full session object: ${JSON.stringify(session)}`, 'error');
            return res.status(502).json({
                status: 'error',
                message: 'Invalid response from ChatKit session service.',
                details: 'No client_secret in response'
            });
        }

        // Handle both string tokens and object tokens
        let tokenValue, tokenExpiresAt;
        if (typeof token === 'string') {
            tokenValue = token;
            tokenExpiresAt = null; // OpenAI might not always send expiration
        } else if (token.value) {
            tokenValue = token.value;
            tokenExpiresAt = token.expires_at;
        } else {
            log('ChatKit client_secret format is invalid.', 'error');
            log(`Token object: ${JSON.stringify(token)}`, 'error');
            return res.status(502).json({
                status: 'error',
                message: 'Invalid token format from ChatKit session service.'
            });
        }

        return res.json({
            status: 'success',
            message: 'Chat session token issued.',
            data: {
                token: {
                    value: tokenValue,
                    expires_at: tokenExpiresAt
                },
                sessionId: session.id || null,
                agentId
            }
        });
    } catch (error) {
        log(`Unexpected error creating ChatKit session: ${error.message}`, 'error');
        log(`Error stack: ${error.stack}`, 'error');
        return res.status(500).json({
            status: 'error',
            message: 'Unable to create chat session at this time.',
            details: error.message
        });
    }
};

const sendChatMessage = async (req, res) => {
    const { agentId, sessionId, token, message } = req.body;

    if (!agentId || !sessionId || !token || !message) {
        return res.status(400).json({
            status: 'error',
            message: 'Missing required fields: agentId, sessionId, token, or message'
        });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        log('ChatKit message requested but OPENAI_API_KEY is not set.', 'error');
        return res.status(500).json({
            status: 'error',
            message: 'Chat agent is not available.'
        });
    }

    try {
        // Send message to workflow using ChatKit API
        const apiUrl = `https://api.openai.com/v1/chatkit/sessions/${sessionId}/messages`;
        log(`Sending message to ChatKit session ${sessionId}`, 'info');

        const response = await sendSessionRequest(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                Authorization: `Bearer ${token}`,
                'OpenAI-Beta': 'chatkit_beta=v1',
                'User-Agent': 'DataAPI-ChatKit/1.0'
            },
            body: JSON.stringify({
                content: message
            })
        });

        const result = await (response && typeof response.json === 'function'
            ? response.json().catch(() => ({}))
            : Promise.resolve({}));

        log(`ChatKit message response status: ${response.status}, OK: ${response.ok}`, 'debug');
        log(`Message response: ${JSON.stringify(result).substring(0, 500)}`, 'debug');

        if (!response.ok) {
            const errorMessage = result && result.error && result.error.message
                ? result.error.message
                : `Failed to send message (status ${response.status}).`;
            log(`ChatKit message failed: ${errorMessage}`, 'error');
            return res.status(response.status).json({
                status: 'error',
                message: errorMessage
            });
        }

        // Extract assistant response
        const assistantMessage = result && result.content
            ? result.content
            : 'Message sent successfully.';

        return res.json({
            status: 'success',
            message: 'Message delivered.',
            data: {
                content: assistantMessage,
                messageId: result.id || null
            }
        });
    } catch (error) {
        log(`Unexpected error sending ChatKit message: ${error.message}`, 'error');
        return res.status(500).json({
            status: 'error',
            message: 'Unable to send message at this time.'
        });
    }
};

module.exports = {
    createSessionToken,
    sendChatMessage
};
