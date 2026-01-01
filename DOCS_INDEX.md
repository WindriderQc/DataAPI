# Documentation Index

Quick navigation for DataAPI documentation.

**Last Updated:** January 1, 2026

## 🚀 Deployment (Start Here)

- **[QUICK_START.md](QUICK_START.md)** - Fast deployment guide with common issues
- **[DEPLOY_PREREQUISITES.md](DEPLOY_PREREQUISITES.md)** - TrueNAS/VM setup requirements  
- **[DEPLOY_CONFIG_GUIDE.md](DEPLOY_CONFIG_GUIDE.md)** - Configuration with environment variables
- **[DEPLOY_MINT.md](DEPLOY_MINT.md)** - ⚠️ Legacy deployment guide (dedicated user mode)

**Deployment Scripts:**
- `deploy.sh` - Main deployment wrapper (loads config from `deploy.env`)
- `deploy_dataapi_mint.sh` - Core deployment script
- `scripts/preflight_check.sh` - Pre-deployment validation
- `deploy.env.example` - Configuration template

## 📡 Integration Guides

### n8n Automation

> **⚠️ IMPORTANT:** n8n trigger routes have been **migrated to AgentX** at `/api/n8n/*`.
> DataAPI only provides the event sink endpoint for receiving events FROM n8n.

- **[docs/N8N_WORKFLOWS_REQUIREMENTS.md](docs/N8N_WORKFLOWS_REQUIREMENTS.md)** - Current n8n requirements
- DataAPI endpoint: `POST /integrations/events/n8n` - Event sink (receives FROM n8n)
- For n8n triggers, see **AgentX** `/api/n8n/*` routes

**Archived (legacy):** See [docs/archive/n8n-legacy/](docs/archive/n8n-legacy/) for old docs

### Real-time Features
- **[SSE_PROXY_CONFIG.md](SSE_PROXY_CONFIG.md)** - Server-Sent Events with Nginx
- **[REALTIME_VOICE_SETUP.md](REALTIME_VOICE_SETUP.md)** - OpenAI Realtime API voice chat
- **[VOICE_COMMANDS_CONFIG.md](VOICE_COMMANDS_CONFIG.md)** - Voice command configuration

## 🤖 AI Agent Instructions

- **[AGENTS.md](AGENTS.md)** - Guidelines for AI agents working on this codebase

## 🔐 Security & Access Control

- **[RBAC_MATRIX.md](RBAC_MATRIX.md)** - Role-based access control documentation
  - Role definitions (admin, editor, user, guest)
  - Permission matrix
  - Protected endpoints reference
  - Usage examples

## �️ Feature Documentation

- **[docs/STORAGE_AND_FILE_BROWSER.md](docs/STORAGE_AND_FILE_BROWSER.md)** - Storage Tool & File Browser API
  - File Browser UI guide
  - Storage API reference (Browse, Stats, Tree)
  - Deduplication & Janitor workflows

## 📖 General

- **[README.md](README.md)** - Project overview and features
- **[CI_CD_SETUP.md](CI_CD_SETUP.md)** - GitHub Actions CI/CD pipeline documentation

## 🔍 Reviews & Technical Debt

- **[docs/PEER_REVIEW_2025-12-31.md](docs/PEER_REVIEW_2025-12-31.md)** - Comprehensive code review and recommendations

## 🗃️ Archives

- **[docs/archive/](docs/archive/)** - Historical documentation
  - `n8n-legacy/` - Old n8n integration docs (migrated to AgentX)
  - `deployment/` - Resolved deployment fix summaries
  - `reviews/` - Previous code review documents

---

## Quick Links by Task

### "I want to deploy DataAPI"
1. Read [DEPLOY_PREREQUISITES.md](DEPLOY_PREREQUISITES.md)
2. Follow [QUICK_START.md](QUICK_START.md)
3. Use `deploy.sh` script

### "I need to configure n8n integration"
1. DataAPI only receives events at `POST /integrations/events/n8n`
2. For n8n triggers, configure AgentX `/api/n8n/*` routes
3. See [docs/N8N_WORKFLOWS_REQUIREMENTS.md](docs/N8N_WORKFLOWS_REQUIREMENTS.md)

### "Deployment failed, now what?"
1. Run `sudo ./scripts/preflight_check.sh`
2. Review [QUICK_START.md](QUICK_START.md) Common Issues section
3. Check archived fixes at [docs/archive/deployment/](docs/archive/deployment/)

### "I'm an AI agent working on this codebase"
1. Read [AGENTS.md](AGENTS.md) first
2. Review relevant integration docs as needed

### "I need to set up voice chat"
1. Read [REALTIME_VOICE_SETUP.md](REALTIME_VOICE_SETUP.md)
2. Configure [VOICE_COMMANDS_CONFIG.md](VOICE_COMMANDS_CONFIG.md)

### "SSE/streaming not working in production"
1. Review [SSE_PROXY_CONFIG.md](SSE_PROXY_CONFIG.md)
2. Check Nginx configuration
