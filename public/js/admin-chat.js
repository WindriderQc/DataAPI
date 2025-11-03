/**
 * ChatKit integration for OpenAI Agents API
 * Uses the ChatKit Web Component (custom element)
 */

export async function bootstrapAdminChat() {
    const container = document.getElementById('admin-chat');
    if (!container) {
        console.warn('admin-chat element not found on page');
        return;
    }

    const agentId = container.getAttribute('data-agent-id');
    if (!agentId || agentId.trim().length === 0) {
        console.log('No agent ID provided; admin chat will not load.');
        return;
    }

    container.classList.add('chatkit-loading');

    // Wait for ChatKit custom element to be defined
    const waitForChatKit = async () => {
        // Check if customElements API is available
        if (!('customElements' in window)) {
            console.error('Custom Elements API not supported in this browser');
            return false;
        }

        // Wait for the openai-chatkit element to be defined
        try {
            await customElements.whenDefined('openai-chatkit');
            return true;
        } catch (error) {
            console.error('Failed to load ChatKit custom element:', error);
            return false;
        }
    };

    const chatkitLoaded = await Promise.race([
        waitForChatKit(),
        new Promise(resolve => setTimeout(() => resolve(false), 10000)) // 10 second timeout
    ]);

    if (chatkitLoaded) {
        try {
            container.classList.remove('chatkit-loading');
            
            console.log('ChatKit custom element loaded, creating chat interface');
            
            // Create the ChatKit custom element
            const chatkit = document.createElement('openai-chatkit');
            
            // Set options on the element
            chatkit.setOptions({
                api: {
                    async getClientSecret(existing) {
                        console.log('ChatKit requesting session token, existing:', existing);
                        console.log('Sending agentId:', agentId);
                        
                        const requestBody = { agentId };
                        console.log('Request body:', JSON.stringify(requestBody));
                        
                        const response = await fetch('/api/v1/chatkit/token', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(requestBody)
                        });

                        if (!response.ok) {
                            const error = await response.json();
                            console.error('Token request failed:', error);
                            throw new Error(error.message || 'Failed to fetch token');
                        }

                        const result = await response.json();
                        console.log('Token response:', result);
                        
                        const tokenData = result.data || result;

                        if (!tokenData.token) {
                            throw new Error('No session token received');
                        }

                        // Extract the token value (handle both string and object formats)
                        const clientSecret = typeof tokenData.token === 'string' 
                            ? tokenData.token 
                            : tokenData.token.value;

                        if (!clientSecret) {
                            throw new Error('Invalid token format received');
                        }

                        console.log('Returning client_secret:', clientSecret.substring(0, 10) + '...');
                        return clientSecret;
                    }
                },
                theme: 'dark' // Match your dark theme
            });

            // Listen for ChatKit events
            chatkit.addEventListener('chatkit.ready', () => {
                console.log('✅ ChatKit ready and initialized');
                
                // Debug: Check if iframe loaded properly
                setTimeout(() => {
                    const iframe = chatkit.shadowRoot?.querySelector('iframe');
                    console.log('ChatKit iframe:', iframe);
                    console.log('ChatKit iframe src:', iframe?.src);
                    console.log('ChatKit shadowRoot:', chatkit.shadowRoot);
                }, 1000);
            });

            chatkit.addEventListener('chatkit.error', (event) => {
                console.error('❌ ChatKit error:', event.detail.error);
                // Show error in UI
                container.innerHTML = `
                    <div class="chatkit-error p-4">
                        <div class="alert alert-danger" role="alert">
                            <h5>ChatKit Error</h5>
                            <p>${event.detail.error?.message || 'Unknown error occurred'}</p>
                            <pre style="font-size: 0.8em; background: rgba(0,0,0,0.3); padding: 8px; border-radius: 4px; overflow: auto;">${event.detail.error?.stack || ''}</pre>
                        </div>
                    </div>
                `;
            });

            // Add global error listener for uncaught errors
            window.addEventListener('error', (event) => {
                if (event.message.includes('randomUUID')) {
                    console.error('🔴 Global error caught (crypto.randomUUID issue):', event);
                    event.preventDefault();
                }
            });

            // Replace container content with ChatKit element
            container.innerHTML = '';
            container.appendChild(chatkit);
            
            console.log('ChatKit element added to DOM with agent:', agentId);
        } catch (error) {
            container.classList.remove('chatkit-loading');
            container.innerHTML = '<div class="chatkit-error"><strong>Chat Unavailable</strong><p>' + error.message + '</p></div>';
            console.error('Failed to initialize ChatKit:', error);
        }
    } else {
        // Fallback: ChatKit library didn't load
        container.classList.remove('chatkit-loading');
        container.innerHTML = `
            <div class="chatkit-error p-4">
                <div class="alert alert-warning" role="alert">
                    <h5><i class="fas fa-exclamation-triangle"></i> ChatKit Not Available</h5>
                    <p class="mb-2">The ChatKit custom element did not load within 10 seconds.</p>
                    <p class="mb-0"><strong>Workflow ID:</strong> <code>${agentId}</code></p>
                    <hr>
                    <small class="text-muted">
                        Possible causes:<br>
                        • CDN connectivity issues<br>
                        • Browser compatibility (needs Custom Elements support)<br>
                        • Script loading timeout
                    </small>
                </div>
            </div>
        `;
        console.warn('ChatKit custom element not available');
        console.warn('Workflow ID:', agentId);
    }
}
