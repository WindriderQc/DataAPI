/**
 * @module sse
 * Manages the Server-Sent Events (SSE) connection for real-time updates.
 */

/**
 * Initializes the SSE connection to the feed endpoint.
 *
 * @param {function} onNewEvent - A callback function that will be executed
 *   when a new event is received from the server. The parsed event data
 *   will be passed as the first argument.
 */
export const initFeed = (onNewEvent) => {
    const eventSource = new EventSource('/api/v1/feed/events');

    eventSource.onopen = () => {
        console.log('SSE connection to feed established.');
    };

    eventSource.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (typeof onNewEvent === 'function') {
                onNewEvent(data);
            }
        } catch (error) {
            console.error('Error parsing SSE data:', error);
        }
    };

    eventSource.onerror = (err) => {
        console.error('EventSource failed:', err);
        // The browser will automatically try to reconnect.
        // If the server was just restarting, it might succeed on the next attempt.
        // If the error is persistent (e.g., auth failure), the browser will eventually give up.
    };
};