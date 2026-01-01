# DataAPI Deployment Prerequisites

This document outlines the required infrastructure setup before running `deploy_dataapi_mint.sh`. These steps must be completed on the TrueNAS SCALE host and verified before VM deployment.

## Critical Prerequisites Checklist

Complete ALL items before running the deployment script:

- [ ] TrueNAS host IP finalized and stable
- [ ] Linux bridge created and configured
- [ ] VM CPU mode set to Host Passthrough
- [ ] VM NIC attached to bridge
- [ ] Network connectivity verified
- [ ] SMB shares accessible (if using backups)
- [ ] MongoDB compatibility verified

---

## 1. TrueNAS Network Configuration

### Problem
By default, VMs with NICs attached directly to physical interfaces use macvtap, which **prevents VM-to-host communication**. The VM can reach the LAN but cannot reach the TrueNAS host itself.

### Solution: Create a Linux Bridge

#### Step 1: Create Bridge in TrueNAS UI

1. Navigate to: **Network → Interfaces**
2. Click **Add** to create a new interface
3. Configure:
   - **Type**: Bridge
   - **Name**: `br1`
   - **Bridge Members**: Select your physical NIC (e.g., `enp5s0`)
   - **IP Address**: `192.168.2.31/24` (or your chosen host IP)
   - **Aliases**: Leave empty or add as needed

#### Step 2: Remove IP from Physical NIC

**CRITICAL**: The physical NIC must have NO IP address once it becomes a bridge member.

1. Edit your physical interface (e.g., `enp5s0`)
2. Remove all IP addresses
3. Set to bridge member only

#### Step 3: Apply Configuration

**⚠️ WARNING**: This will briefly interrupt network connectivity.

1. Click **Test Changes**
2. Verify you can still access the UI at the new IP (192.168.2.31)
3. Click **Save Changes**
4. If changes fail, TrueNAS will rollback automatically

#### Step 4: Update VM NIC Configuration

1. Navigate to: **Virtualization → Virtual Machines**
2. Select your VM (AgentX)
3. Edit → Devices → Network Interface
4. Change **Attach NIC** from physical interface to `br1`
5. Save

#### Step 5: Verify Connectivity

**From the VM (after boot):**

```bash
# Verify bridge is reachable
ping -c3 192.168.2.31

# Verify gateway is reachable
ping -c3 192.168.2.1

# Verify external connectivity
ping -c3 8.8.8.8
```

**Expected output**: All pings should succeed.

---

## 2. VM CPU Configuration

### Problem
MongoDB 7.x requires AVX CPU instructions. Without AVX, MongoDB crashes with:
```
mongod.service failed with status=4/ILL (Illegal instruction)
```

### Solution: Enable Host CPU Passthrough

#### In TrueNAS SCALE UI:

1. Navigate to: **Virtualization → Virtual Machines**
2. Select your VM
3. Click **Edit**
4. Under **CPU Configuration**:
   - **CPU Mode**: `Host Passthrough` or `Host Model`
   - **CPU Model**: (auto-selected based on mode)
5. Save changes

#### ⚠️ CRITICAL: Restart VM Properly

**You MUST stop and start the VM** (not just reboot from inside Linux):

1. **Stop VM**: Click **Stop** in TrueNAS UI
2. Wait for VM to fully stop
3. **Start VM**: Click **Start**

A reboot from inside the Linux VM will NOT apply CPU changes!

#### Verify from Inside VM:

```bash
# Check for AVX support
lscpu | grep -i avx

# Expected output should include:
# Flags: ... avx avx2 ...
```

If no AVX flags appear, the CPU mode change didn't apply. Stop/start the VM again.

---

## 3. SMB Share Configuration (Optional but Recommended)

Required for MongoDB backups to TrueNAS storage.

### Step 1: Create SMB Shares in TrueNAS

1. Navigate to: **Shares → SMB**
2. Create shares:
   - **Datalake**: For MongoDB backups (`/mnt/pool/Datalake`)
   - **Media**: For media files if needed (`/mnt/pool/Media`)

### Step 2: Configure SMB Credentials

Create a dedicated user for VM access:

1. **System → Users → Add**
2. Username: `dataapi` (or your choice)
3. Set a strong password
4. Home directory: `/nonexistent` (service account)
5. Shell: `nologin`
6. Save

### Step 3: Set Share Permissions

For each share:
1. Edit share
2. **Advanced Options → Auxiliary Parameters**:
   ```
   valid users = dataapi
   write list = dataapi
   create mask = 0755
   directory mask = 0755
   ```
3. Save and restart SMB service

### Step 4: Test from Another Machine

```bash
# From any Linux machine on the network
smbclient -L //192.168.2.31 -U dataapi

# Mount test
sudo mount -t cifs //192.168.2.31/Datalake /mnt/test \
  -o username=dataapi,password=yourpass,vers=3.1.1
```

---

## 4. VM System Requirements

### Minimum Specifications:
- **RAM**: 2 GB minimum, 4 GB recommended
- **Disk**: 20 GB minimum
- **CPU**: 2 cores, Host Passthrough mode
- **Network**: Bridged to `br1`

### Operating System:
- **Linux Mint 21.x** (Ubuntu 24.04 base) or newer
- Fully updated: `sudo apt update && sudo apt upgrade -y`

---

## 5. MongoDB Pre-Installation

MongoDB is **NOT** installed by the deployment script. Install manually first.

### Installation Steps:

