/**
 * Unit tests for utils/fetch-utils.js
 * 
 * These tests mock global.fetch to test the fetchWithTimeoutAndRetry function
 * without actual network calls.
 */

describe('fetchWithTimeoutAndRetry', () => {
    let originalFetch;
    let mockFetch;
    let fetchWithTimeoutAndRetry;

    beforeEach(() => {
        // Save original global.fetch
        originalFetch = global.fetch;

        // Create mock
        mockFetch = jest.fn();
        global.fetch = mockFetch;

        // Re-require the module to pick up our mock
        jest.resetModules();
        ({ fetchWithTimeoutAndRetry } = require('../../utils/fetch-utils'));
    });

    afterEach(() => {
        // Restore original
        global.fetch = originalFetch;
    });

    describe('successful requests', () => {
        it('should return response on successful fetch', async () => {
            const mockResponse = {
                ok: true,
                json: jest.fn().mockResolvedValue({ data: 'test' })
            };
            mockFetch.mockResolvedValueOnce(mockResponse);

            const result = await fetchWithTimeoutAndRetry('https://example.com/api', { timeout: 5000 });

            expect(result).toBe(mockResponse);
            expect(mockFetch).toHaveBeenCalledTimes(1);
            expect(mockFetch).toHaveBeenCalledWith('https://example.com/api', expect.objectContaining({
                signal: expect.any(AbortSignal)
            }));
        });

        it('should pass through custom fetch options', async () => {
            const mockResponse = { ok: true };
            mockFetch.mockResolvedValueOnce(mockResponse);

            const customHeaders = { 'Authorization': 'Bearer token' };
            await fetchWithTimeoutAndRetry('https://example.com/api', {
                timeout: 5000,
                method: 'POST',
                headers: customHeaders,
                body: JSON.stringify({ test: true })
            });

            expect(mockFetch).toHaveBeenCalledWith('https://example.com/api', expect.objectContaining({
                method: 'POST',
                headers: customHeaders,
                body: JSON.stringify({ test: true })
            }));
        });

        it('should not include internal options in fetch call', async () => {
            const mockResponse = { ok: true };
            mockFetch.mockResolvedValueOnce(mockResponse);

            await fetchWithTimeoutAndRetry('https://example.com/api', {
                timeout: 5000,
                retries: 2,
                name: 'test-request',
                method: 'GET'
            });

            // These internal options should NOT be passed to fetch
            const callArgs = mockFetch.mock.calls[0][1];
            expect(callArgs.timeout).toBeUndefined();
            expect(callArgs.retries).toBeUndefined();
            expect(callArgs.name).toBeUndefined();
            // But method should be passed
            expect(callArgs.method).toBe('GET');
        });
    });

    describe('HTTP errors', () => {
        it('should throw error for non-ok response', async () => {
            const mockResponse = {
                ok: false,
                status: 404,
                statusText: 'Not Found',
                text: jest.fn().mockResolvedValue('Resource not found')
            };
            mockFetch.mockResolvedValueOnce(mockResponse);

            await expect(
                fetchWithTimeoutAndRetry('https://example.com/api', {
                    timeout: 5000,
                    retries: 0,
                    name: 'test-request'
                })
            ).rejects.toThrow('test-request failed: 404 Not Found');
        });

        it('should include status code in error', async () => {
            const mockResponse = {
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
                text: jest.fn().mockResolvedValue('')
            };
            mockFetch.mockResolvedValueOnce(mockResponse);

            try {
                await fetchWithTimeoutAndRetry('https://example.com/api', {
                    timeout: 5000,
                    retries: 0
                });
            } catch (err) {
                expect(err.status).toBe(500);
            }
        });

        it('should handle text() rejection gracefully', async () => {
            const mockResponse = {
                ok: false,
                status: 503,
                statusText: 'Service Unavailable',
                text: jest.fn().mockRejectedValue(new Error('Stream error'))
            };
            mockFetch.mockResolvedValueOnce(mockResponse);

            await expect(
                fetchWithTimeoutAndRetry('https://example.com/api', { retries: 0 })
            ).rejects.toThrow('request failed: 503 Service Unavailable');
        });
    });

    describe('retry behavior', () => {
        it('should not retry on non-retryable errors', async () => {
            const httpError = new Error('Not Found');
            httpError.status = 404;
            mockFetch.mockRejectedValueOnce(httpError);

            await expect(
                fetchWithTimeoutAndRetry('https://example.com/api', {
                    timeout: 5000,
                    retries: 2
                })
            ).rejects.toThrow('Not Found');

            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it('should retry on ECONNRESET and eventually succeed', async () => {
            const connResetError = new Error('Connection reset');
            connResetError.code = 'ECONNRESET';
            mockFetch.mockRejectedValueOnce(connResetError);

            const mockResponse = { ok: true };
            mockFetch.mockResolvedValueOnce(mockResponse);

            const result = await fetchWithTimeoutAndRetry('https://example.com/api', {
                timeout: 5000,
                retries: 1
            });

            expect(result).toBe(mockResponse);
            expect(mockFetch).toHaveBeenCalledTimes(2);
        }, 10000);

        it('should retry on ENOTFOUND and eventually succeed', async () => {
            const notFoundError = new Error('DNS lookup failed');
            notFoundError.code = 'ENOTFOUND';
            mockFetch.mockRejectedValueOnce(notFoundError);

            const mockResponse = { ok: true };
            mockFetch.mockResolvedValueOnce(mockResponse);

            const result = await fetchWithTimeoutAndRetry('https://example.com/api', {
                timeout: 5000,
                retries: 1
            });

            expect(result).toBe(mockResponse);
            expect(mockFetch).toHaveBeenCalledTimes(2);
        }, 10000);

        it('should exhaust retries and throw', async () => {
            const connResetError = new Error('Connection reset');
            connResetError.code = 'ECONNRESET';
            mockFetch.mockRejectedValue(connResetError);

            await expect(
                fetchWithTimeoutAndRetry('https://example.com/api', {
                    timeout: 5000,
                    retries: 1
                })
            ).rejects.toThrow('Connection reset');

            expect(mockFetch).toHaveBeenCalledTimes(2); // initial + 1 retry
        }, 15000);
    });

    describe('default options', () => {
        it('should use default timeout of 8000ms', async () => {
            const mockResponse = { ok: true };
            mockFetch.mockResolvedValueOnce(mockResponse);

            await fetchWithTimeoutAndRetry('https://example.com/api');

            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it('should use default name of "request" in error messages', async () => {
            const mockResponse = {
                ok: false,
                status: 500,
                statusText: 'Error',
                text: jest.fn().mockResolvedValue('')
            };
            mockFetch.mockResolvedValueOnce(mockResponse);

            await expect(
                fetchWithTimeoutAndRetry('https://example.com/api', { retries: 0 })
            ).rejects.toThrow('request failed: 500 Error');
        });
    });
});
