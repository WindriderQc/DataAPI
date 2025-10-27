const { log } = require('../utils/logger');

const CHATKIT_BETA_HEADER = 'agents=v1';

const fetchImpl = async (...args) => {
    if (typeof fetch === 'function') {
        return fetch(...args);
    }
    const { default: nodeFetch } = await import('node-fetch');
    return nodeFetch(...args);
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
        if (res.locals && res.locals.user && res.locals.user.email) {
            metadata.email = res.locals.user.email;
        }

        const response = await fetchImpl(`https://api.openai.com/v1/agents/${agentId}/sessions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
                'OpenAI-Beta': CHATKIT_BETA_HEADER
            },
            body: JSON.stringify({
                metadata: Object.keys(metadata).length ? metadata : undefined
            })
        });

        const session = await response.json().catch(() => ({}));

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
            token,
            expiresAt: session.client_secret.expires_at || null,
            sessionId: session.id || null,
            agentId
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
