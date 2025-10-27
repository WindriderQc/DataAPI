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
    if (payload.clientSecret) {
        return payload.clientSecret;
    }
    if (payload.client_secret && payload.client_secret.value) {
        return payload.client_secret.value;
    }
    return null;
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
            const message = payload && payload.message ? payload.message : 'Unable to fetch chat token.';
            mountElement.innerHTML = `<div class="chatkit-error">${message}</div>`;
            return;
        }

        const token = extractTokenFromPayload(payload);
        if (!token) {
            mountElement.innerHTML = '<div class="chatkit-error">Chat token missing from response.</div>';
            return;
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
