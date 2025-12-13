#!/usr/bin/env bash
# preflight_check.sh
# Run this script before deploy_dataapi_mint.sh to verify prerequisites

set -euo pipefail

# Configuration (must match deploy script)
TRUENAS_HOST_IP="192.168.2.31"
MONGO_HOST="127.0.0.1"
MONGO_PORT="27017"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASS="${GREEN}✓ PASS${NC}"
FAIL="${RED}✗ FAIL${NC}"
WARN="${YELLOW}⚠ WARNING${NC}"

echo -e "\n${GREEN}=== DataAPI Deployment Preflight Check ===${NC}\n"

FAILED=0

# 1. Root check
echo -n "Running as root: "
if [[ "${EUID}" -eq 0 ]]; then
  echo -e "$PASS"
else
  echo -e "$FAIL - Run with: sudo $0"
  exit 1
fi

# 2. CPU AVX check
echo -n "CPU AVX support (MongoDB 7.x requirement): "
if lscpu | grep -qiE 'avx'; then
  echo -e "$PASS"
  CPU_MODEL=$(lscpu | grep 'Model name' | cut -d: -f2 | xargs)
  echo "  └─ CPU: $CPU_MODEL"
else
  echo -e "$FAIL"
  echo "  └─ MongoDB 7.x will crash without AVX instructions"
  echo "  └─ Fix: Set VM CPU mode to 'Host Passthrough' in TrueNAS SCALE"
  echo "  └─ Then STOP and START the VM (not just reboot)"
  FAILED=1
fi

# 3. TrueNAS host reachability
echo -n "TrueNAS host reachable ($TRUENAS_HOST_IP): "
if ping -c1 -W2 "$TRUENAS_HOST_IP" >/dev/null 2>&1; then
  echo -e "$PASS"
else
  echo -e "$FAIL"
  echo "  └─ Cannot reach TrueNAS host - likely bridge/NIC configuration issue"
  echo "  └─ VM NIC must be attached to bridge 'br1', not directly to physical NIC"
  echo "  └─ See DEPLOY_PREREQUISITES.md Section 1"
  FAILED=1
fi

# 4. Default gateway check
echo -n "Default gateway configured: "
GATEWAY=$(ip route | grep default | awk '{print $3}' | head -n1)
if [[ -n "$GATEWAY" ]]; then
  if ping -c1 -W2 "$GATEWAY" >/dev/null 2>&1; then
    echo -e "$PASS"
    echo "  └─ Gateway: $GATEWAY"
  else
    echo -e "$WARN - Gateway configured but unreachable"
    echo "  └─ Gateway: $GATEWAY"
  fi
else
  echo -e "$FAIL - No default gateway"
  FAILED=1
fi

# 5. DNS resolution
echo -n "DNS resolution: "
if host google.com >/dev/null 2>&1; then
  echo -e "$PASS"
else
  echo -e "$WARN - DNS may not be working"
  echo "  └─ External package downloads may fail"
fi

# 6. MongoDB service check
echo -n "MongoDB service running: "
if systemctl is-active --quiet mongod 2>/dev/null; then
  echo -e "$PASS"
  MONGO_VERSION=$(mongosh --quiet --eval 'db.version()' 2>/dev/null || echo "unknown")
  echo "  └─ Version: $MONGO_VERSION"
elif systemctl is-active --quiet mongodb 2>/dev/null; then
  echo -e "$PASS (service name: mongodb)"
  MONGO_VERSION=$(mongosh --quiet --eval 'db.version()' 2>/dev/null || echo "unknown")
  echo "  └─ Version: $MONGO_VERSION"
else
  echo -e "$FAIL"
  echo "  └─ MongoDB must be installed and running before deployment"
  echo "  └─ See DEPLOY_PREREQUISITES.md Section 5"
  FAILED=1
fi

# 7. MongoDB port check
echo -n "MongoDB listening on $MONGO_HOST:$MONGO_PORT: "
if timeout 2 bash -c "cat < /dev/null > /dev/tcp/${MONGO_HOST}/${MONGO_PORT}" 2>/dev/null; then
  echo -e "$PASS"
else
  echo -e "$FAIL"
  echo "  └─ MongoDB service may be running but not accepting connections"
  FAILED=1
fi

# 8. Required commands
echo -n "Required commands available: "
MISSING_CMDS=()
for cmd in curl git node npm systemctl; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    MISSING_CMDS+=("$cmd")
  fi
done
if [[ ${#MISSING_CMDS[@]} -eq 0 ]]; then
  echo -e "$PASS"
else
  echo -e "$FAIL"
  echo "  └─ Missing commands: ${MISSING_CMDS[*]}"
  FAILED=1
fi

# 9. Disk space check
echo -n "Disk space (/opt): "
AVAILABLE=$(df -BG /opt 2>/dev/null | tail -1 | awk '{print $4}' | sed 's/G//')
if [[ "$AVAILABLE" -gt 5 ]]; then
  echo -e "$PASS (${AVAILABLE}G available)"
else
  echo -e "$WARN (${AVAILABLE}G available, may be low)"
fi

# 10. SMB shares (optional)
echo -n "SMB shares accessible (optional): "
if command -v smbclient >/dev/null 2>&1; then
  if smbclient -L "//$TRUENAS_HOST_IP" -N >/dev/null 2>&1; then
    echo -e "$PASS"
    echo "  └─ SMB backups can be configured"
  else
    echo -e "$WARN - Not accessible"
    echo "  └─ MongoDB backups to NAS will not work"
    echo "  └─ Set ENABLE_SMB_MOUNTS=\"no\" in deploy script if not needed"
  fi
else
  echo -e "$WARN - smbclient not installed"
  echo "  └─ Install with: apt install cifs-utils smbclient"
fi

# 11. Memory check
echo -n "Available memory: "
TOTAL_MEM=$(free -g | awk '/^Mem:/{print $2}')
if [[ "$TOTAL_MEM" -ge 2 ]]; then
  echo -e "$PASS (${TOTAL_MEM}GB total)"
else
  echo -e "$WARN (${TOTAL_MEM}GB total, minimum is 2GB)"
fi

echo
echo "========================================="
if [[ $FAILED -eq 0 ]]; then
  echo -e "${GREEN}✓ All critical checks passed!${NC}"
  echo
  echo "You can now run:"
  echo "  sudo ./deploy_dataapi_mint.sh"
  echo
  echo "Before running, verify configuration in deploy_dataapi_mint.sh:"
  echo "  - TRUENAS_HOST_IP"
  echo "  - SMB_USER / SMB_PASS (if using SMB mounts)"
  echo "  - MQTT_USERNAME / MQTT_PASSWORD"
  exit 0
else
  echo -e "${RED}✗ Critical checks failed!${NC}"
  echo
  echo "Fix the issues above before running deployment."
  echo "See DEPLOY_PREREQUISITES.md for detailed setup instructions."
  exit 1
fi
