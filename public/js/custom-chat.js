/**
 * Custom Chat UI for OpenAI Agents/Assistants
 * Fallback implementation when ChatKit doesn't work
 */

export async function initializeCustomChat(container, agentId) {
    container.classList.add('chatkit-loading');
    
    try {
        // Initialize chat session
        const sessionResponse = await fetch('/api/v1/chat/init', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ agentId })
        });

        if (!sessionResponse.ok) {
            throw new Error('Failed to initialize chat session');
        }

        const session = await sessionResponse.json();
        const { threadId } = session.data;

        container.classList.remove('chatkit-loading');
        
        // Build chat UI
        container.innerHTML = `
            <div class="custom-chat-container">
                <div class="chat-messages" id="chat-messages"></div>
                <div class="chat-input-area">
                    <textarea 
                        id="chat-input" 
                        placeholder="Type your message..." 
                        rows="2"
                    ></textarea>
                    <button id="chat-send-btn" class="send-btn">
                        <span>Send</span>
                    </button>
                </div>
            </div>
            <style>
                .custom-chat-container {
                    display: flex;
                    flex-direction: column;
                    height: 480px;
                    background: rgba(15, 23, 42, 0.8);
                    border-radius: 10px;
                    overflow: hidden;
                }
                .chat-messages {
                    flex: 1;
                    overflow-y: auto;
                    padding: 20px;
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }
                .chat-message {
                    max-width: 80%;
                    padding: 12px 16px;
                    border-radius: 12px;
                    word-wrap: break-word;
                    line-height: 1.5;
                }
                .chat-message.user {
                    align-self: flex-end;
                    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                    color: white;
                    border-bottom-right-radius: 4px;
                }
                .chat-message.assistant {
                    align-self: flex-start;
                    background: rgba(148, 163, 184, 0.15);
                    color: #e2e8f0;
                    border: 1px solid rgba(148, 163, 184, 0.25);
                    border-bottom-left-radius: 4px;
                }
                .chat-message.system {
                    align-self: center;
                    background: transparent;
                    color: #94a3b8;
                    font-size: 0.85rem;
                    font-style: italic;
                    max-width: 90%;
                    text-align: center;
                }
                .chat-message.loading {
                    align-self: flex-start;
                    background: rgba(148, 163, 184, 0.1);
                    color: #94a3b8;
                    border: 1px dashed rgba(148, 163, 184, 0.3);
                }
                .chat-input-area {
                    display: flex;
                    gap: 12px;
                    padding: 16px;
                    background: rgba(15, 23, 42, 0.95);
                    border-top: 1px solid rgba(148, 163, 184, 0.2);
                }
                #chat-input {
                    flex: 1;
                    padding: 12px 16px;
                    border: 1px solid rgba(148, 163, 184, 0.3);
                    border-radius: 8px;
                    background: rgba(15, 23, 42, 0.6);
                    color: #e2e8f0;
                    font-family: inherit;
                    font-size: 0.95rem;
                    resize: none;
                    outline: none;
                }
                #chat-input:focus {
                    border-color: #3b82f6;
                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
                }
                .send-btn {
                    padding: 12px 24px;
                    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: 600;
                    font-size: 0.95rem;
                    transition: all 0.2s;
                    min-width: 80px;
                }
                .send-btn:hover:not(:disabled) {
                    background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
                }
                .send-btn:disabled {
                    background: #475569;
                    cursor: not-allowed;
                    opacity: 0.6;
                }
                .chat-messages::-webkit-scrollbar {
                    width: 8px;
                }
                .chat-messages::-webkit-scrollbar-track {
                    background: rgba(15, 23, 42, 0.4);
                }
                .chat-messages::-webkit-scrollbar-thumb {
                    background: rgba(148, 163, 184, 0.3);
                    border-radius: 4px;
                }
                .chat-messages::-webkit-scrollbar-thumb:hover {
                    background: rgba(148, 163, 184, 0.5);
                }
            </style>
        `;

        const messagesContainer = document.getElementById('chat-messages');
        const input = document.getElementById('chat-input');
        const sendBtn = document.getElementById('chat-send-btn');

        function addMessage(role, content, isLoading = false) {
            const messageDiv = document.createElement('div');
            messageDiv.className = `chat-message ${role}${isLoading ? ' loading' : ''}`;
            messageDiv.textContent = content;
            messagesContainer.appendChild(messageDiv);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
            return messageDiv;
        }

        addMessage('system', `Connected to workflow agent`);

        async function sendMessage() {
            const message = input.value.trim();
            if (!message || sendBtn.disabled) return;

            addMessage('user', message);
            input.value = '';
            sendBtn.disabled = true;

            const loadingMsg = addMessage('assistant', 'Thinking...', true);

            try {
                const response = await fetch('/api/v1/chat/message', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        threadId,
                        message,
                        agentId 
                    })
                });

                if (!response.ok) {
                    throw new Error('Failed to send message');
                }

                const result = await response.json();
                loadingMsg.remove();
                
                const reply = result.data?.content || result.data?.message || 'No response received';
                addMessage('assistant', reply);
            } catch (error) {
                loadingMsg.remove();
                addMessage('system', `Error: ${error.message}`);
            } finally {
                sendBtn.disabled = false;
                input.focus();
            }
        }

        sendBtn.addEventListener('click', sendMessage);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        input.focus();
        console.log('✅ Custom chat initialized with thread:', threadId);

    } catch (error) {
        container.classList.remove('chatkit-loading');
        container.innerHTML = `
            <div class="chatkit-error p-4">
                <div class="alert alert-danger" role="alert">
                    <h5><i class="fas fa-times-circle"></i> Chat Initialization Failed</h5>
                    <p class="mb-0">${error.message}</p>
                </div>
            </div>
        `;
        console.error('Failed to initialize custom chat:', error);
    }
}
