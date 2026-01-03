# CI/CD Pipeline Setup Guide

**Date:** January 1, 2026  
**Status:** ✅ Production Ready

## Overview

DataAPI uses a **dual-deployment CI/CD pipeline** with GitHub Actions that automatically deploys to both cloud and local environments on every push to `main`.

### Pipeline Architecture

```
Push to main
     ↓
┌────────────────┐
│  🧪 Test Job   │  (GitHub-hosted runner)
│  21 suites     │
│  132 tests     │
└───────┬────────┘
        ↓
    ┌───┴───┐
    ↓       ↓
┌─────────────────┐     ┌──────────────────┐
│ ☁️  Cloud Deploy │     │ 🏠 Local Deploy  │
│  SpecialBlend.ca│     │  AgentX Machine  │
│  (GitHub runner)│     │ (Self-hosted)    │
└─────────────────┘     └──────────────────┘
```

## Features

✅ **Test-First Deployment** - No deployment without passing tests  
✅ **Parallel Deployment** - Cloud and local deploy simultaneously after tests  
✅ **Zero-Downtime** - Uses `pm2 reload` instead of `pm2 restart`  
✅ **Reproducible Builds** - Uses `npm ci` for consistent dependencies  
✅ **Safe Updates** - Git stash preserves local changes before reset  
✅ **Environment URLs** - Direct links in GitHub Actions UI  

## Workflow Jobs

### 1. Test Job (🧪)
- **Runner:** GitHub-hosted Ubuntu
- **Duration:** Typically under a minute (varies by runner)
- **Actions:**
  - Checkout code
  - Setup Node.js 18 with npm cache
  - Install dependencies (`npm ci`)
  - Run test suite (`npm test`)
  - Gate for deployment

**Notes (test architecture):**
- The Jest suite is split into `unit` and `integration` projects.
- Tests run against a shared `mongodb-memory-server` instance created once per Jest invocation.
- In `NODE_ENV=test`, external API proxy endpoints return `503` to avoid slow/flaky outbound network calls.

### 2. Cloud Deploy (☁️)
- **Runner:** GitHub-hosted Ubuntu
- **Target:** specialblend.ca (via SSH)
- **Duration:** ~30-60 seconds
- **Actions:**
  - SSH into cloud server
  - Backup current state (`git stash`)
  - Pull latest code (`git reset --hard origin/main`)
  - Clean install (`npm ci`)
  - Reload PM2 service (zero-downtime)

### 3. Local Deploy (🏠)
- **Runner:** Self-hosted (AgentX machine)
- **Target:** 192.168.2.33:3003
- **Duration:** ~20-30 seconds
- **Actions:**
  - Checkout code locally
  - Navigate to deployment directory
  - Backup current state (`git stash`)
  - Pull latest code (`git reset --hard origin/main`)
  - Clean install (`npm ci`)
  - Reload PM2 service (zero-downtime)

## Self-Hosted Runner Setup

### Installation Steps

1. **Create runner directory:**
   ```bash
   cd /home/yb/codes/DataAPI
   mkdir actions-runner && cd actions-runner
   ```

2. **Download runner package:**
   ```bash
   curl -o actions-runner-linux-x64-2.330.0.tar.gz -L \
     https://github.com/actions/runner/releases/download/v2.330.0/actions-runner-linux-x64-2.330.0.tar.gz
   ```

3. **Verify and extract:**
   ```bash
   echo "af5c33fa94f3cc33b8e97937939136a6b04197e6dadfcfb3b6e33ae1bf41e79a  actions-runner-linux-x64-2.330.0.tar.gz" | shasum -a 256 -c
   tar xzf ./actions-runner-linux-x64-2.330.0.tar.gz
   ```

4. **Configure runner:**
   ```bash
   ./config.sh --url https://github.com/WindriderQc/DataAPI --token [YOUR_TOKEN]
   # Follow prompts:
   # - Runner group: Default
   # - Runner name: AgentX
   # - Labels: dataapi (in addition to defaults)
   # - Work folder: _work
   ```

