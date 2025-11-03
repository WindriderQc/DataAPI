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

const ICE_GATHERING_TIMEOUT_MS = 15000; // Increased to 15 seconds for better reliability

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
                
                <!-- Conversation Transcript Panel - Full Width -->
                <div class="voice-panel voice-panel-full">
                    <div class="voice-panel-header">
                        <strong>💬 Conversation</strong>
                        <button class="voice-panel-clear" data-target="transcript">Clear</button>
                    </div>
                    <div class="voice-transcript" id="voice-transcript"></div>
                </div>
                
                <!-- Two-Column Events Panel -->
                <div class="voice-panel voice-panel-full">
                    <div class="voice-events-grid">
                        <!-- Status & API Events -->
                        <div class="voice-events-column">
                            <div class="voice-panel-header">
                                <strong>⚡ Status & API Events</strong>
                                <button class="voice-panel-clear" data-target="status">Clear</button>
                            </div>
                            <div class="voice-status-events" id="voice-status-events"></div>
                        </div>
                        
                        <!-- Keyword Detections -->
                        <div class="voice-events-column">
                            <div class="voice-panel-header">
                                <strong>🔍 Keyword Detections</strong>
                                <button class="voice-panel-clear" data-target="keywords">Clear</button>
                            </div>
                            <div class="voice-keyword-events" id="voice-keyword-events"></div>
                        </div>
                    </div>
                </div>
                
                <div class="voice-log" aria-live="polite"></div>
                <audio class="voice-audio" autoplay playsinline></audio>
            </div>
            
            <style>
                .voice-agent {
                    font-family: system-ui, -apple-system, sans-serif;
                }
                .voice-status {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 16px;
                    background: #1a1a1a;
                    border-radius: 8px;
                    margin-bottom: 16px;
                }
                .voice-status-indicator {
                    width: 12px;
                    height: 12px;
                    border-radius: 50%;
                    background: #666;
                    transition: background 0.3s;
                }
                .voice-status-indicator[data-state="idle"] { background: #666; }
                .voice-status-indicator[data-state="connecting"] { 
                    background: #ffa500; 
                    animation: pulse 1.5s infinite;
                }
                .voice-status-indicator[data-state="connected"] { background: #00ff00; }
                .voice-status-indicator[data-state="error"] { background: #ff0000; }
                
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
                
                .voice-controls {
                    display: flex;
                    gap: 12px;
                    margin-bottom: 16px;
                }
                .voice-btn {
                    padding: 10px 20px;
                    border: none;
                    border-radius: 6px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .voice-start-btn {
                    background: #0066cc;
                    color: white;
                }
                .voice-start-btn:hover:not(:disabled) {
                    background: #0052a3;
                }
                .voice-stop-btn {
                    background: #dc3545;
                    color: white;
                }
                .voice-stop-btn:hover:not(:disabled) {
                    background: #bb2d3b;
                }
                .voice-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                
                .voice-panel {
                    background: #1a1a1a;
                    border-radius: 8px;
                    overflow: hidden;
                    margin-bottom: 16px;
                }
                .voice-panel-full {
                    width: 100%;
                }
                .voice-panel-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 12px 16px;
                    background: #252525;
                    border-bottom: 1px solid #333;
                }
                .voice-panel-clear {
                    padding: 4px 12px;
                    background: #444;
                    color: #fff;
                    border: none;
                    border-radius: 4px;
                    font-size: 12px;
                    cursor: pointer;
                }
                .voice-panel-clear:hover {
                    background: #555;
                }
                
                .voice-events-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1px;
                    background: #333;
                }
                .voice-events-column {
                    background: #1a1a1a;
                }
                
                .voice-transcript, .voice-status-events, .voice-keyword-events {
                    max-height: 300px;
                    overflow-y: auto;
                    padding: 16px;
                }
                
                .transcript-message {
                    margin-bottom: 12px;
                    padding: 8px 12px;
                    border-radius: 6px;
                    animation: fadeIn 0.3s;
                }
                .transcript-message.user {
                    background: #1e3a5f;
                    margin-left: 20px;
                }
                .transcript-message.agent {
                    background: #2d2d2d;
                    margin-right: 20px;
                }
                .transcript-message-label {
                    font-size: 11px;
                    font-weight: 600;
                    text-transform: uppercase;
                    color: #888;
                    margin-bottom: 4px;
                }
                .transcript-message-text {
                    color: #fff;
                    line-height: 1.5;
                }
                
                .action-item {
                    margin-bottom: 12px;
                    padding: 12px;
                    background: #2d2d2d;
                    border-radius: 6px;
                    border-left: 4px solid #0066cc;
                    animation: fadeIn 0.3s;
                }
                .action-item.success {
                    border-left-color: #28a745;
                }
                .action-item.error {
                    border-left-color: #dc3545;
                }
                .action-item.keyword {
                    border-left-color: #ffa500;
                }
                .action-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 8px;
                }
                .action-title {
                    font-weight: 600;
                    color: #fff;
                }
                .action-timestamp {
                    font-size: 11px;
                    color: #888;
                }
                .action-details {
                    font-size: 13px;
                    color: #ccc;
                    white-space: pre-wrap;
                    font-family: 'Courier New', monospace;
                }
                
                @keyframes fadeIn {
                    from {
                        opacity: 0;
                        transform: translateY(-10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                
                .voice-log {
                    background: #1a1a1a;
                    border-radius: 8px;
                    padding: 12px;
                    max-height: 150px;
                    overflow-y: auto;
                    font-size: 12px;
                    color: #999;
                }
                .voice-log-entry {
                    padding: 4px 0;
                    border-bottom: 1px solid #2a2a2a;
                }
                .voice-log-entry:last-child {
                    border-bottom: none;
                }
            </style>
        `;

        this.elements.statusIndicator = this.container.querySelector('.voice-status-indicator');
        this.elements.statusText = this.container.querySelector('.voice-status-text');
        this.elements.startBtn = this.container.querySelector('.voice-start-btn');
        this.elements.stopBtn = this.container.querySelector('.voice-stop-btn');
        this.elements.log = this.container.querySelector('.voice-log');
        this.elements.audio = this.container.querySelector('.voice-audio');
        this.elements.transcript = this.container.querySelector('#voice-transcript');
        this.elements.statusEvents = this.container.querySelector('#voice-status-events');
        this.elements.keywordEvents = this.container.querySelector('#voice-keyword-events');
    }

    bindEvents() {
        this.elements.startBtn.addEventListener('click', () => this.startSession());
        this.elements.stopBtn.addEventListener('click', () => this.stopSession());
        
        // Clear buttons
        this.container.querySelectorAll('.voice-panel-clear').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.target.dataset.target;
                if (target === 'transcript') {
                    this.elements.transcript.innerHTML = '';
                } else if (target === 'status') {
                    this.elements.statusEvents.innerHTML = '';
                } else if (target === 'keywords') {
                    this.elements.keywordEvents.innerHTML = '';
                }
            });
        });
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
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' }
            ]
        });

        this.remoteStream = new MediaStream();
        this.elements.audio.srcObject = this.remoteStream;

        pc.ontrack = (event) => {
            this.log('Receiving remote audio track');
            event.streams[0].getAudioTracks().forEach((track) => {
                this.remoteStream.addTrack(track);
            });
        };

        pc.oniceconnectionstatechange = () => {
            const { iceConnectionState } = pc;
            this.log(`ICE connection state: ${iceConnectionState}`);
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
            this.handleRealtimeEvent(event.data);
        };
        this.dataChannel.onopen = () => {
            this.log('Data channel established.');
            this.onDataChannelOpen();
        };
        this.dataChannel.onerror = (error) => {
            console.error('Data channel error:', error);
        };

        return pc;
    }

    onDataChannelOpen() {
        // Optional: Send session configuration or function definitions
        // Example: Enable function calling
        const sessionUpdate = {
            type: 'session.update',
            session: {
                // IMPORTANT: Clear instructions about what the agent CAN and CANNOT do
                instructions: `You are a data assistant for the DataAPI platform.


When users ask what data you have access to, ONLY mention:
- Recent earthquake data (magnitude, location, depth, time)
- International Space Station real-time position and tracking
- Database queries for stored information

If asked about capabilities you don't have, politely say "I don't have access to that data yet, but I let hope somebody  gets it butt to the job."

Be helpful, accurate, and never claim capabilities you don't have.`,
                
                // Define tools/functions the agent can call
                tools: [
                    {
                        type: 'function',
                        name: 'get_earthquake_data',
                        description: 'Retrieve recent earthquake information from the database',
                        parameters: {
                            type: 'object',
                            properties: {
                                limit: {
                                    type: 'number',
                                    description: 'Number of earthquakes to retrieve'
                                },
                                minMagnitude: {
                                    type: 'number',
                                    description: 'Minimum magnitude filter'
                                }
                            }
                        }
                    },
                    {
                        type: 'function',
                        name: 'get_iss_position',
                        description: 'Get the current position of the International Space Station'
                    },
                    {
                        type: 'function',
                        name: 'query_database',
                        description: 'Execute a database query',
                        parameters: {
                            type: 'object',
                            properties: {
                                collection: {
                                    type: 'string',
                                    description: 'Database collection to query'
                                },
                                query: {
                                    type: 'string',
                                    description: 'Query description in natural language'
                                }
                            },
                            required: ['collection', 'query']
                        }
                    }
                ],
                tool_choice: 'auto'
            }
        };
        
        // Enable function calling - agent can now call your APIs!
        this.sendDataChannelMessage(sessionUpdate);
        this.log('Function calling enabled. Agent can call: get_earthquake_data, get_iss_position, query_database');
    }

    handleRealtimeEvent(data) {
        try {
            const event = JSON.parse(data);
            console.log('[Realtime Event]', event.type, event);

            switch (event.type) {
                // === Session Events ===
                case 'session.created':
                    this.updateState(STATES.connected, '✅ Session initialized');
                    break;

                case 'session.updated':
                    this.log('Session configuration updated');
                    break;

                // === User Input Events ===
                case 'input_audio_buffer.speech_started':
                    this.updateState(STATES.connected, '🎤 Listening...');
                    this.addActionItem('status', '🎤 User Speaking', 'Detecting speech input...');
                    break;

                case 'input_audio_buffer.speech_stopped':
                    this.updateState(STATES.connected, '⏸️ Processing speech...');
                    this.addActionItem('status', '⏸️ Speech Ended', 'Transcribing audio...');
                    break;

                case 'input_audio_buffer.committed':
                    this.addActionItem('status', '📝 Audio Committed', 'Audio buffer sent for processing');
                    break;

                case 'conversation.item.input_audio_transcription.completed':
                    // User's speech transcribed
                    this.log(`You: ${event.transcript}`);
                    this.onUserSpeech(event.transcript);
                    break;

                // === Agent Response Events ===
                case 'response.created':
                    this.updateState(STATES.connected, '🤔 Thinking...');
                    this.addActionItem('status', '🤔 Agent Thinking', 'Generating response...');
                    break;

                case 'response.audio.delta':
                    // Agent is streaming audio (speaking)
                    if (!this.elements.statusText.textContent.includes('💬 Speaking')) {
                        this.updateState(STATES.connected, '💬 Speaking...');
                    }
                    break;

                case 'response.audio.done':
                    this.updateState(STATES.connected, '✅ Response complete');
                    break;

                case 'response.audio_transcript.delta':
                    // Partial transcript of agent's speech
                    console.log('[Agent Speech]', event.delta);
                    break;

                case 'response.audio_transcript.done':
                    // Complete transcript of agent's response
                    this.log(`Agent: ${event.transcript}`);
                    this.onAgentResponse(event.transcript);
                    break;

                case 'response.done':
                    this.updateState(STATES.connected, '✨ Ready');
                    this.addActionItem('status', '✅ Response Complete', 'Agent finished responding');
                    break;

                // === Function Calling Events ===
                case 'response.function_call_arguments.delta':
                    this.updateState(STATES.connected, '🔧 Calling API...');
                    break;

                case 'response.function_call_arguments.done':
                    // Agent wants to call a function
                    this.updateState(STATES.connected, '📡 Waiting for data...');
                    this.addActionItem('status', '🔧 API Call Initiated', `Function: ${event.name}`);
                    this.handleFunctionCall(event.name, event.arguments);
                    break;

                case 'conversation.item.created':
                    // New item in conversation (user or assistant message)
                    if (event.item?.content) {
                        this.handleConversationItem(event.item);
                    }
                    break;

                // === Rate Limiting ===
                case 'rate_limits.updated':
                    const limits = event.rate_limits || [];
                    const requestLimits = limits.find(l => l.name === 'requests');
                    if (requestLimits) {
                        const remaining = requestLimits.remaining;
                        const limit = requestLimits.limit;
                        this.addActionItem('status', '⚠️ Rate Limits', 
                            `Requests remaining: ${remaining}/${limit}\nResets: ${new Date(requestLimits.reset_seconds * 1000).toLocaleTimeString()}`);
                    }
                    break;

                // === Error Handling ===
                case 'error':
                    console.error('[Realtime Error]', event.error);
                    this.updateState(STATES.error, `❌ Error: ${event.error?.message || 'Unknown'}`);
                    this.log(`Error: ${event.error?.message || 'Unknown error'}`);
                    this.addActionItem('error', '❌ Error', event.error?.message || 'Unknown error');
                    break;

                default:
                    // Log other event types for debugging
                    console.debug('[Realtime Event]', event.type);
            }
        } catch (error) {
            console.error('Failed to parse realtime event:', error);
        }
    }

    onUserSpeech(transcript) {
        // Hook: Called when user's speech is transcribed
        console.log('[User Said]', transcript);
        
        // Display in transcript panel
        this.addTranscriptMessage('user', transcript);
        
        // Detect keywords and trigger actions
        const lower = transcript.toLowerCase();
        const keywords = [];
        
        if (lower.includes('earthquake') || lower.includes('quake')) {
            keywords.push('earthquake');
            this.addActionItem('keyword', '🟠 Earthquake Keyword Detected', 
                `User mentioned earthquakes. Could trigger: fetch recent quakes, show map, etc.\nTranscript: "${transcript}"`);
        }
        
        if (lower.includes('iss') || lower.includes('space station')) {
            keywords.push('ISS');
            this.addActionItem('keyword', '🟠 ISS Keyword Detected', 
                `User asked about ISS. Could trigger: fetch position, show trajectory, etc.\nTranscript: "${transcript}"`);
        }
        
        if (lower.includes('weather') || lower.includes('temperature')) {
            keywords.push('weather');
            this.addActionItem('keyword', '🟠 Weather Keyword Detected', 
                `User asked about weather. Could trigger: fetch current conditions, forecast, etc.\nTranscript: "${transcript}"`);
        }
        
        if (lower.includes('database') || lower.includes('query') || lower.includes('data')) {
            keywords.push('database');
            this.addActionItem('keyword', '🟠 Database Keyword Detected', 
                `User mentioned database/data. Could trigger: show collections, run queries, etc.\nTranscript: "${transcript}"`);
        }
        
        // Log detected keywords
        if (keywords.length > 0) {
            console.log(`Keywords detected: ${keywords.join(', ')}`);
        }
    }

    onAgentResponse(transcript) {
        // Hook: Called when agent's response is complete
        console.log('[Agent Said]', transcript);
        
        // Display in transcript panel
        this.addTranscriptMessage('agent', transcript);
    }

    addTranscriptMessage(role, text) {
        const message = document.createElement('div');
        message.className = `transcript-message ${role}`;
        message.innerHTML = `
            <div class="transcript-message-label">${role === 'user' ? 'You' : 'Agent'}</div>
            <div class="transcript-message-text">${this.escapeHtml(text)}</div>
        `;
        this.elements.transcript.appendChild(message);
        
        // Scroll to bottom - multiple methods for reliability
        this.elements.transcript.scrollTop = this.elements.transcript.scrollHeight;
        
        // Also use scrollIntoView for the latest message
        requestAnimationFrame(() => {
            message.scrollIntoView({ behavior: 'smooth', block: 'end' });
        });
    }

    addActionItem(type, title, details) {
        const item = document.createElement('div');
        item.className = `action-item ${type}`;
        const timestamp = new Date().toLocaleTimeString();
        item.innerHTML = `
            <div class="action-header">
                <div class="action-title">${this.escapeHtml(title)}</div>
                <div class="action-timestamp">${timestamp}</div>
            </div>
            <div class="action-details">${this.escapeHtml(details)}</div>
        `;
        
        // Route to appropriate column
        const targetElement = (type === 'keyword') ? this.elements.keywordEvents : this.elements.statusEvents;
        targetElement.appendChild(item);
        
        // Scroll to bottom - multiple methods for reliability
        targetElement.scrollTop = targetElement.scrollHeight;
        
        // Also use scrollIntoView for the latest item
        requestAnimationFrame(() => {
            item.scrollIntoView({ behavior: 'smooth', block: 'end' });
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async handleFunctionCall(functionName, args) {
        console.log('[Function Call]', functionName, args);
        this.log(`Calling function: ${functionName}`);
        
        // Show function call in actions panel
        this.addActionItem('info', `🔵 Function Call: ${functionName}`, 
            `Arguments:\n${JSON.stringify(args, null, 2)}\n\nExecuting...`);

        let result;
        try {
            // Route function calls to your API
            switch (functionName) {
                case 'get_earthquake_data':
                    result = await this.callApiFunction('/api/v1/quakes', 'GET', args);
                    break;
                case 'get_iss_position':
                    result = await this.callApiFunction('/api/v1/iss', 'GET', args);
                    break;
                case 'query_database':
                    result = await this.callApiFunction('/api/v1/databases/query', 'POST', args);
                    break;
                default:
                    result = { error: `Unknown function: ${functionName}` };
            }

            // Show success result
            this.addActionItem('success', `🟢 ✓ ${functionName} - Success`, 
                `Result:\n${JSON.stringify(result, null, 2)}`);

            // Send function result back to the agent
            this.sendFunctionResult(functionName, result);
        } catch (error) {
            console.error('Function call failed:', error);
            
            // Show error result
            this.addActionItem('error', `🔴 ✗ ${functionName} - Failed`, 
                `Error: ${error.message}\n\nStack:\n${error.stack || 'N/A'}`);
            
            this.sendFunctionResult(functionName, { error: error.message });
        }
    }

    async callApiFunction(endpoint, method = 'GET', params = {}) {
        const options = {
            method,
            headers: { 'Content-Type': 'application/json' }
        };

        let url = endpoint;
        
        if (method === 'GET' && Object.keys(params).length > 0) {
            // Add query parameters for GET requests
            const queryParams = new URLSearchParams();
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    queryParams.append(key, value);
                }
            });
            const queryString = queryParams.toString();
            if (queryString) {
                url = `${endpoint}?${queryString}`;
            }
        } else if (method === 'POST') {
            // Add body for POST requests
            options.body = JSON.stringify(params);
        }

        const response = await fetch(url, options);
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API returned ${response.status}: ${errorText}`);
        }
        
        return response.json();
    }

    sendFunctionResult(functionName, result) {
        const message = {
            type: 'conversation.item.create',
            item: {
                type: 'function_call_output',
                call_id: functionName, // Should use actual call_id from the function call event
                output: JSON.stringify(result)
            }
        };
        this.sendDataChannelMessage(message);
    }

    sendDataChannelMessage(message) {
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
            this.dataChannel.send(JSON.stringify(message));
        } else {
            console.warn('Data channel not open, cannot send message');
        }
    }

    handleConversationItem(item) {
        // Process conversation items (messages)
        console.log('[Conversation Item]', item);
    }

    async exchangeSdp(sdp, session) {
        const url = `https://api.openai.com/v1/realtime?model=${encodeURIComponent(session.model)}&voice=${encodeURIComponent(session.voice || '')}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${session.token}`,
                'Content-Type': 'application/sdp',
                'OpenAI-Beta': 'realtime=v1'
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
    console.log(`[ICE] Initial gathering state: ${pc.iceGatheringState}`);
    
    if (pc.iceGatheringState === 'complete') {
        console.log('[ICE] Already complete, proceeding');
        return;
    }

    await new Promise((resolve, reject) => {
        let timeoutId = null;
        let candidateCount = 0;

        const checkState = () => {
            console.log(`[ICE] State changed to: ${pc.iceGatheringState}, candidates: ${candidateCount}`);
            if (pc.iceGatheringState === 'complete') {
                cleanup();
                resolve();
            }
        };

        const onIceCandidate = (event) => {
            if (event.candidate) {
                candidateCount++;
                console.log(`[ICE] Candidate ${candidateCount}:`, event.candidate.type, event.candidate.protocol);
            } else {
                console.log('[ICE] Null candidate received (gathering complete)');
                cleanup();
                resolve();
            }
        };

        const cleanup = () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            pc.removeEventListener('icegatheringstatechange', checkState);
            pc.removeEventListener('icecandidate', onIceCandidate);
        };

        timeoutId = setTimeout(() => {
            console.warn(`[ICE] Timeout after ${ICE_GATHERING_TIMEOUT_MS}ms with ${candidateCount} candidates`);
            cleanup();
            // If we have at least one candidate, proceed anyway
            if (candidateCount > 0) {
                console.log('[ICE] Proceeding with available candidates');
                resolve();
            } else {
                reject(new Error(`ICE gathering timeout (no candidates collected).`));
            }
        }, ICE_GATHERING_TIMEOUT_MS);

        pc.addEventListener('icegatheringstatechange', checkState);
        pc.addEventListener('icecandidate', onIceCandidate);
        checkState();
    });
}
