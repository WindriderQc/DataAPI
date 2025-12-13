# Documentation Index

Quick navigation for DataAPI documentation.

## 🚀 Deployment (Start Here)

- **[QUICK_START.md](QUICK_START.md)** - Fast deployment guide with common issues
- **[DEPLOY_PREREQUISITES.md](DEPLOY_PREREQUISITES.md)** - TrueNAS/VM setup requirements  
- **[DEPLOY_CONFIG_GUIDE.md](DEPLOY_CONFIG_GUIDE.md)** - Configuration with environment variables
- **[DEPLOY_MINT.md](DEPLOY_MINT.md)** - Original Linux Mint deployment guide
- **[DEPLOYMENT_FIXES_SUMMARY.md](DEPLOYMENT_FIXES_SUMMARY.md)** - Technical details of recent fixes

**Deployment Scripts:**
- `deploy.sh` - Main deployment wrapper (loads config from `deploy.env`)
- `deploy_dataapi_mint.sh` - Core deployment script
- `scripts/preflight_check.sh` - Pre-deployment validation
- `deploy.env.example` - Configuration template

## 📡 Integration Guides

### n8n Automation
- **[N8N_QUICKSTART.md](N8N_QUICKSTART.md)** - Quick setup guide
- **[N8N_INTEGRATION.md](N8N_INTEGRATION.md)** - Complete integration documentation
- **[N8N_WEBHOOK_INTEGRATION.md](N8N_WEBHOOK_INTEGRATION.md)** - Webhook setup
- **[N8N_NODE_SETUP.md](N8N_NODE_SETUP.md)** - Custom node configuration
- **[N8N_IMPLEMENTATION_SUMMARY.md](N8N_IMPLEMENTATION_SUMMARY.md)** - Technical summary

### Real-time Features
- **[SSE_PROXY_CONFIG.md](SSE_PROXY_CONFIG.md)** - Server-Sent Events with Nginx
- **[REALTIME_VOICE_SETUP.md](REALTIME_VOICE_SETUP.md)** - OpenAI Realtime API voice chat
- **[VOICE_COMMANDS_CONFIG.md](VOICE_COMMANDS_CONFIG.md)** - Voice command configuration

## 🤖 AI Agent Instructions

- **[AGENTS.md](AGENTS.md)** - Guidelines for AI agents working on this codebase

## 📖 General

- **[README.md](README.md)** - Project overview and features

---

## Quick Links by Task

### "I want to deploy DataAPI"
1. Read [DEPLOY_PREREQUISITES.md](DEPLOY_PREREQUISITES.md)
2. Follow [QUICK_START.md](QUICK_START.md)
3. Use `deploy.sh` script

### "I need to configure n8n integration"
1. Read [N8N_QUICKSTART.md](N8N_QUICKSTART.md)
2. Follow [N8N_INTEGRATION.md](N8N_INTEGRATION.md)

### "Deployment failed, now what?"
1. Run `sudo ./scripts/preflight_check.sh`
2. Check [DEPLOYMENT_FIXES_SUMMARY.md](DEPLOYMENT_FIXES_SUMMARY.md)
3. Review [QUICK_START.md](QUICK_START.md) Common Issues section

### "I'm an AI agent working on this codebase"
1. Read [AGENTS.md](AGENTS.md) first
2. Review relevant integration docs as needed

### "I need to set up voice chat"
1. Read [REALTIME_VOICE_SETUP.md](REALTIME_VOICE_SETUP.md)
2. Configure [VOICE_COMMANDS_CONFIG.md](VOICE_COMMANDS_CONFIG.md)

### "SSE/streaming not working in production"
1. Review [SSE_PROXY_CONFIG.md](SSE_PROXY_CONFIG.md)
2. Check Nginx configuration
