# Quick Start Guide - Fixed Deployment

## TL;DR - What Changed?

The deployment script now has:
- ✅ Comprehensive preflight checks (CPU, network, MongoDB)
- ✅ Fixed Mosquitto password file ownership
- ✅ SMB mount support with proper error handling
- ✅ Fixed PM2 startup command execution
- ✅ Better error messages and early failure detection

## Quick Deployment Steps

Note: DataAPI is a headless tool server. In the current architecture, AgentX is the only UI, and (in the recommended setup) both services are managed from a single PM2 process list using AgentX’s `ecosystem.config.js`.

### 1. Prerequisites (One-Time Setup)

Complete these steps in TrueNAS SCALE **before** running deployment:

#### A. Create Network Bridge
```
TrueNAS UI → Network → Interfaces → Add
- Type: Bridge
- Name: br1
- Members: enp5s0 (your physical NIC)
- IP: 192.168.2.31/24
```

#### B. Configure VM CPU
```
TrueNAS UI → Virtualization → VMs → AgentX → Edit
- CPU Mode: Host Passthrough
- Then: STOP and START the VM (not reboot!)
```

#### C. Attach VM to Bridge
```
TrueNAS UI → Virtualization → VMs → AgentX → Devices → Network
- Attach NIC: br1
```

#### D. Install MongoDB in VM
```bash
# SSH into VM
curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc | \
  sudo gpg --dearmor -o /usr/share/keyrings/mongodb-server-8.0.gpg

echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] \
  https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/8.0 multiverse" | \
  sudo tee /etc/apt/sources.list.d/mongodb-org-8.0.list

sudo apt update
sudo apt install -y mongodb-org
sudo systemctl enable --now mongod
```

### 2. Run Preflight Check

```bash
cd /path/to/DataAPI
sudo ./scripts/preflight_check.sh
```

**Expected output**:
```
=== DataAPI Deployment Preflight Check ===

Running as root: ✓ PASS
CPU AVX support: ✓ PASS
TrueNAS host reachable: ✓ PASS
Default gateway configured: ✓ PASS
DNS resolution: ✓ PASS
MongoDB service running: ✓ PASS
MongoDB listening on port: ✓ PASS
Required commands available: ✓ PASS
...

✓ All critical checks passed!
```

### 3. Configure Deployment

**Option A: Using Environment File (Recommended)**

```bash
# Copy example configuration
cp deploy.env.example deploy.env

# Edit with your credentials
nano deploy.env

# Update these values:
# TRUENAS_HOST_IP="192.168.2.31"
# SMB_USER="your_username"
# SMB_PASS="your_password"
# MQTT_PASSWORD="your_secure_password"

# Secure the file
chmod 600 deploy.env
```

**Option B: Edit Script Directly (Not Recommended)**

If you don't want to use environment variables, you can edit the script, but this makes it unsafe to commit to git.

See [DEPLOY_CONFIG_GUIDE.md](DEPLOY_CONFIG_GUIDE.md) for more configuration options.

### 4. Run Deployment

**Option A: Using Wrapper Script (Easiest)**

```bash
sudo ./deploy.sh
```

The wrapper script automatically loads `deploy.env` and validates configuration.

**Option B: Manual Environment Loading**

```bash
# Load configuration and run deployment
set -a; source deploy.env; set +a
sudo -E ./deploy_dataapi_mint.sh
```

**One-liner:**
```bash
set -a; source deploy.env; set +a; sudo -E ./deploy_dataapi_mint.sh
```

**What it does**:
1. ✅ Validates all preflight checks again
2. ✅ Installs Node.js (if needed)
3. ✅ Installs PM2 globally
4. ✅ Installs and configures Mosquitto with secure passwords
5. ✅ Sets up SMB mounts (if enabled)
6. ✅ Clones/updates repository
7. ✅ Installs Node dependencies
8. ✅ Creates .env file
9. ✅ Starts application with PM2
10. ✅ Configures PM2 startup service
11. ✅ Optionally installs Nginx reverse proxy

### 5. Verify Deployment

```bash
# Check services
sudo systemctl status mongod mosquitto

# Check PM2
# If you are running DataAPI under the same user as AgentX (one process list):
pm2 status
pm2 logs dataapi --lines 50

# If you are standardizing on the PM2 ecosystem workflow, apply changes from AgentX:
# cd /home/yb/codes/AgentX
# pm2 reload ecosystem.config.js --update-env
# pm2 save

# If you are running DataAPI under a dedicated user (separate PM2 home):
# sudo -u dataapi pm2 status
# sudo -u dataapi pm2 logs DataAPI --lines 50

# Test application (headless tool server)
curl http://192.168.2.33:3003/health

# Tool endpoints should require x-api-key
curl -o /dev/null -w "HTTP %{http_code}\n" http://192.168.2.33:3003/api/v1/
```

## Common Issues & Quick Fixes

### Issue: Preflight fails on "CPU AVX support"

**Fix**:
1. TrueNAS UI → VMs → AgentX → Edit
2. CPU Mode → Host Passthrough
3. **STOP** the VM (not reboot)
4. **START** the VM
5. Re-run preflight check