5. **Install as systemd service:**
   ```bash
   sudo ./svc.sh install
   sudo ./svc.sh start
   sudo ./svc.sh status
   ```

### Runner Management

**Check status:**
```bash
sudo systemctl status actions.runner.WindriderQc-DataAPI.AgentX.service
```

**View logs:**
```bash
journalctl -u actions.runner.WindriderQc-DataAPI.AgentX.service -f
```

**Control service:**
```bash
cd /home/yb/codes/DataAPI/actions-runner
sudo ./svc.sh stop|start|restart|status
```

**Remove runner:**
```bash
sudo ./svc.sh stop
sudo ./svc.sh uninstall
./config.sh remove --token [YOUR_TOKEN]
```

## GitHub Secrets Configuration

Required secrets in repository settings:

| Secret | Description | Example |
|--------|-------------|---------|
| `SERVER_HOST` | Cloud server hostname | `specialblend.ca` |
| `SERVER_USER` | SSH username | `yb` |
| `SERVER_SSH_KEY` | Private SSH key for authentication | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `AGENTX_DEPLOY_PATH` | Optional: Custom deployment path | `/home/agentx/code/DataAPI` |

**Configure at:** https://github.com/WindriderQc/DataAPI/settings/secrets/actions

## Monitoring Deployments

### GitHub Actions Dashboard
🔗 https://github.com/WindriderQc/DataAPI/actions

### Quick Status Check
```bash
cd /home/yb/codes/DataAPI
./check-workflow.sh
```

### PM2 Status
**Cloud:**
```bash
ssh yb@specialblend.ca "pm2 status data_serv"
```

**Local:**
```bash
pm2 status data_serv
```

## Troubleshooting

### Tests Failing
- Check test logs in GitHub Actions
- Run tests locally: `npm test`
- Verify database connection in test environment

### Cloud Deployment Fails
- Verify SSH secrets are correct
- Check PM2 is installed: `ssh [host] "which pm2"`
- Verify deployment path exists
- Check server logs: `ssh [host] "pm2 logs data_serv"`

### Local Deployment Fails
- Check runner status: `sudo systemctl status actions.runner.*`
- Verify runner is connected to GitHub
- Check deployment path in workflow (default: `/home/agentx/code/DataAPI`)
- View runner logs: `journalctl -u actions.runner.* -f`

### Runner Not Picking Up Jobs
- Verify runner is online in GitHub repo settings
- Check network connectivity
- Restart runner service: `sudo ./svc.sh restart`
- Check for runner updates

## Best Practices

### Before Committing
1. ✅ Run tests locally: `npm test`
2. ✅ Check linting: `npm run lint`
3. ✅ Review changes: `git diff`
4. ✅ Meaningful commit messages

### Monitoring
1. 📊 Watch GitHub Actions during deployment
2. 🔍 Check PM2 logs after deployment
3. 🌐 Verify application is accessible
4. 📝 Monitor error logs

### Maintenance
1. 🔄 Keep runner updated (check for new versions monthly)
2. 🔐 Rotate SSH keys periodically
3. 🧹 Clean up old runner logs
4. 📈 Monitor disk space in runner work directory

## Workflow File Location

`.github/workflows/deploy.yml`

## Related Documentation

- [AGENTS.md](../project/AGENTS.md) - Development guidelines for AI agents
- [DEPLOY_PREREQUISITES.md](DEPLOY_PREREQUISITES.md) - Server setup requirements
- [DEPLOY_CONFIG_GUIDE.md](DEPLOY_CONFIG_GUIDE.md) - Configuration details
- [README.md](../../README.md) - Project overview

## Changelog

### 2026-01-01 - Initial Dual Deployment Setup
- ✅ Added test job before deployment
- ✅ Split deployment into cloud + local jobs
- ✅ Implemented zero-downtime deployments
- ✅ Added self-hosted runner on AgentX
- ✅ Configured environment URLs
- ✅ Updated .gitignore for runner artifacts

---

**Maintained by:** WindriderQc  
**Last Updated:** January 1, 2026

