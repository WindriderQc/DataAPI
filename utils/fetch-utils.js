const fetch = global.fetch || require('node-fetch');

async function fetchWithTimeoutAndRetry(url, { timeout = 8000, retries = 1, name = 'request' } = {}) {
    const backoff = (attempt) => Math.min(500 * Math.pow(2, attempt), 5000);

    for (let attempt = 0; attempt <= retries; attempt++) {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        try {
            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(id);
            if (!res.ok) {
                const text = await res.text().catch(() => '');
                const err = new Error(`${name} failed: ${res.status} ${res.statusText} ${text}`);
                err.status = res.status;
                throw err;
            }
            return res;
        } catch (err) {
            clearTimeout(id);
            const isAbort = err.name === 'AbortError' || (err.type === 'aborted');
            const isTimeout = isAbort || (err.code === 'UND_ERR_CONNECT_TIMEOUT');
            const willRetry = attempt < retries && (isTimeout || err.code === 'ECONNRESET' || err.code === 'ENOTFOUND' || err.code === 'EAI_AGAIN');
            
            const errorCode = err.code || err.name || err.status || 'unknown';
            const retryMsg = willRetry ? `(retrying in ${backoff(attempt)}ms)` : '(no more retries)';
            console.log(`[fetch-utils] ${name} attempt ${attempt + 1}/${retries + 1} failed (${errorCode}): ${err.message} ${retryMsg}`);
            
            if (!willRetry) {
                throw err;
            }
            const wait = backoff(attempt);
            await new Promise(r => setTimeout(r, wait));
        }
    }
}

module.exports = { fetchWithTimeoutAndRetry };
