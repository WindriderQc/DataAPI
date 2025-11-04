# Voice Commands Configuration Guide

## Overview

The DataAPI voice agent uses OpenAI's Realtime API to enable voice-controlled interactions with your data platform. This guide explains how to configure, customize, and extend voice commands.

## Configuration Files

### Main Configuration
**Location:** `config/voice-commands.config.js`

This file contains all voice command definitions, function mappings, and agent behavior settings.

## Configuration Structure

### 1. Keywords Configuration

Keywords trigger visual indicators in the UI when detected in user speech.

```javascript
keywords: [
    {
        id: 'earthquake',                    // Unique identifier
        triggers: ['earthquake', 'quake'],   // Words that trigger this keyword
        category: 'data',                    // Category for grouping
        action: 'Description of action',     // What this could trigger
        color: 'orange',                     // UI color indicator
        icon: '🌍',                          // Icon to display
        priority: 'high'                     // Priority level
    }
]
```

**Adding a New Keyword:**
```javascript
{
    id: 'custom_alert',
    triggers: ['alert', 'notify', 'reminder'],
    category: 'notifications',
    action: 'Could trigger custom notifications or reminders',
    color: 'yellow',
    icon: '🔔',
    priority: 'medium'
}
```

### 2. Function Definitions

Functions are AI-callable tools that execute backend operations.

```javascript
functions: [
    {
        type: 'function',
        name: 'function_name',               // Unique function name
        description: 'What this does',       // Clear description for AI
        parameters: {
            type: 'object',
            properties: {
                param1: {
                    type: 'string',          // Type: string, number, boolean, array
                    description: 'What this parameter does',
                    enum: ['option1'],       // Optional: limit to specific values
                    default: 'value'         // Optional: default value
                }
            },
            required: ['param1']             // Optional: required parameters
        }
    }
]
```

**Example - Adding a Custom Function:**
```javascript
{
    type: 'function',
    name: 'send_email_alert',
    description: 'Send an email notification to specified recipients',
    parameters: {
        type: 'object',
        properties: {
            recipients: {
                type: 'array',
                description: 'Email addresses to send to',
                items: { type: 'string' }
            },
            subject: {
                type: 'string',
                description: 'Email subject line'
            },
            priority: {
                type: 'string',
                enum: ['low', 'medium', 'high'],
                default: 'medium'
            }
        },
        required: ['recipients', 'subject']
    }
}
```

### 3. Function Routes

Maps function names to actual API endpoints.

```javascript
functionRoutes: {
    function_name: {
        method: 'GET',                      // HTTP method
        endpoint: '/api/v1/endpoint',       // API endpoint
        mapParams: (args) => ({             // Transform function args to API params
            apiParam: args.functionParam
        })
    }
}
```

**Example Route Mapping:**
```javascript
send_email_alert: {
    method: 'POST',
    endpoint: '/api/v1/notifications/email',
    mapParams: (args) => ({
        to: args.recipients,
        subject: args.subject,
        priority: args.priority || 'medium',
        from: 'voice-agent@dataapi.com'
    })
}
```

### 4. Agent Behavior Configuration

```javascript
agentConfig: {
    instructions: 'System prompt for the AI',
    model: 'gpt-4o-realtime-preview-2024-10-01',
    voice: 'alloy',              // alloy, echo, fable, onyx, nova, shimmer
    temperature: 0.8,            // 0.0-1.0 (higher = more creative)
    maxResponseTokens: 4096,
    enableFunctionCalling: true,
    enableTranscription: true
}
```

## Environment Variables

Set these in your `.env` file:

```bash
# OpenAI Configuration
OPENAI_API_KEY=sk-proj-...
CHATKIT_AGENT_ID=wf_...

# Realtime Voice Settings (Optional - overrides config file)
OPENAI_REALTIME_MODEL=gpt-4o-realtime-preview-2024-10-01
OPENAI_REALTIME_VOICE=alloy
OPENAI_REALTIME_TEMPERATURE=0.8
OPENAI_REALTIME_INSTRUCTIONS="Custom instructions here"
OPENAI_REALTIME_MODALITIES=text,audio
```

## Voice Options

Available voices:
- **alloy**: Neutral and balanced
- **echo**: Clear and articulate  
- **fable**: Warm and expressive
- **onyx**: Deep and authoritative
- **nova**: Energetic and friendly
- **shimmer**: Soft and calm

## Usage Examples

### Example 1: Add a Device Status Function

**1. Add to functions array:**
```javascript
{
    type: 'function',
    name: 'get_device_status',
    description: 'Check the online/offline status of IoT devices',
    parameters: {
        type: 'object',
        properties: {
            deviceId: {
                type: 'string',
                description: 'Device ID to check (optional, omit for all devices)'
            },
            includeMetrics: {
                type: 'boolean',
                description: 'Include performance metrics',
                default: false
            }
        }
    }
}
```

