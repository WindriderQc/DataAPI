/**
 * Voice Command Configuration
 * 
 * This file defines all voice commands, keywords, and API integrations
 * for the OpenAI Realtime Voice Agent.
 * 
 * Structure:
 * - keywords: Simple keyword detection triggers
 * - functions: OpenAI function definitions that the agent can call
 * - functionRoutes: Maps function names to backend API endpoints
 */

module.exports = {
    /**
     * Keyword Detection Configuration
     * Triggers visual indicators and potential actions when keywords are detected
     */
    keywords: [
        {
            id: 'earthquake',
            triggers: ['earthquake', 'quake', 'seismic', 'tremor'],
            category: 'data',
            action: 'Could fetch recent earthquake data, show map, display statistics',
            color: 'orange',
            icon: '🌍',
            priority: 'high'
        },
        {
            id: 'iss',
            triggers: ['iss', 'space station', 'international space station', 'satellite'],
            category: 'tracking',
            action: 'Could fetch ISS position, show trajectory, display orbital data',
            color: 'blue',
            icon: '🛰️',
            priority: 'medium'
        },
        {
            id: 'weather',
            triggers: ['weather', 'temperature', 'forecast', 'climate'],
            category: 'data',
            action: 'Could fetch weather conditions, show forecast, display temperature',
            color: 'cyan',
            icon: '🌤️',
            priority: 'medium'
        },
        {
            id: 'database',
            triggers: ['database', 'query', 'data', 'collection', 'mongodb'],
            category: 'system',
            action: 'Could show collections, run queries, display statistics',
            color: 'green',
            icon: '💾',
            priority: 'high'
        },
        {
            id: 'user',
            triggers: ['user', 'account', 'profile', 'login'],
            category: 'system',
            action: 'Could manage users, show profiles, update accounts',
            color: 'purple',
            icon: '👤',
            priority: 'low'
        },
        {
            id: 'alarm',
            triggers: ['alarm', 'alert', 'notification', 'warning'],
            category: 'monitoring',
            action: 'Could fetch active alarms, show alerts, manage notifications',
            color: 'red',
            icon: '🚨',
            priority: 'high'
        }
    ],

    /**
     * OpenAI Function Definitions
     * These are the tools the AI agent can call via function calling
     */
    functions: [
        {
            type: 'function',
            name: 'get_earthquake_data',
            description: 'Retrieve recent earthquake information from the database. Returns earthquakes sorted by date with magnitude, location, and depth.',
            parameters: {
                type: 'object',
                properties: {
                    limit: {
                        type: 'number',
                        description: 'Maximum number of earthquakes to retrieve (default: 10, max: 100)',
                        default: 10
                    },
                    minMagnitude: {
                        type: 'number',
                        description: 'Minimum magnitude filter (e.g., 4.5 for moderate quakes)',
                        default: 0
                    },
                    sort: {
                        type: 'string',
                        enum: ['date', 'magnitude'],
                        description: 'Sort results by date or magnitude',
                        default: 'date'
                    }
                }
            }
        },
        {
            type: 'function',
            name: 'get_iss_position',
            description: 'Get the current position of the International Space Station including latitude, longitude, altitude, velocity, and visibility information.',
            parameters: {
                type: 'object',
                properties: {
                    includeTrajectory: {
                        type: 'boolean',
                        description: 'Include predicted trajectory for next orbit',
                        default: false
                    }
                }
            }
        },
        {
            type: 'function',
            name: 'get_weather_data',
            description: 'Retrieve current weather conditions and forecast for a specific location.',
            parameters: {
                type: 'object',
                properties: {
                    location: {
                        type: 'string',
                        description: 'Location name or coordinates (e.g., "Montreal" or "45.5,-73.6")'
                    },
                    units: {
                        type: 'string',
                        enum: ['metric', 'imperial'],
                        description: 'Temperature units (metric=Celsius, imperial=Fahrenheit)',
                        default: 'metric'
                    }
                },
                required: ['location']
            }
        },
        {
            type: 'function',
            name: 'query_database',
            description: 'Execute a natural language query against the MongoDB database. Can search collections, filter data, and return results.',
            parameters: {
                type: 'object',
                properties: {
                    collection: {
                        type: 'string',
                        description: 'Database collection to query (e.g., "users", "quakes", "devices")',
                        enum: ['users', 'quakes', 'devices', 'alarms', 'heartbeats', 'profiles']
                    },
                    query: {
                        type: 'string',
                        description: 'Natural language description of what to find (e.g., "find all active users", "count earthquakes above magnitude 5")'
                    },
                    limit: {
                        type: 'number',
                        description: 'Maximum number of results to return',
                        default: 10
                    }
                },
                required: ['collection', 'query']
            }
        },
        {
            type: 'function',
            name: 'get_user_stats',
            description: 'Get statistics about users in the system including total count, active users, recent registrations.',
            parameters: {
                type: 'object',
                properties: {
                    timeRange: {
                        type: 'string',
                        enum: ['day', 'week', 'month', 'year', 'all'],
                        description: 'Time range for statistics',
                        default: 'all'
                    }
                }
            }
        },
        {
            type: 'function',
            name: 'get_active_alarms',
            description: 'Retrieve currently active alarms and alerts from the monitoring system.',
            parameters: {
                type: 'object',
                properties: {
                    severity: {
                        type: 'string',
                        enum: ['critical', 'high', 'medium', 'low', 'all'],
                        description: 'Filter by alarm severity level',
                        default: 'all'
                    },
                    acknowledged: {
                        type: 'boolean',
                        description: 'Include only acknowledged or unacknowledged alarms',
                        default: false
                    }
                }
            }
        },
        {
            type: 'function',
            name: 'get_system_status',
            description: 'Get overall system health status including database connections, API availability, and resource usage.',
            parameters: {
                type: 'object',
                properties: {}
            }
        }
    ],

    /**
     * Function Route Mapping
     * Maps function names to backend API endpoints and HTTP methods
     */
    functionRoutes: {
        get_earthquake_data: {
            method: 'GET',
            endpoint: '/api/v1/quakes',
            mapParams: (args) => ({
                limit: args.limit || 10,
                sort: args.sort || 'date',
                minMagnitude: args.minMagnitude
            })
        },
        get_iss_position: {
            method: 'GET',
            endpoint: '/api/v1/iss',
            mapParams: (args) => ({
                trajectory: args.includeTrajectory
            })
        },
        get_weather_data: {
            method: 'GET',
            endpoint: '/api/v1/weather',
            mapParams: (args) => ({
                location: args.location,
                units: args.units || 'metric'
            })
        },
        query_database: {
            method: 'POST',
            endpoint: '/api/v1/databases/query',
            mapParams: (args) => args
        },
        get_user_stats: {
            method: 'GET',
            endpoint: '/api/v1/users/stats',
            mapParams: (args) => ({
                timeRange: args.timeRange || 'all'
            })
        },
        get_active_alarms: {
            method: 'GET',
            endpoint: '/api/v1/alarms',
            mapParams: (args) => ({
                severity: args.severity,
                acknowledged: args.acknowledged
            })
        },
        get_system_status: {
            method: 'GET',
            endpoint: '/api/v1/system/status',
            mapParams: () => ({})
        }
    },

    /**
     * Agent Behavior Configuration
     */
    agentConfig: {
        // Default instructions for the voice agent
        instructions: `You are a helpful data analysis assistant for the DataAPI platform.

You have access to real-time data about:
- Earthquake activity worldwide
- International Space Station tracking
- Weather conditions
- Database queries
- User statistics
- System monitoring and alarms

When users ask questions:
1. Use the available functions to retrieve accurate data
2. Explain the data clearly and concisely
3. Highlight important or unusual findings
4. Offer to provide more details if needed

Be friendly, professional, and focused on helping users understand their data.`,

        // Voice and model settings
        model: 'gpt-4o-realtime-preview-2024-10-01',
        voice: 'alloy', // Options: alloy, echo, fable, onyx, nova, shimmer
        temperature: 0.8,
        maxResponseTokens: 4096,

        // Enable/disable features
        enableFunctionCalling: true,
        enableTranscription: true,
        transcriptionModel: 'whisper-1'
    }
};
