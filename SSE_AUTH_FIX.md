# SSE Authentication Fix

## Problem
The private SSE feed at `/api/v1/feed/events/private` was returning 401 Unauthorized even when users were logged in and authenticated on the dashboard.

## Root Cause
The issue was caused by the browser's **EventSource API not sending session cookies** due to the `sameSite: 'lax'` cookie setting. 

### Why This Happened
- `sameSite: 'lax'` prevents cookies from being sent on certain cross-origin or "unsafe" requests
- EventSource connections are treated differently than regular fetch/XHR requests
- The session cookie wasn't being sent with SSE requests, so `requireAuth` middleware couldn't find the session
- This resulted in 401 responses even though the user was authenticated

## Solution Applied
Changed the session cookie `sameSite` setting to `'none'` in production:

```javascript
// data_serv.js - Session configuration
sessionOptions = {
    secret: config.session.secret,
    store: mongoStore,
    cookie: {
        secure: IN_PROD,
        httpOnly: true,
        sameSite: IN_PROD ? 'none' : 'lax',  // Changed: 'none' in production
        maxAge: config.session.maxAge,
    }
};
```

### What Changed
- **Development**: Still uses `sameSite: 'lax'` (safer default for local development)
- **Production**: Now uses `sameSite: 'none'` (allows cookies on EventSource requests)
- **Security**: `secure: true` is still enforced in production (HTTPS only)

## Security Implications
- `sameSite: 'none'` requires `secure: true` (already enforced in production)
- Cookies will now be sent on cross-origin requests, which is necessary for SSE
- `httpOnly: true` still protects against XSS attacks
- CORS is still configured with specific origins, not `*`

## Testing
After deploying this fix:
1. Log in to the dashboard
2. Check browser console - should no longer see 401 errors for `/api/v1/feed/events/private`
3. Private feed events should now stream properly
4. Other API endpoints remain publicly accessible (no authentication required unless specifically protected)

## Alternative Solutions Considered
1. **EventSource polyfill with credentials**: More complex, requires additional library
2. **Session ID in URL parameter**: Less secure, exposes session ID in URLs/logs
3. **Custom header with fetch-based SSE**: Requires rewriting SSE implementation

The `sameSite: 'none'` solution is the cleanest and most standards-compliant fix.

## Related Files Modified
- `/home/yb/Servers/DataAPI/data_serv.js` (session configuration)

## Documentation
- Session middleware is applied globally to all routes (API and web)
- `attachUser` middleware populates `res.locals.user` for all requests
- `requireAuth` middleware only protects specific endpoints (like `/api/v1/feed/events/private`)
- Most API endpoints remain publicly accessible without authentication