```bash
# Import MongoDB GPG key
curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc | \
  sudo gpg --dearmor -o /usr/share/keyrings/mongodb-server-8.0.gpg

# Add repository
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] \
  https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/8.0 multiverse" | \
  sudo tee /etc/apt/sources.list.d/mongodb-org-8.0.list

# Install
sudo apt update
sudo apt install -y mongodb-org

# Start and enable
sudo systemctl enable --now mongod

# Verify
sudo systemctl status mongod
mongosh --eval 'db.version()'  # Should show 8.x.x
```

### Verify AVX Support:

```bash
# MongoDB 5.0+ requires AVX CPU instructions - it will crash without them
sudo journalctl -u mongod -n 100 | grep -i illegal

# If you see "Illegal instruction", fix VM CPU mode (see section 2)
```

---

## 6. Firewall Configuration (if enabled)

If UFW or another firewall is active:

```bash
# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS (if using Nginx)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow app port (if direct access needed)
sudo ufw allow 3003/tcp

# Allow MQTT
sudo ufw allow 1883/tcp
sudo ufw allow 9001/tcp

# Enable firewall
sudo ufw enable
```

---

## Pre-Deployment Validation Script

Run this script **immediately before** running `deploy_dataapi_mint.sh`:

```bash
#!/bin/bash
# preflight_check.sh

echo "=== DataAPI Deployment Preflight Check ==="
echo

# 1. CPU AVX check
echo -n "CPU AVX support: "
if lscpu | grep -qiE 'avx'; then
  echo "✓ PASS"
else
  echo "✗ FAIL - Set VM CPU to Host Passthrough"
  exit 1
fi

# 2. Host reachability
echo -n "TrueNAS host reachable (192.168.2.31): "
if ping -c1 -W2 192.168.2.31 >/dev/null 2>&1; then
  echo "✓ PASS"
else
  echo "✗ FAIL - Check bridge configuration"
  exit 1
fi

# 3. Gateway reachable
echo -n "Gateway reachable: "
GATEWAY=$(ip route | grep default | awk '{print $3}')
if ping -c1 -W2 "$GATEWAY" >/dev/null 2>&1; then
  echo "✓ PASS ($GATEWAY)"
else
  echo "✗ FAIL - Network misconfigured"
  exit 1
fi

# 4. MongoDB running
echo -n "MongoDB service: "
if systemctl is-active --quiet mongod; then
  echo "✓ PASS"
else
  echo "✗ FAIL - Install MongoDB first"
  exit 1
fi

# 5. MongoDB reachable
echo -n "MongoDB port 27017: "
if timeout 2 bash -c "cat < /dev/null > /dev/tcp/127.0.0.1/27017" 2>/dev/null; then
  echo "✓ PASS"
else
  echo "✗ FAIL - MongoDB not listening"
  exit 1
fi

# 6. SMB shares (if needed)
echo -n "SMB share accessible: "
if smbclient -L //192.168.2.31 -N >/dev/null 2>&1; then
  echo "✓ PASS"
else
  echo "⚠ WARNING - SMB not accessible (optional)"
fi

echo
echo "=== All critical checks passed! ==="
echo "You can now run: sudo ./deploy_dataapi_mint.sh"
```

Make it executable and run:

```bash
chmod +x preflight_check.sh
sudo ./preflight_check.sh
```

---

## Troubleshooting Common Issues

### Issue: VM can reach LAN but not TrueNAS host

**Symptom**: `ping 8.8.8.8` works, `ping 192.168.2.31` fails

**Fix**: VM NIC is not bridged. See Section 1.

### Issue: MongoDB crashes with "Illegal instruction"

**Symptom**: `sudo journalctl -u mongod` shows `status=4/ILL`

**Fix**: VM CPU mode not set to Host Passthrough. See Section 2. **Must stop/start VM.**

### Issue: SMB mount shows "host unreachable"

**Symptom**: `mount error(113)`

**Fix**: Bridge issue or SMB service not running on TrueNAS.

```bash
# Verify from TrueNAS shell
systemctl status smbd
```

### Issue: TrueNAS UI locked out after bridge change

**Symptom**: Cannot access UI after applying network changes

**Fix**: 
1. Access via BMC/IPMI or direct console
2. Rollback changes: `midclt call system.general.rollback_network_changes`
3. Reconfigure carefully

---

## Final Pre-Deployment Checklist

Before running `deploy_dataapi_mint.sh`, confirm:

1. ✅ Bridge `br1` exists and has host IP (192.168.2.31)
2. ✅ Physical NIC is bridge member with no IP
3. ✅ VM NIC attached to `br1`
4. ✅ VM stopped/started after CPU mode change
5. ✅ `lscpu | grep avx` shows AVX flags
6. ✅ `ping 192.168.2.31` succeeds from VM
7. ✅ MongoDB installed and running
8. ✅ SMB shares created and accessible (if using backups)
9. ✅ Firewall rules configured
10. ✅ Preflight validation script passes

---

## Next Steps

Once all prerequisites are met:

1. Edit `deploy_dataapi_mint.sh` and update config section:
   ```bash
   TRUENAS_HOST_IP="192.168.2.31"
   SMB_USER="dataapi"
   SMB_PASS="your_password"
   ENABLE_SMB_MOUNTS="yes"  # or "no"
   ```

2. Run deployment:
   ```bash
   sudo ./deploy_dataapi_mint.sh
   ```

3. Monitor for errors. Script is idempotent and can be re-run.

---

## Support Resources

- **MongoDB Installation**: See `DEPLOY_MINT.md`
- **TrueNAS Networking**: https://www.truenas.com/docs/scale/scaletutorials/network/
- **SMB Configuration**: https://www.truenas.com/docs/scale/scaletutorials/shares/smb/

