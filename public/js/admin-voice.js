/**
 * Realtime voice chat integration for admin feed.
 * Establishes a WebRTC session with OpenAI Realtime API using an ephemeral key.
 */

const STATES = {
    idle: 'idle',
    connecting: 'connecting',
    connected: 'connected',
    error: 'error'
};

const ICE_GATHERING_TIMEOUT_MS = 5000;

export function bootstrapAdminVoice() {
    const container = document.getElementById('admin-voice');
    if (!container) {
        console.warn('admin-voice element not found on page');
        return;
    }

    const agentId = container.getAttribute('data-agent-id');
    if (!agentId) {
        container.innerHTML = '<div class="chatkit-error"><strong>Voice Unavailable</strong><p>No agent ID provided.</p></div>';
        return;
    }

    const controller = new VoiceAgentController(container, agentId);
    controller.init();
}

class VoiceAgentController {
    constructor(container, agentId) {
        this.container = container;
        this.agentId = agentId;
        this.state = STATES.idle;
        this.elements = {};
        this.peerConnection = null;
        this.localStream = null;
        this.remoteStream = null;
        this.dataChannel = null;
        this.sessionMeta = null;
    }

    init() {
        this.render();
        this.bindEvents();
        this.updateState(STATES.idle, 'Ready to connect');
    }

    render() {
        this.container.innerHTML = `
            <div class="voice-agent">
                <div class="voice-status">
                    <span class="voice-status-indicator" data-state="${STATES.idle}"></span>
                    <span class="voice-status-text">Initializing…</span>
                </div>
                <div class="voice-controls">
                    <button class="voice-btn voice-start-btn">Start Voice Session</button>
                    <button class="voice-btn voice-stop-btn" disabled>Hang Up</button>
                </div>
                <div class="voice-log" aria-live="polite"></div>
                <audio class="voice-audio" autoplay playsinline></audio>
            </div>
        `;

        this.elements.statusIndicator = this.container.querySelector('.voice-status-indicator');
        this.elements.statusText = this.container.querySelector('.voice-status-text');
        this.elements.startBtn = this.container.querySelector('.voice-start-btn');
        this.elements.stopBtn = this.container.querySelector('.voice-stop-btn');
        this.elements.log = this.container.querySelector('.voice-log');
        this.elements.audio = this.container.querySelector('.voice-audio');
    }

    bindEvents() {
        this.elements.startBtn.addEventListener('click', () => this.startSession());
        this.elements.stopBtn.addEventListener('click', () => this.stopSession());
    }

    updateState(state, message) {
        this.state = state;
        this.elements.statusIndicator.dataset.state = state;
        this.elements.statusText.textContent = message;

        switch (state) {
            case STATES.idle:
                this.elements.startBtn.disabled = false;
                this.elements.stopBtn.disabled = true;
                break;
            case STATES.connecting:
                this.elements.startBtn.disabled = true;
                this.elements.stopBtn.disabled = true;
                break;
            case STATES.connected:
                this.elements.startBtn.disabled = true;
                this.elements.stopBtn.disabled = false;
                break;
            case STATES.error:
                this.elements.startBtn.disabled = false;
                this.elements.stopBtn.disabled = true;
                break;
            default:
                break;
        }
    }

    log(message) {
        const entry = document.createElement('div');
        entry.className = 'voice-log-entry';
        entry.textContent = message;
        this.elements.log.appendChild(entry);
        this.elements.log.scrollTop = this.elements.log.scrollHeight;
    }

