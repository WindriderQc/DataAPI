const http = require('http');
const https = require('https');
const { URL } = require('url');
const { log } = require('../utils/logger');

const CHATKIT_BETA_HEADER = 'chatkit_beta=v1';
const REALTIME_BETA_HEADER = 'realtime=v1';
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
                            return { _parse_error: true, _raw: text };
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
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), CHATKIT_TIMEOUT_MS);
        return fetch(url, { ...options, signal: controller.signal })
            .finally(() => clearTimeout(timeout));
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
    log(`ChatKit token request received.`, 'debug');
    log(`Request body type: ${typeof req.body}`, 'debug');
    log(`Request body: ${JSON.stringify(req.body)}`, 'debug');
    log(`Request body.agentId: ${req.body?.agentId}`, 'debug');
    log(`Environment CHATKIT_AGENT_ID: ${process.env.CHATKIT_AGENT_ID ? 'SET' : 'NOT SET'}`, 'debug');
    log(`Environment CHATKIT_AGENT_ID value: ${process.env.CHATKIT_AGENT_ID}`, 'debug');
    
    const agentId = getAgentId(req.body && req.body.agentId);
    if (!agentId) {
        log(`ChatKit agent ID not found. Body agentId: ${req.body?.agentId}, Env CHATKIT_AGENT_ID: ${process.env.CHATKIT_AGENT_ID}`, 'error');
        return res.status(400).json({
            status: 'error',
            message: 'Chat agent ID is not configured.',
            debug: {
                bodyAgentId: req.body?.agentId || null,
                envAgentIdSet: !!process.env.CHATKIT_AGENT_ID,
                envAgentIdValue: process.env.CHATKIT_AGENT_ID || null
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
        
        // Add version only if explicitly configured
        if (process.env.CHATKIT_WORKFLOW_VERSION) {
            payload.workflow.version = process.env.CHATKIT_WORKFLOW_VERSION;
        }

        const apiUrl = `https://api.openai.com/v1/chatkit/sessions`;
        log(`Attempting to create ChatKit session. URL: ${apiUrl}, Workflow ID: ${agentId}, User: ${userId}`, 'info');
        log(`Payload: ${JSON.stringify(payload)}`, 'debug');

        const response = await sendSessionRequest(apiUrl, {
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

        log(`OpenAI API response status: ${response.status}, OK: ${response.ok}`, 'debug');
        
        // Redact sensitive data before logging
        const safeSessionLog = (() => {
            try {
                const clone = JSON.parse(JSON.stringify(session || {}));
                if (clone.client_secret) {
                    clone.client_secret = typeof clone.client_secret === 'string' 
                        ? '[REDACTED]' 
                        : { ...clone.client_secret, value: '[REDACTED]' };
                }
                return JSON.stringify(clone);
            } catch {
                return '[unserializable session]';
            }
        })();
        log(`Session response: ${safeSessionLog}`, 'debug');

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

    try {
        // Send message to workflow using ChatKit API (authorized with session token)
        const apiUrl = `https://api.openai.com/v1/chatkit/sessions/${sessionId}/messages`;
        log(`Sending message to ChatKit session ${sessionId}`, 'info');

        const response = await sendSessionRequest(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                Authorization: `Bearer ${token}`,
                'OpenAI-Beta': CHATKIT_BETA_HEADER,
                'User-Agent': 'DataAPI-ChatKit/1.0'
            },
            body: JSON.stringify({
                role: 'user',
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

const createRealtimeSession = async (req, res) => {
    const agentId = getAgentId(req.body && req.body.agentId);

    if (!agentId) {
        log('Realtime session requested without workflow ID.', 'error');
        return res.status(400).json({
            status: 'error',
            message: 'Chat agent ID is not configured for realtime sessions.'
        });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        log('Realtime session requested but OPENAI_API_KEY is not set.', 'error');
        return res.status(500).json({
            status: 'error',
            message: 'Realtime voice agent unavailable. Contact the administrator.'
        });
    }

    const model = process.env.OPENAI_REALTIME_MODEL || 'gpt-4o-realtime-preview-2024-10-01';
    const voice = process.env.OPENAI_REALTIME_VOICE || 'alloy';

    // Note: The Realtime API doesn't support workflow/agent IDs in the same way as ChatKit.
    // Workflows/instructions must be configured via session.update events over WebRTC data channel
    // or via the 'instructions' parameter if the model supports it.
    const payload = {
        model,
        voice
    };

    // Add modalities if specified
    if (process.env.OPENAI_REALTIME_MODALITIES) {
        payload.modalities = process.env.OPENAI_REALTIME_MODALITIES.split(',').map(m => m.trim());
    }

    // Add instructions if specified (for agent behavior)
    if (process.env.OPENAI_REALTIME_INSTRUCTIONS) {
        payload.instructions = process.env.OPENAI_REALTIME_INSTRUCTIONS;
    }

    log(`Creating realtime session. Model: ${model}, Voice: ${voice}, Agent: ${agentId}`, 'info');
    log(`Realtime payload: ${JSON.stringify(payload)}`, 'debug');

    try {
        const apiUrl = 'https://api.openai.com/v1/realtime/sessions';
        const response = await sendSessionRequest(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                Authorization: `Bearer ${apiKey}`,
                'OpenAI-Beta': REALTIME_BETA_HEADER,
                'User-Agent': 'DataAPI-Realtime/1.0'
            },
            body: JSON.stringify(payload)
        });

        const session = await (response && typeof response.json === 'function'
            ? response.json().catch(() => ({}))
            : Promise.resolve({}));

        log(`Realtime session response status: ${response.status}, OK: ${response.ok}`, 'debug');

        if (!response.ok) {
            const errorMessage = session?.error?.message || `Failed to create realtime session (status ${response.status}).`;
            log(`Realtime session creation failed: ${errorMessage}`, 'error');
            return res.status(response.status).json({
                status: 'error',
                message: errorMessage,
                details: session.error || null
            });
        }

        const clientSecret = session?.client_secret?.value || session?.client_secret || null;

        if (!clientSecret) {
            log('Realtime session response missing client_secret.', 'error');
            return res.status(502).json({
                status: 'error',
                message: 'Invalid realtime session response (no client secret).'
            });
        }

        const expiresAt = session?.client_secret?.expires_at || null;

        return res.json({
            status: 'success',
            message: 'Realtime session created.',
            data: {
                token: {
                    value: clientSecret,
                    expires_at: expiresAt
                },
                sessionId: session.id || null,
                agentId,
                model,
                voice
            }
        });
    } catch (error) {
        log(`Unexpected error creating realtime session: ${error.message}`, 'error');
        log(`Realtime error stack: ${error.stack}`, 'error');
        return res.status(500).json({
            status: 'error',
            message: 'Unable to create realtime session at this time.',
            details: error.message
        });
    }
};

module.exports = {
    createSessionToken,
    sendChatMessage,
    createRealtimeSession
};