**2. Add route mapping:**
```javascript
get_device_status: {
    method: 'GET',
    endpoint: '/api/v1/devices/status',
    mapParams: (args) => ({
        deviceId: args.deviceId,
        metrics: args.includeMetrics
    })
}
```

**3. Update frontend (public/js/admin-voice.js):**
```javascript
case 'get_device_status':
    result = await this.callApiFunction('/api/v1/devices/status', args);
    break;
```

**4. Test with voice:**
> "What's the status of my devices?"
> "Check device status including metrics"

### Example 2: Add Keyword Detection

**Add to keywords array:**
```javascript
{
    id: 'performance',
    triggers: ['performance', 'speed', 'latency', 'response time'],
    category: 'monitoring',
    action: 'Could show performance metrics, charts, bottlenecks',
    color: 'purple',
    icon: '📊',
    priority: 'medium'
}
```

**Update frontend keyword detection (admin-voice.js):**
```javascript
if (lower.includes('performance') || lower.includes('latency')) {
    keywords.push('performance');
    this.addActionItem('keyword', 'Performance Keyword Detected', 
        `User asked about performance. Could show metrics, charts, etc.`);
}
```

## Testing Commands

### Test Keyword Detection
1. Start a voice session
2. Say trigger words: "earthquake", "weather", "database"
3. Check the Actions panel for keyword detection indicators

### Test Function Calling
1. Start a voice session
2. Say natural requests:
   - "Show me recent earthquakes"
   - "Where is the ISS right now?"
   - "What's the system status?"
3. Watch the Actions panel for function calls and results

## Debugging

### Enable Detailed Logging

In browser console:
```javascript
// See all realtime events
localStorage.setItem('voice-debug', 'true');
```

### Check Function Execution

Look for these in the Actions panel:
- 🔵 Function Call: Shows arguments being sent
- 🟢 Success: Shows API response
- 🔴 Error: Shows error details

### Common Issues

**Function not being called:**
- Check function description is clear
- Verify parameters are well-documented
- Ensure instructions mention the function capability

**API returns error:**
- Verify endpoint exists and is accessible
- Check mapParams correctly transforms arguments
- Ensure API expects the parameter format

**Keyword not detected:**
- Check trigger words are in lowercase
- Verify triggers array includes variations
- Test with exact trigger phrases first

## Advanced Configuration

### Custom Instructions per Function

Modify `agentConfig.instructions` to guide the AI:

```javascript
instructions: `You are a helpful assistant.

For earthquake queries:
- Always include magnitude and location
- Mention if any are above 6.0 magnitude
- Offer to show on a map

For ISS tracking:
- Include current position and altitude
- Mention if it's visible from user's location
- Offer orbit predictions`
```

### Dynamic Parameter Transformation

Handle complex parameter mapping:

```javascript
complex_query: {
    method: 'POST',
    endpoint: '/api/v1/custom/query',
    mapParams: (args) => {
        const params = { ...args };
        
        // Transform date strings to timestamps
        if (args.startDate) {
            params.startTime = new Date(args.startDate).getTime();
        }
        
        // Add authentication if needed
        params.apiKey = process.env.API_KEY;
        
        // Convert boolean to string
        params.active = args.active ? 'true' : 'false';
        
        return params;
    }
}
```

### Conditional Function Availability

Enable/disable functions based on environment:

```javascript
const functions = baseConfig.functions.filter(fn => {
    // Only include admin functions in production
    if (fn.name.startsWith('admin_') && process.env.NODE_ENV !== 'production') {
        return false;
    }
    return true;
});
```

## Best Practices

1. **Clear Descriptions**: Write function descriptions as if explaining to a human
2. **Specific Parameters**: Use enums when possible to limit options
3. **Default Values**: Provide sensible defaults for optional parameters
4. **Error Handling**: Ensure endpoints return consistent error formats
5. **Testing**: Test with various phrasings of the same request
6. **Documentation**: Keep this guide updated when adding functions
7. **Security**: Never expose sensitive functions without authentication
8. **Rate Limiting**: Consider rate limits for expensive operations

## Security Considerations

- **Authentication**: Verify user permissions before executing functions
- **Input Validation**: Validate all parameters on the backend
- **Rate Limiting**: Implement rate limits on function calls
- **Logging**: Log all function calls for audit trails
- **Sensitive Data**: Never include API keys or secrets in responses

## Related Files

- **Frontend**: `public/js/admin-voice.js` - Voice UI and event handling
- **Backend**: `controllers/chatkitController.js` - Session management
- **Config**: `config/voice-commands.config.js` - This configuration
- **Docs**: `REALTIME_VOICE_SETUP.md` - Setup and troubleshooting

## Support

For issues or questions:
1. Check browser console for detailed error logs
2. Review the Actions panel for function call details
3. Verify configuration syntax in voice-commands.config.js
4. Test functions directly via API before voice integration
