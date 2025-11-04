#!/bin/bash
# SSE Diagnostic Script
# Run this on your PRODUCTION server (data.specialblend.ca)

echo "========================================="
echo "SSE Diagnostic for DataAPI"
echo "========================================="
echo ""

echo "1️⃣  Checking for reverse proxy servers:"
echo "----------------------------------------"
if command -v nginx &> /dev/null; then
    echo "✓ Nginx installed: $(nginx -v 2>&1)"
    if pgrep -x nginx > /dev/null; then
        echo "  Status: RUNNING"
    else
        echo "  Status: NOT RUNNING"
    fi
else
    echo "✗ Nginx: Not installed"
fi

if command -v apache2 &> /dev/null || command -v httpd &> /dev/null; then
    echo "✓ Apache installed"
    if pgrep -x apache2 > /dev/null || pgrep -x httpd > /dev/null; then
        echo "  Status: RUNNING"
    else
        echo "  Status: NOT RUNNING"
    fi
else
    echo "✗ Apache: Not installed"
fi
echo ""

echo "2️⃣  Checking listening ports:"
echo "----------------------------------------"
echo "Port 443 (HTTPS):"
sudo netstat -tlnp 2>/dev/null | grep :443 || sudo ss -tlnp 2>/dev/null | grep :443 || echo "  Nothing listening on 443"
echo ""
echo "Port 80 (HTTP):"
sudo netstat -tlnp 2>/dev/null | grep :80 || sudo ss -tlnp 2>/dev/null | grep :80 || echo "  Nothing listening on 80"
echo ""
echo "Port 3003 (Node.js DataAPI):"
sudo netstat -tlnp 2>/dev/null | grep :3003 || sudo ss -tlnp 2>/dev/null | grep :3003 || echo "  Nothing listening on 3003"
echo ""

echo "3️⃣  Checking PM2 processes:"
echo "----------------------------------------"
if command -v pm2 &> /dev/null; then
    pm2 list
else
    echo "PM2 not installed"
fi
echo ""

echo "4️⃣  Testing local SSE endpoint (5 second timeout):"
echo "----------------------------------------"
if timeout 5 curl -N -s http://localhost:3003/api/v1/feed/events 2>&1 | head -3; then
    echo "✓ Local SSE endpoint responding"
else
    echo "✗ Local SSE endpoint not responding"
fi
echo ""

echo "5️⃣  Checking Nginx configuration (if exists):"
echo "----------------------------------------"
if [ -f /etc/nginx/nginx.conf ]; then
    echo "Main config: /etc/nginx/nginx.conf"
    if [ -d /etc/nginx/sites-enabled ]; then
        echo "Enabled sites:"
        ls -1 /etc/nginx/sites-enabled/
    fi
    if [ -d /etc/nginx/conf.d ]; then
        echo "Config directory:"
        ls -1 /etc/nginx/conf.d/*.conf 2>/dev/null || echo "  No .conf files"
    fi
else
    echo "Nginx config not found at standard location"
fi
echo ""

echo "6️⃣  Checking Apache configuration (if exists):"
echo "----------------------------------------"
if [ -f /etc/apache2/apache2.conf ] || [ -f /etc/httpd/conf/httpd.conf ]; then
    echo "Apache config found"
    if [ -d /etc/apache2/sites-enabled ]; then
        echo "Enabled sites:"
        ls -1 /etc/apache2/sites-enabled/
    elif [ -d /etc/httpd/conf.d ]; then
        echo "Config directory:"
        ls -1 /etc/httpd/conf.d/*.conf 2>/dev/null || echo "  No .conf files"
    fi
else
    echo "Apache config not found at standard locations"
fi
echo ""

echo "7️⃣  Checking for Cloudflare:"
echo "----------------------------------------"
echo "Checking DNS for data.specialblend.ca:"
if command -v dig &> /dev/null; then
    CF_IPS=$(dig +short data.specialblend.ca | head -5)
    echo "$CF_IPS"
    # Cloudflare IP ranges start with specific patterns
    if echo "$CF_IPS" | grep -qE '^(104\.1[6-9]|104\.2[0-9]|104\.3[0-1]|172\.6[4-9]|172\.7[0-1]|173\.245|188\.114|190\.93|197\.234|198\.41)\.'; then
        echo "⚠️  DETECTED: IP resolves to Cloudflare range"
        echo "   You need to configure Cloudflare page rules for SSE"
    else
        echo "✓ IP does not appear to be Cloudflare"
    fi
else
    echo "dig command not available, skipping DNS check"
fi
echo ""

echo "8️⃣  Environment information:"
echo "----------------------------------------"
echo "Hostname: $(hostname)"
echo "OS: $(cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d'"' -f2 || uname -a)"
echo "Current user: $(whoami)"
echo ""

echo "========================================="
echo "Diagnostic Complete"
echo "========================================="
echo ""
echo "📋 Next Steps:"
echo "1. If Nginx is running, apply the Nginx config from SSE_PROXY_CONFIG.md"
echo "2. If Apache is running, apply the Apache config from SSE_PROXY_CONFIG.md"
echo "3. If Cloudflare detected, configure page rules or workers"
echo "4. Share this output if you need help configuring your proxy"
