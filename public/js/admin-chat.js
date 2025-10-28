import { ChatKit } from 'https://cdn.jsdelivr.net/npm/@openai/chatkit@latest/+esm';

const defaultMountId = 'admin-chat';

const selectMountElement = (elementId) => {
    if (typeof elementId === 'string' && elementId.length > 0) {
        return document.getElementById(elementId);
    }
    return document.getElementById(defaultMountId);
};

const extractTokenFromPayload = (payload) => {
    if (!payload) {
        return null;
    }
    if (payload.token) {
        return payload.token;
    }
    if (payload.data) {
        const nested = extractTokenFromPayload(payload.data);
        if (nested) {
            return nested;
        }
    }
    if (payload.clientSecret) {
        return payload.clientSecret;
    }
    if (payload.client_secret && payload.client_secret.value) {
        return payload.client_secret.value;
    }
    return null;
};

const extractMessageFromPayload = (payload, fallback) => {
    if (!payload) {
        return fallback;
    }
    if (typeof payload.message === 'string') {
        return payload.message;
    }
    if (payload.data) {
        const nestedMessage = extractMessageFromPayload(payload.data);
        if (nestedMessage) {
            return nestedMessage;
        }
    }
    if (payload.error && typeof payload.error.message === 'string') {
        return payload.error.message;
    }
    return fallback;
};

export async function bootstrapAdminChat(options = {}) {
    const {
        elementId = defaultMountId,
        agentId,
        tokenEndpoint = '/api/v1/chatkit/token'
    } = options;

    const mountElement = selectMountElement(elementId);
    if (!mountElement) {
        return;
    }

    const resolvedAgentId = agentId || mountElement.dataset.agentId;
    if (!resolvedAgentId) {
        mountElement.innerHTML = '<div class="chatkit-placeholder">Chat agent is not configured.</div>';
        return;
    }

    mountElement.classList.add('chatkit-loading');

    try {
        const response = await fetch(tokenEndpoint, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ agentId: resolvedAgentId })
        });

        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
            const message = extractMessageFromPayload(payload, 'Unable to fetch chat token.');
            mountElement.innerHTML = `<div class="chatkit-error">${message}</div>`;
            return;
        }

        const token = extractTokenFromPayload(payload);
        if (!token) {
            mountElement.innerHTML = '<div class="chatkit-error">Chat token missing from response.</div>';
            return;
        }

        const session = payload.data || payload;
        if (session && session.expiresAt) {
            mountElement.dataset.expiresAt = session.expiresAt;
        }

        await ChatKit.render({
            element: mountElement,
            token,
            agentId: resolvedAgentId
        });
    } catch (error) {
        console.error('Failed to initialize admin chat', error);
        mountElement.innerHTML = '<div class="chatkit-error">Failed to load chat interface.</div>';
    } finally {
        mountElement.classList.remove('chatkit-loading');
    }
}
