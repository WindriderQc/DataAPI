# Deployment Script Fixes - Summary

## Issues Resolved

Based on the detailed handoff report from TrueNAS SCALE AgentX VM deployment testing, the following critical issues have been fixed:

### 1. ✅ CPU AVX Requirements (MongoDB 7.x Compatibility)

**Problem**: MongoDB 7.x crashes with "Illegal instruction" on CPUs without AVX support (QEMU Virtual CPU).

**Fix**: 
- Added preflight check that verifies AVX CPU flags before proceeding
- Provides clear error message instructing to set VM CPU mode to "Host Passthrough"
- Displays current CPU model and flags for troubleshooting

**Code Location**: Lines ~103-117 in `deploy_dataapi_mint.sh`

### 2. ✅ TrueNAS Host Reachability (Bridge Configuration)

**Problem**: VM with NIC attached to physical interface (macvtap) cannot reach TrueNAS host.

**Fix**:
- Added preflight check for TrueNAS host reachability
- Provides diagnostic information about network configuration
- Fails early with instructions to create Linux bridge (br1)

**Code Location**: Lines ~119-136 in `deploy_dataapi_mint.sh`

### 3. ✅ Mosquitto Password File Ownership

**Problem**: Mosquitto service fails (exit code 13) due to missing or incorrectly owned password file.

**Fix**:
- Create password file with proper ownership (`mosquitto:mosquitto`)
- Set correct permissions (640)
- Use `install` command for atomic creation
- Better error reporting with journalctl output

**Code Location**: Lines ~156-187 in `deploy_dataapi_mint.sh`

### 4. ✅ SMB Mount Configuration

**Problem**: SMB mounts fail with "host unreachable" and fstab errors cause boot issues.

**Fix**:
- Added complete SMB mount section with proper sequencing
- Test mount before adding to fstab
- Create mount point directories before attempting mount
- Graceful fallback if SMB not available
- Added `ENABLE_SMB_MOUNTS` configuration option

**Code Location**: Lines ~191-233 in `deploy_dataapi_mint.sh`

### 5. ✅ PM2 Startup Command Quoting

**Problem**: PM2 startup command output was executed incorrectly, causing bash syntax errors.

**Original Error**:
```
bash: line 1: [PM2]: command not found
bash: line 2: Platform: command not found
```

**Fix**:
- Capture PM2 startup command output properly
- Execute only the actual command line (filter decorative output)
- Use `eval` for safe execution

**Code Location**: Lines ~316-323 in `deploy_dataapi_mint.sh`

---

## New Files Created

### 1. `DEPLOY_PREREQUISITES.md`

Comprehensive prerequisites documentation covering:
- TrueNAS network bridge configuration
- VM CPU passthrough setup
- SMB share configuration
- MongoDB installation requirements
- Firewall configuration
- Troubleshooting guide
- Step-by-step validation procedures

### 2. `scripts/preflight_check.sh`

Automated preflight validation script that checks:
- CPU AVX support
- TrueNAS host reachability
- Network gateway configuration
- DNS resolution
- MongoDB installation and connectivity
- Required commands availability
- Disk space
- SMB shares accessibility
- Available memory

**Usage**:
```bash
sudo ./scripts/preflight_check.sh
```

---

## Configuration Changes Required

Update the following in `deploy_dataapi_mint.sh` before running:

```bash
# TrueNAS Host Configuration
TRUENAS_HOST_IP="192.168.2.31"    # Your TrueNAS host IP
ENABLE_SMB_MOUNTS="yes"            # yes/no
SMB_USER="your_smb_user"           # SMB username
SMB_PASS="your_smb_pass"           # SMB password

# MQTT passwords
MQTT_PASSWORD="ChangeMeNow!"       # Change this!
```

---

## Deployment Workflow (New)

### Before (Problematic):
1. Run deploy script
2. Script fails at random points
3. No clear error messages
4. Manual recovery required

### After (Fixed):
1. **Review prerequisites**: `cat DEPLOY_PREREQUISITES.md`
2. **Complete TrueNAS setup**: Bridge, CPU, SMB shares
3. **Run preflight check**: `sudo ./scripts/preflight_check.sh`
4. **Fix any failures** reported by preflight
5. **Update configuration** in deploy script
6. **Run deployment**: `sudo ./deploy_dataapi_mint.sh`
7. **Script validates** and fails early with clear messages
8. **Idempotent**: Safe to re-run if issues occur

---

## Testing Recommendations

Before committing to production:

1. **Test on fresh VM**:
   - Verify preflight script catches all issues
   - Confirm deploy script runs cleanly after fixes

2. **Test error conditions**:
   - VM without AVX (should fail with clear message)
   - VM without bridge access (should fail with clear message)
   - Missing MongoDB (should fail with clear message)

3. **Test recovery**:
   - Run deploy script twice (idempotency)
   - Verify PM2 reload works correctly
   - Verify Mosquitto password update works

4. **Verify SMB mounts**:
   - Test with `ENABLE_SMB_MOUNTS="yes"`
   - Test with `ENABLE_SMB_MOUNTS="no"`
   - Verify fstab entries are correct

---

## Breaking Changes

None. The script is backward compatible but now requires:
- Configuration variables to be set (previously ignored)
- Preflight checks to pass (can be skipped but not recommended)

---

## Future Improvements

Potential enhancements not implemented in this fix:

1. **MongoDB Installation**: Add optional MongoDB installation section
2. **Backup Script Integration**: Auto-install MongoDB backup cron job
3. **Health Checks**: Post-deployment smoke tests
4. **Rollback Support**: Save previous state for emergency rollback
5. **Config Validation**: Validate configuration before deployment starts
6. **Log Aggregation**: Centralized logging setup

---

## Files Modified

- `deploy_dataapi_mint.sh` - Main deployment script (major updates)
- `DEPLOY_PREREQUISITES.md` - New comprehensive prerequisites guide
- `scripts/preflight_check.sh` - New automated validation script
- `DEPLOYMENT_FIXES_SUMMARY.md` - This document

---

## Verification Checklist

After running the fixed deployment script:

- [ ] Preflight checks all pass
- [ ] MongoDB accessible and running
- [ ] Mosquitto service active
- [ ] PM2 running DataAPI app
- [ ] PM2 startup service enabled
- [ ] SMB mounts working (if enabled)
- [ ] Nginx proxy working (if enabled)
- [ ] No errors in deployment logs
- [ ] App accessible via browser

---

## Support

For issues:
1. Check `DEPLOY_PREREQUISITES.md` for setup requirements
2. Run `sudo ./scripts/preflight_check.sh` for diagnostics
3. Review deployment logs: `sudo journalctl -xe`
4. Check service status: `sudo systemctl status mongod mosquitto nginx`
5. Check PM2 logs: `sudo -u dataapi pm2 logs`

