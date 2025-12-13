#!/usr/bin/env bash
# deploy.sh - Simplified deployment wrapper
# This script handles environment loading and calls the main deployment script

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_ENV="${SCRIPT_DIR}/deploy.env"
DEPLOY_SCRIPT="${SCRIPT_DIR}/deploy_dataapi_mint.sh"

echo "=== DataAPI Deployment Wrapper ==="
echo

# Check if running as root
if [[ "${EUID}" -ne 0 ]]; then
  echo "ERROR: This script must be run as root"
  echo "Usage: sudo $0"
  exit 1
fi

# Check if deploy.env exists
if [[ ! -f "$DEPLOY_ENV" ]]; then
  echo "ERROR: Configuration file not found: $DEPLOY_ENV"
  echo
  echo "To create it:"
  echo "  cp deploy.env.example deploy.env"
  echo "  nano deploy.env"
  echo
  echo "See DEPLOY_CONFIG_GUIDE.md for details"
  exit 1
fi

# Check if deploy script exists
if [[ ! -f "$DEPLOY_SCRIPT" ]]; then
  echo "ERROR: Deployment script not found: $DEPLOY_SCRIPT"
  exit 1
fi

# Load environment variables
echo "Loading configuration from: $DEPLOY_ENV"
set -a
# shellcheck source=/dev/null
source "$DEPLOY_ENV"
set +a

echo "Configuration loaded successfully"
echo

# Validate critical variables
MISSING_VARS=()

if [[ "${ENABLE_SMB_MOUNTS:-yes}" == "yes" ]]; then
  [[ -z "${SMB_USER:-}" ]] && MISSING_VARS+=("SMB_USER")
  [[ -z "${SMB_PASS:-}" ]] && MISSING_VARS+=("SMB_PASS")
fi

if [[ -n "${MQTT_USERNAME:-}" && -z "${MQTT_PASSWORD:-}" ]]; then
  MISSING_VARS+=("MQTT_PASSWORD")
fi

if [[ ${#MISSING_VARS[@]} -gt 0 ]]; then
  echo "ERROR: Missing required variables in $DEPLOY_ENV:"
  printf '  - %s\n' "${MISSING_VARS[@]}"
  echo
  echo "Edit $DEPLOY_ENV and set these variables"
  exit 1
fi

echo "All required variables are set"
echo

# Run the deployment script
echo "Starting deployment..."
echo "========================================"
echo

exec "$DEPLOY_SCRIPT"