    async startSession() {
        if (this.state === STATES.connecting || this.state === STATES.connected) {
            return;
        }

        this.updateState(STATES.connecting, 'Requesting session…');
        this.log('Fetching realtime session token…');

        try {
            const session = await this.fetchRealtimeSession();
            this.sessionMeta = session;

            this.log(`Session created. Model: ${session.model}, Voice: ${session.voice}`);
            this.updateState(STATES.connecting, 'Initializing audio…');

            const localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.localStream = localStream;

            const pc = this.createPeerConnection();
            this.peerConnection = pc;

            localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

            this.log('Creating SDP offer…');
            const offer = await pc.createOffer({
                offerToReceiveAudio: true,
                voiceActivityDetection: true
            });
            await pc.setLocalDescription(offer);

            await waitForIceGatheringComplete(pc);

            this.log('Sending offer to realtime API…');
            const answer = await this.exchangeSdp(pc.localDescription.sdp, session);

            await pc.setRemoteDescription({
                type: 'answer',
                sdp: answer
            });

            this.updateState(STATES.connected, 'Connected');
            this.log('Voice session connected. You can start speaking.');
        } catch (error) {
            console.error('Voice session error:', error);
            this.log(`Error: ${error.message || error}`);
            this.updateState(STATES.error, 'Connection failed');
            this.stopSession(true);
        }
    }

    async fetchRealtimeSession() {
        const response = await fetch('/api/v1/chatkit/realtime-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ agentId: this.agentId })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || 'Failed to create realtime session.');
        }

        const result = await response.json();
        const data = result.data || {};
        const token = data.token?.value || null;

        if (!token) {
            throw new Error('Realtime session did not return a token.');
        }

        return {
            token,
            sessionId: data.sessionId,
            model: data.model,
            voice: data.voice
        };
    }

    createPeerConnection() {
        const pc = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });

        this.remoteStream = new MediaStream();
        this.elements.audio.srcObject = this.remoteStream;

        pc.ontrack = (event) => {
            event.streams[0].getAudioTracks().forEach((track) => {
                this.remoteStream.addTrack(track);
            });
        };

        pc.onconnectionstatechange = () => {
            const { connectionState } = pc;
            this.log(`Connection state: ${connectionState}`);
            if (connectionState === 'failed' || connectionState === 'disconnected') {
                this.updateState(STATES.error, 'Connection lost');
                this.stopSession(true);
            }
        };

        this.dataChannel = pc.createDataChannel('oai-events', { ordered: true });
        this.dataChannel.onmessage = (event) => {
            this.log(`Agent: ${event.data}`);
        };
        this.dataChannel.onopen = () => {
            this.log('Data channel established.');
        };

        return pc;
    }

    async exchangeSdp(sdp, session) {
        const url = `https://api.openai.com/v1/realtime?model=${encodeURIComponent(session.model)}&voice=${encodeURIComponent(session.voice || '')}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${session.token}`,
                'Content-Type': 'application/sdp'
            },
            body: sdp
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Realtime API error (${response.status}): ${errorText}`);
        }

        return response.text();
    }

    stopSession(silent = false) {
        if (!silent) {
            this.log('Disconnecting session…');
        }

        if (this.dataChannel) {
            try {
                this.dataChannel.close();
            } catch (err) {
                console.warn('Error closing data channel', err);
            }
            this.dataChannel = null;
        }

        if (this.peerConnection) {
            try {
                this.peerConnection.close();
            } catch (err) {
                console.warn('Error closing RTCPeerConnection', err);
            }
            this.peerConnection = null;
        }

        if (this.localStream) {
            this.localStream.getTracks().forEach((track) => track.stop());
            this.localStream = null;
        }

        if (this.remoteStream) {
            this.remoteStream.getTracks().forEach((track) => track.stop());
            this.remoteStream = null;
        }

        this.elements.audio.srcObject = null;

        if (!silent) {
            this.updateState(STATES.idle, 'Ready to connect');
        } else if (this.state !== STATES.error) {
            this.updateState(STATES.idle, 'Ready to connect');
        }
    }
}

async function waitForIceGatheringComplete(pc) {
    if (pc.iceGatheringState === 'complete') {
        return;
    }

    await new Promise((resolve, reject) => {
        let timeoutId = null;

        const checkState = () => {
            if (pc.iceGatheringState === 'complete') {
                cleanup();
                resolve();
            }
        };

        const cleanup = () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            pc.removeEventListener('icegatheringstatechange', checkState);
        };

        timeoutId = setTimeout(() => {
            cleanup();
            reject(new Error('ICE gathering timeout.'));
        }, ICE_GATHERING_TIMEOUT_MS);

        pc.addEventListener('icegatheringstatechange', checkState);
        checkState();
    });
}