### Issue: Preflight fails on "TrueNAS host reachable"

**Fix**:
1. Verify bridge exists: TrueNAS UI → Network → Interfaces
2. Verify VM attached to bridge: TrueNAS UI → VMs → AgentX → Devices
3. Restart VM
4. From VM: `ping 192.168.2.31`

### Issue: "MongoDB is NOT reachable"

**Fix**:
```bash
sudo systemctl status mongod
sudo systemctl start mongod

# If still failing, check AVX:
lscpu | grep avx
# If no output → Fix VM CPU mode (see above)
```

### Issue: Mosquitto fails to start

**Fix**:
```bash
# Check recent logs
sudo journalctl -u mosquitto -n 100

# Common issue: password file permissions
sudo chown mosquitto:mosquitto /etc/mosquitto/passwordfile
sudo chmod 640 /etc/mosquitto/passwordfile
sudo systemctl restart mosquitto
```

### Issue: SMB mount fails

**Fix**:
```bash
# Test manually
sudo mount -t cifs //192.168.2.31/Datalake /mnt/datalake \
  -o username=dataapi,password=yourpass,vers=3.1.1

# If fails: set ENABLE_SMB_MOUNTS="no" in deploy script
```

### Issue: PM2 startup fails

**Fix**:
```bash
# Re-run manually
sudo -u dataapi pm2 startup systemd
# Copy the output command and run it with sudo
sudo -u dataapi pm2 save
```

## Configuration Reference

### Required Environment Variables (automatically set in .env):

```bash
NODE_ENV=production
PORT=3003
MONGO_URL=mongodb://127.0.0.1:27017
MONGO_DB_NAME=IoT
MQTT_BROKER_URL=mqtt://localhost:1883
MQTT_USERNAME=dataapi
MQTT_PASSWORD=<from config>
MQTT_ISS_TOPIC=liveData/iss
```

### Additional Variables (add to .env manually if needed):

```bash
# n8n Integration
N8N_API_KEY=<generate with: openssl rand -hex 32>
N8N_LAN_ONLY=true

# OpenAI ChatKit
OPENAI_API_KEY=sk-...
CHATKIT_AGENT_ID=asst_...
```

## File Locations

```
/opt/servers/DataAPI/          # Application directory
/opt/servers/DataAPI/.env      # Environment variables
/opt/servers/DataAPI/data_serv.js   # Main entry point
/etc/mosquitto/mosquitto.conf  # MQTT configuration
/etc/mosquitto/passwordfile    # MQTT passwords
/mnt/datalake                  # SMB mount (if enabled)
/home/dataapi/.pm2/            # PM2 configuration
```

## Logs

```bash
# PM2 application logs
sudo -u dataapi pm2 logs DataAPI
sudo -u dataapi pm2 logs DataAPI --err  # Errors only

# System service logs
sudo journalctl -u mongod -f
sudo journalctl -u mosquitto -f
sudo journalctl -u nginx -f

# Deployment script errors
# (shown in terminal during execution)
```

## Re-running Deployment

The script is **idempotent** - safe to run multiple times:

```bash
# Update configuration
vim deploy_dataapi_mint.sh

# Re-run (will update without destroying data)
sudo ./deploy_dataapi_mint.sh
```

**What gets updated**:
- ✅ Repository (git pull)
- ✅ Node dependencies
- ✅ .env file
- ✅ PM2 configuration
- ✅ Service configurations

**What is preserved**:
- ✅ MongoDB data
- ✅ MQTT passwords (unless changed)
- ✅ PM2 startup configuration

## Next Steps After Deployment

1. **Configure backups** (if SMB enabled):
   ```bash
   # Edit backup script
   sudo vim /usr/local/bin/mongo-backup.sh
   
   # Test backup
   sudo /usr/local/bin/mongo-backup.sh
   ```

2. **Set up SSL** (if using Nginx):
   - Install certbot
   - Configure domain name
   - Obtain Let's Encrypt certificate

3. **Configure firewall**:
   ```bash
   sudo ufw allow 22/tcp    # SSH
   sudo ufw allow 80/tcp    # HTTP
   sudo ufw allow 443/tcp   # HTTPS
   sudo ufw enable
   ```

4. **Test n8n integration** (if using):
   - Generate API key: `openssl rand -hex 32`
   - Add to .env: `N8N_API_KEY=...`
   - Restart app: `sudo -u dataapi pm2 restart DataAPI`

## Getting Help

1. Check documentation:
   - [DEPLOY_PREREQUISITES.md](DEPLOY_PREREQUISITES.md) - Setup requirements
   - `DEPLOYMENT_FIXES_SUMMARY.md` - What was fixed
   - [DEPLOY_MINT.md](DEPLOY_MINT.md) - Original deployment guide

2. Run diagnostics:
   ```bash
   sudo ./scripts/preflight_check.sh
   ```

3. Check service status:
   ```bash
   sudo systemctl status mongod mosquitto nginx
   sudo -u dataapi pm2 status
   ```

4. Review logs:
   ```bash
   sudo journalctl -xe
   sudo -u dataapi pm2 logs DataAPI --lines 100
   ```

