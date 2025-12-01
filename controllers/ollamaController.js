const { fetchWithTimeoutAndRetry } = require('../utils/fetch-utils');

const getOllamaUrl = () => process.env.OLLAMA_API_URL || 'http://localhost:11434';

/**
 * List available Ollama models
 */
exports.listModels = async (req, res) => {
    try {
        const baseUrl = getOllamaUrl();
        const response = await fetchWithTimeoutAndRetry(`${baseUrl}/api/tags`, {
            method: 'GET',
            timeout: 5000,
            name: 'ollama-tags'
        });

        const data = await response.json();
        // Ollama returns { models: [ { name: 'llama3:latest', ... }, ... ] }

        res.json({
            status: 'success',
            data: data.models || []
        });
    } catch (error) {
        console.error('Ollama listModels error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch models',
            error: error.message
        });
    }
};

/**
 * Chat with Ollama
 */
exports.chat = async (req, res) => {
    try {
        const { prompt, model } = req.body;

        if (!prompt) {
            return res.status(400).json({ status: 'error', message: 'Prompt is required' });
        }

        const baseUrl = getOllamaUrl();
        const selectedModel = model || process.env.OLLAMA_DEFAULT_MODEL || 'llama3';

        // Use /api/chat for chat-based models
        const payload = {
            model: selectedModel,
            messages: [{ role: 'user', content: prompt }],
            stream: false // Disable streaming for simpler handling initially
        };

        const response = await fetchWithTimeoutAndRetry(`${baseUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            timeout: 60000, // 60s timeout for generation
            name: 'ollama-chat'
        });

        const data = await response.json();
        // Ollama /api/chat non-streaming returns:
        // { model: '...', created_at: '...', message: { role: 'assistant', content: '...' }, done: true, ... }

        if (data.message && data.message.content) {
            res.json({
                status: 'success',
                output: data.message.content, // Standardize to 'output' for frontend
                metadata: {
                    model: data.model,
                    total_duration: data.total_duration,
                    eval_count: data.eval_count
                }
            });
        } else {
            throw new Error('Unexpected response format from Ollama');
        }

    } catch (error) {
        console.error('Ollama chat error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to generate response',
            error: error.message
        });
    }
};
