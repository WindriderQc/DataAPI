# OpenAI Realtime Voice API Setup

## Overview
This document explains the OpenAI Realtime Voice API integration and how it differs from ChatKit.

## Issue Fixed
**Problem:** The initial implementation attempted to pass a `workflow` parameter to the Realtime API, which caused a "Unknown parameter: 'workflow'" error.

**Solution:** The OpenAI Realtime API has a different structure than ChatKit sessions. It does not support workflow/agent IDs directly in the session creation payload.

## API Differences

### ChatKit Sessions API
- Endpoint: `https://api.openai.com/v1/chatkit/sessions`
- Supports: `workflow.id` parameter for agent configuration
- Header: `OpenAI-Beta: chatkit_beta=v1`
- Use case: Text-based chat with predefined workflows/agents

### Realtime Sessions API
- Endpoint: `https://api.openai.com/v1/realtime/sessions`
- Supports: `model`, `voice`, `instructions`, `modalities`
- Header: `OpenAI-Beta: realtime=v1`
- Use case: Real-time voice conversations via WebRTC

## Configuration

### Required Environment Variables
```bash
OPENAI_API_KEY=sk-proj-...
CHATKIT_AGENT_ID=wf_...  # Used for text chat, not realtime voice
```

### Optional Realtime Configuration
```bash
# Model to use for realtime voice
OPENAI_REALTIME_MODEL=gpt-4o-realtime-preview-2024-10-01

# Voice selection (alloy, echo, fable, onyx, nova, shimmer)
OPENAI_REALTIME_VOICE=alloy

# Modalities (comma-separated: text, audio)
OPENAI_REALTIME_MODALITIES=text,audio

# System instructions for the voice agent
OPENAI_REALTIME_INSTRUCTIONS=You are a helpful assistant for the DataAPI platform.
```

## How Agent Behavior is Configured

Since the Realtime API doesn't support workflow IDs, you have two options:

### Option 1: Static Instructions (Recommended for now)
Set the `OPENAI_REALTIME_INSTRUCTIONS` environment variable with your agent's system prompt:

```bash
OPENAI_REALTIME_INSTRUCTIONS="You are a data analysis assistant. Help users understand their data by providing insights and visualizations."
```

### Option 2: Dynamic Instructions via Data Channel
After the WebRTC connection is established, you can send configuration events over the data channel:

```javascript
// Example: Send session.update event via data channel
const updateEvent = {
  type: 'session.update',
  session: {
    instructions: 'You are a helpful assistant...',
    temperature: 0.8,
    max_response_output_tokens: 4096
  }
};
dataChannel.send(JSON.stringify(updateEvent));
```

## Implementation Details

### Backend (`controllers/chatkitController.js`)
The `createRealtimeSession` function now:
1. Creates a session with only `model` and `voice` parameters
2. Optionally adds `instructions` if `OPENAI_REALTIME_INSTRUCTIONS` is set
3. Optionally adds `modalities` if `OPENAI_REALTIME_MODALITIES` is set
4. Returns an ephemeral token for WebRTC authentication

### Frontend (`public/js/admin-voice.js`)
The voice agent:
1. Fetches a realtime session token from `/api/v1/chatkit/realtime-session`
2. Establishes a WebRTC peer connection
3. Creates a data channel for event communication
4. Exchanges SDP with OpenAI's Realtime API endpoint
5. Handles audio streaming bidirectionally

## Testing

1. Ensure your `.env` file has the required variables set
2. Navigate to an admin page with the voice interface
3. Click "Start Voice Session"
4. Grant microphone permissions when prompted
5. Speak to test the voice interaction

## Troubleshooting

### Error: "Unknown parameter: 'workflow'"
✅ **Fixed** - This error is resolved by removing the workflow parameter from the payload.

### Error: "No client_secret in response"
- Check that `OPENAI_API_KEY` is valid and has access to the Realtime API
- Verify the model name is correct (must be a realtime-capable model)

### Error: "Failed to create realtime session"
- Check API key permissions
- Verify model availability
- Check server logs for detailed error messages

### No audio output
- Verify browser permissions for microphone
- Check browser console for WebRTC errors
- Ensure HTTPS is enabled (required for microphone access)
- In production, verify Nginx is properly configured for WebRTC

## Production Considerations

### HTTPS Required
WebRTC and microphone access require HTTPS. Ensure your Nginx configuration includes:
- SSL/TLS certificates
- Proper proxy settings for WebSocket/WebRTC traffic

### STUN/TURN Servers
The current implementation uses Google's public STUN server. For production:
- Consider using your own STUN/TURN servers
- Configure ICE server redundancy
- Monitor connection success rates

### Session Management
- Realtime sessions have ephemeral tokens that expire
- Consider implementing session refresh logic
- Handle token expiration gracefully

## Resources

- [OpenAI Realtime API Documentation](https://platform.openai.com/docs/guides/realtime)
- [WebRTC API Reference](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- [ChatKit Documentation](https://platform.openai.com/docs/guides/chatkit)
