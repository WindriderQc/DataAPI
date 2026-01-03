# SSE (Server-Sent Events) Reverse Proxy Configuration

This document explains how to configure your reverse proxy to properly handle Server-Sent Events (SSE) for the feed endpoints.

## Problem
The error `net::ERR_INCOMPLETE_CHUNKED_ENCODING` occurs because reverse proxies (Nginx, Apache, Cloudflare, etc.) buffer responses by default, which breaks SSE's persistent connection.

## Solution Overview
SSE requires:
1. **No response buffering** - The proxy must send data immediately
2. **No caching** - Each connection is unique
3. **Long timeouts** - Connections stay open indefinitely
4. **HTTP/1.1** - Required for chunked transfer encoding

---

## Nginx Configuration

If using **Nginx** as your reverse proxy on the production server:

### Option 1: Specific Location Block (Recommended)
Add this to your Nginx site configuration (e.g., `/etc/nginx/sites-available/data.specialblend.ca`):

```nginx
# SSE endpoints require special handling
location /api/v1/feed/events {
    proxy_pass http://localhost:3003;
    proxy_http_version 1.1;
    
    # SSE-specific headers
    proxy_set_header Connection '';
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Host $host;
    
    # Critical: Disable buffering for SSE
    proxy_buffering off;
    proxy_cache off;
    
    # Long timeout for persistent connections
    proxy_read_timeout 86400s;  # 24 hours
    proxy_send_timeout 86400s;
    
    # Enable chunked transfer encoding
    chunked_transfer_encoding on;
    
    # Disable Nginx buffering (application sets this too)
    proxy_set_header X-Accel-Buffering no;
}
```

### Option 2: Global Server Block
If you want to apply this to all API routes:

```nginx
server {
    listen 443 ssl http2;
    server_name data.specialblend.ca;
    
    # SSL configuration...
    
    location /api/ {
        proxy_pass http://localhost:3003;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        # SSE support
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400s;
        chunked_transfer_encoding on;
    }
}
```

### Apply Changes
```bash
# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

---

## Apache Configuration

If using **Apache** as your reverse proxy:

### Enable Required Modules
```bash
sudo a2enmod proxy
sudo a2enmod proxy_http
sudo a2enmod headers
```

### VirtualHost Configuration
Add to your Apache site config (e.g., `/etc/apache2/sites-available/data.specialblend.ca.conf`):

```apache
<VirtualHost *:443>
    ServerName data.specialblend.ca
    
    # SSL Configuration...
    
    # SSE-specific location
    <Location /api/v1/feed/events>
        ProxyPass http://localhost:3003/api/v1/feed/events
        ProxyPassReverse http://localhost:3003/api/v1/feed/events
        
        # Disable buffering for SSE
        SetEnv proxy-sendchunked 1
        SetEnv proxy-interim-response RFC
        
        # Long timeout
        ProxyTimeout 86400
        
        # Preserve host header
        ProxyPreserveHost On
    </Location>
    
    # General API proxy
    ProxyPass /api/ http://localhost:3003/api/
    ProxyPassReverse /api/ http://localhost:3003/api/
    ProxyPreserveHost On
</VirtualHost>
```

### Apply Changes
```bash
# Test configuration
sudo apache2ctl configtest

# Reload Apache
sudo systemctl reload apache2
```

---

## Cloudflare Configuration

If you're using **Cloudflare** in front of your server:

### Problem
Cloudflare's default settings buffer responses, breaking SSE.

### Solution
1. Go to Cloudflare Dashboard → Your domain → Network
2. Enable **WebSockets** (this also helps with SSE)
3. Go to **Page Rules** and create a new rule:
   - URL: `data.specialblend.ca/api/v1/feed/events*`
   - Settings:
     - Cache Level: Bypass
     - Disable Performance features
4. Alternatively, use **Transform Rules** to bypass cache for SSE endpoints

### Or Use Cloudflare Workers
Create a worker to handle SSE properly:

```javascript
addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Bypass Cloudflare for SSE endpoints
  if (url.pathname.includes('/api/v1/feed/events')) {
    event.respondWith(fetch(event.request, {
      cf: {
        cacheTtl: 0,
        cacheEverything: false
      }
    }));
  } else {
    event.respondWith(fetch(event.request));
  }
});
```

---

## Testing SSE After Configuration

### Test with cURL
```bash
# Should stream events continuously (Ctrl+C to stop)
curl -N -H "Cookie: connect.sid=YOUR_SESSION_COOKIE" \
  https://data.specialblend.ca/api/v1/feed/events/private
```

### Test in Browser Console
```javascript
const es = new EventSource('/api/v1/feed/events/private');
es.onmessage = (e) => console.log('Event:', JSON.parse(e.data));
es.onerror = (e) => console.error('SSE Error:', e);
```

### Expected Behavior
- Connection stays open indefinitely
- Heartbeat comments every 15 seconds (`: heartbeat`)
- Events appear as `data: {...}` lines
- No `ERR_INCOMPLETE_CHUNKED_ENCODING` errors

---

## Troubleshooting

### Still Getting Errors?

1. **Check proxy logs**:
   ```bash
   # Nginx
   sudo tail -f /var/log/nginx/error.log
   
   # Apache
   sudo tail -f /var/log/apache2/error.log
   ```

2. **Verify proxy is running**:
   ```bash
   sudo systemctl status nginx
   # or
   sudo systemctl status apache2
   ```

3. **Check port forwarding**:
   ```bash
   # Verify something is listening on 443
   sudo netstat -tlnp | grep :443
   
   # Verify Node.js app is running on 3003
   sudo netstat -tlnp | grep :3003
   ```

4. **Test direct connection** (bypass proxy):
   ```bash
   curl -N http://localhost:3003/api/v1/feed/events
   ```
   If this works but HTTPS doesn't, it's definitely a proxy issue.

5. **Check for multiple proxies**:
   - Is Cloudflare enabled? (orange cloud in DNS settings)
   - Is there a load balancer?
   - Check your router/firewall settings

---

## Quick Diagnosis Script

Run this on your production server:

```bash
#!/bin/bash
echo "=== SSE Diagnostic ==="
echo ""
echo "1. Checking for web servers:"
pgrep -a nginx || echo "Nginx: Not running"
pgrep -a apache || echo "Apache: Not running"
```
