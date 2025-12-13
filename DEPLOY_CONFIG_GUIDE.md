# Deployment Configuration Guide

## Overview

The deployment script now supports environment variables, allowing you to:
- **Publish the script safely** to GitHub without exposing credentials
- **Share configuration** across team members without hardcoding
- **Manage multiple environments** (dev, staging, production)

## Method 1: Using Environment File (Recommended)

### Step 1: Create Your Configuration

```bash
# Copy the example file
cp deploy.env.example deploy.env

# Edit with your actual credentials
nano deploy.env
```

### Step 2: Update Values

Edit `deploy.env` and set your actual credentials:

```bash
# TrueNAS Configuration
TRUENAS_HOST_IP="192.168.2.31"
SMB_USER="your_actual_username"
SMB_PASS="your_actual_password"

# MQTT Configuration
MQTT_PASSWORD="your_secure_mqtt_password"
```

### Step 3: Run Deployment

```bash
# Load environment variables and run with preserved environment
set -a                          # Auto-export all variables
source deploy.env               # Load your configuration
set +a                          # Turn off auto-export
sudo -E ./deploy_dataapi_mint.sh    # Run with -E to preserve environment
```

**One-liner version:**
```bash
set -a; source deploy.env; set +a; sudo -E ./deploy_dataapi_mint.sh
```

## Method 2: Export Variables Manually

```bash
# Export each variable
export TRUENAS_HOST_IP="192.168.2.31"
export SMB_USER="your_username"
export SMB_PASS="your_password"
export MQTT_PASSWORD="your_mqtt_password"

# Run deployment with preserved environment
sudo -E ./deploy_dataapi_mint.sh
```

## Method 3: Inline Variables

```bash
# Set variables for single command execution
sudo TRUENAS_HOST_IP="192.168.2.31" \
     SMB_USER="myuser" \
     SMB_PASS="mypass" \
     MQTT_PASSWORD="mqttpass" \
     ./deploy_dataapi_mint.sh
```

## Configuration Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `MQTT_PASSWORD` | MQTT broker password | `"SecurePass123!"` |

### Required if SMB Enabled

| Variable | Description | Example |
|----------|-------------|---------|
| `SMB_USER` | SMB/CIFS username | `"dataapi"` |
| `SMB_PASS` | SMB/CIFS password | `"SecurePass456!"` |

### Optional Variables (have defaults)

| Variable | Default | Description |
|----------|---------|-------------|
| `SERVER_IP` | `192.168.2.33` | VM IP address |
| `TRUENAS_HOST_IP` | `192.168.2.31` | TrueNAS host IP |
| `ENABLE_SMB_MOUNTS` | `yes` | Enable SMB mounts |
| `ENABLE_NGINX` | `yes` | Install Nginx proxy |
| `PORT` | `3003` | Application port |
| `MONGO_HOST` | `127.0.0.1` | MongoDB host |
| `MONGO_PORT` | `27017` | MongoDB port |
| `MQTT_USERNAME` | `dataapi` | MQTT username |

## Security Best Practices

### 1. Never Commit Credentials

The `.gitignore` file excludes:
- `.env` - Application environment file
- `deploy.env` - Deployment configuration file

**Always verify before committing:**
```bash
git status
# Ensure deploy.env is NOT listed
```

### 2. Use Strong Passwords

```bash
# Generate secure passwords
openssl rand -base64 32
```

### 3. Restrict File Permissions

```bash
# Protect your environment file
chmod 600 deploy.env
```

### 4. Use Different Passwords

Don't reuse passwords across:
- SMB credentials
- MQTT broker
- MongoDB (if auth enabled)
- Application secrets

## Validation

Before deployment, verify your configuration:

```bash
# Load your config
set -a; source deploy.env; set +a

# Check critical variables
echo "TRUENAS_HOST_IP: $TRUENAS_HOST_IP"
echo "SMB_USER: $SMB_USER"
echo "SMB_PASS: [hidden]"
echo "MQTT_PASSWORD: [hidden]"

# Run preflight check
sudo -E ./scripts/preflight_check.sh
```

## Troubleshooting

### Issue: Variables Not Set

**Symptom:**
```
[ERROR] ENABLE_SMB_MOUNTS=yes requires SMB_USER and SMB_PASS to be set.
```

**Fix:**
```bash
# Verify variables are exported
env | grep SMB

# If empty, reload config with export flag
set -a; source deploy.env; set +a

# Ensure using -E flag with sudo
sudo -E ./deploy_dataapi_mint.sh
```

### Issue: sudo Doesn't Preserve Environment

**Symptom:** Variables work without sudo but not with sudo

**Fix 1 - Use -E flag:**
```bash
sudo -E ./deploy_dataapi_mint.sh
```

**Fix 2 - Add to sudoers (advanced):**
```bash
sudo visudo
# Add line:
Defaults env_keep += "TRUENAS_HOST_IP SMB_USER SMB_PASS MQTT_PASSWORD"
```

### Issue: File Not Found

**Symptom:**
```
bash: deploy.env: No such file or directory
```

**Fix:**
```bash
# Create from example
cp deploy.env.example deploy.env
nano deploy.env
```

## Multiple Environments

You can maintain different configurations:

```bash
# Development
cp deploy.env.example deploy.dev.env
# Edit deploy.dev.env with dev settings

# Production
cp deploy.env.example deploy.prod.env
# Edit deploy.prod.env with prod settings

# Use specific environment
set -a; source deploy.prod.env; set +a; sudo -E ./deploy_dataapi_mint.sh
```

## CI/CD Integration

For automated deployments, set secrets in your CI/CD platform:

**GitHub Actions:**
```yaml
- name: Deploy to TrueNAS VM
  env:
    TRUENAS_HOST_IP: ${{ secrets.TRUENAS_HOST_IP }}
    SMB_USER: ${{ secrets.SMB_USER }}
    SMB_PASS: ${{ secrets.SMB_PASS }}
    MQTT_PASSWORD: ${{ secrets.MQTT_PASSWORD }}
  run: |
    sudo -E ./deploy_dataapi_mint.sh
```

**GitLab CI:**
```yaml
deploy:
  script:
    - export TRUENAS_HOST_IP=$TRUENAS_HOST_IP
    - export SMB_USER=$SMB_USER
    - export SMB_PASS=$SMB_PASS
    - export MQTT_PASSWORD=$MQTT_PASSWORD
    - sudo -E ./deploy_dataapi_mint.sh
```

## Default Behavior

If you don't set environment variables, the script uses safe defaults:

- SMB mounts: **Enabled** (will fail if credentials not set)
- MQTT password: **Empty** (will fail if username set)
- Other settings: Use sensible defaults

To run without SMB:
```bash
export ENABLE_SMB_MOUNTS="no"
sudo -E ./deploy_dataapi_mint.sh
```

## Quick Reference

```bash
# Complete deployment workflow
cp deploy.env.example deploy.env
nano deploy.env                 # Edit credentials
chmod 600 deploy.env            # Secure the file
sudo ./scripts/preflight_check.sh   # Validate prerequisites
set -a; source deploy.env; set +a   # Load config
sudo -E ./deploy_dataapi_mint.sh    # Deploy!
```

