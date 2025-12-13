#!/usr/bin/env bash
# deploy_dataapi_mint.sh
# Linux Mint (Ubuntu-based) deployment for WindriderQc/DataAPI using PM2.
# MongoDB is NOT installed by this script (documented in DEPLOY_MINT.md).
#
# PREREQUISITES:
#   1. Review DEPLOY_PREREQUISITES.md for TrueNAS/VM setup requirements
#   2. Run: sudo ./scripts/preflight_check.sh
#   3. Only proceed if all critical checks pass
#
set -euo pipefail

########################################
# CONFIG
# Values can be set via environment variables or defaults below
# To use .env file: set -a; source deploy.env; set +a; sudo -E ./deploy_dataapi_mint.sh
########################################

# Server Configuration
SERVER_IP="${SERVER_IP:-192.168.2.33}"

# TrueNAS Host Configuration
TRUENAS_HOST_IP="${TRUENAS_HOST_IP:-192.168.2.31}"
ENABLE_SMB_MOUNTS="${ENABLE_SMB_MOUNTS:-yes}"     # yes/no
SMB_USER="${SMB_USER:-}"                          # SMB username (required if ENABLE_SMB_MOUNTS=yes)
SMB_PASS="${SMB_PASS:-}"                          # SMB password (required if ENABLE_SMB_MOUNTS=yes)

# Repository Configuration
REPO_URL="${REPO_URL:-https://github.com/WindriderQc/DataAPI.git}"
APP_NAME="${APP_NAME:-DataAPI}"
APP_USER="${APP_USER:-dataapi}"

APP_ROOT="${APP_ROOT:-/opt/servers}"
APP_DIR="${APP_DIR:-${APP_ROOT}/DataAPI}"

# Application Configuration
PORT="${PORT:-3003}"
NODE_ENV="${NODE_ENV:-production}"

# MongoDB Configuration (Manual install required)
MONGO_HOST="${MONGO_HOST:-127.0.0.1}"
MONGO_PORT="${MONGO_PORT:-27017}"
MONGO_DB_NAME="${MONGO_DB_NAME:-IoT}"

# MQTT (Mosquitto installed/configured by script)
MQTT_BROKER_URL="${MQTT_BROKER_URL:-mqtt://localhost:1883}"
MQTT_ISS_TOPIC="${MQTT_ISS_TOPIC:-liveData/iss}"
MQTT_USERNAME="${MQTT_USERNAME:-dataapi}"         # set "" to allow anonymous
MQTT_PASSWORD="${MQTT_PASSWORD:-}"                # REQUIRED if MQTT_USERNAME is set

# Nginx reverse proxy
ENABLE_NGINX="${ENABLE_NGINX:-yes}"              # yes/no

# Entrypoint - repo root includes data_serv.js
ENTRY_SCRIPT="${ENTRY_SCRIPT:-data_serv.js}"

########################################
# Helpers
########################################
need_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    echo "ERROR: Run as root: sudo bash $0"
    exit 1
  fi
}

say()  { echo -e "\n\033[1;32m==>\033[0m $*"; }
warn() { echo -e "\n\033[1;33m[WARN]\033[0m $*"; }
err()  { echo -e "\n\033[1;31m[ERROR]\033[0m $*"; }

trap 'err "Deployment failed on line $LINENO. Fix the issue, then re-run the script (it is safe/idempotent)."' ERR

require_cmd() {
  local c="$1"
  command -v "$c" >/dev/null 2>&1 || { err "Missing command: $c"; exit 1; }
}

ensure_pkg() {
  # usage: ensure_pkg pkg1 pkg2 ...
  apt update -y >/dev/null
  DEBIAN_FRONTEND=noninteractive apt install -y "$@"
}

safe_backup_file() {
  local f="$1"
  if [[ -f "$f" ]]; then
    cp -a "$f" "${f}.bak.$(date +%Y%m%d_%H%M%S)"
  fi
}

detect_ubuntu_codename() {
  # Mint usually sets UBUNTU_CODENAME in /etc/os-release
  local codename=""
  codename="$(. /etc/os-release && echo "${UBUNTU_CODENAME:-}")"
  if [[ -z "$codename" ]]; then
    codename="$(. /etc/os-release && echo "${VERSION_CODENAME:-}")"
  fi
  echo "$codename"
}

########################################
# Preconditions
########################################
need_root
require_cmd apt
require_cmd systemctl

if [[ -z "${APP_USER}" || -z "${APP_DIR}" || -z "${APP_NAME}" ]]; then
  err "APP_USER/APP_DIR/APP_NAME must not be empty."
  exit 1
fi

if [[ "${ENABLE_NGINX}" != "yes" && "${ENABLE_NGINX}" != "no" ]]; then
  err "ENABLE_NGINX must be yes or no."
  exit 1
fi

# Validate required credentials
if [[ "${ENABLE_SMB_MOUNTS}" == "yes" ]]; then
  if [[ -z "${SMB_USER}" || -z "${SMB_PASS}" ]]; then
    err "ENABLE_SMB_MOUNTS=yes requires SMB_USER and SMB_PASS to be set."
    err "Either set them as environment variables or disable SMB mounts."
    exit 1
  fi
fi

if [[ -n "${MQTT_USERNAME}" && -z "${MQTT_PASSWORD}" ]]; then
  err "MQTT_USERNAME is set but MQTT_PASSWORD is empty."
  err "Either set MQTT_PASSWORD or clear MQTT_USERNAME for anonymous access."
  exit 1
fi

########################################
# PREFLIGHT CHECKS
########################################
say "Running preflight checks..."

# 1) CPU AVX check (required for MongoDB 7.x)
say "Checking CPU for AVX support (required for MongoDB 7.x)"
if ! lscpu | grep -qiE 'avx'; then
  err "FATAL: CPU flags missing AVX. MongoDB 7.x will crash with illegal instruction."
  err "Fix: Set VM CPU mode to 'Host Passthrough' in TrueNAS SCALE."
  err "You must STOP and START the VM (not just reboot) for changes to apply."
  err ""
  err "Current CPU model: $(lscpu | grep 'Model name' | cut -d: -f2 | xargs)"
  err "Current CPU flags: $(lscpu | grep '^Flags:' | cut -d: -f2 | xargs)"
  exit 1
fi
say "✓ CPU has AVX support"

# 2) TrueNAS host reachability (required for SMB mounts)
if [[ "${ENABLE_SMB_MOUNTS}" == "yes" ]]; then
  say "Checking TrueNAS host reachability at ${TRUENAS_HOST_IP}"
  if ! ping -c1 -W2 "$TRUENAS_HOST_IP" >/dev/null 2>&1; then
    err "FATAL: Cannot reach TrueNAS host at ${TRUENAS_HOST_IP}."
    err "This likely means the VM NIC is not properly bridged."
    err ""
    err "Required setup:"
    err "  1. Create Linux bridge (br1) in TrueNAS SCALE"
    err "  2. Move host IP to bridge (${TRUENAS_HOST_IP}/24)"
    err "  3. Physical NIC becomes bridge member with no IP"
    err "  4. Attach VM NIC to br1"
    err ""
    err "Current network config:"
    ip addr show | grep -E '^[0-9]+:|inet ' || true
    exit 1
  fi
  say "✓ TrueNAS host is reachable"
fi

# 3) DNS and gateway check
say "Checking network configuration"
if ! ip route | grep -q default; then
  warn "No default gateway found. External connectivity may be limited."
fi

# 4) MongoDB reachability
say "Checking MongoDB reachability on ${MONGO_HOST}:${MONGO_PORT}"
if ! timeout 2 bash -c "cat < /dev/null > /dev/tcp/${MONGO_HOST}/${MONGO_PORT}" 2>/dev/null; then
  err "MongoDB is NOT reachable at ${MONGO_HOST}:${MONGO_PORT}."
  err "This deployment script REQUIRES MongoDB to be installed and running first."
  err "Please install MongoDB and ensure it is listening on ${MONGO_HOST}:${MONGO_PORT}."
  err "Refer to DEPLOY_MINT.md for manual MongoDB installation instructions."
  exit 1
fi
say "✓ MongoDB is reachable"

say "All preflight checks passed!"

########################################
# Install dependencies
########################################
say "Installing baseline dependencies"
ensure_pkg git curl ca-certificates gnupg lsb-release build-essential

########################################
# Node.js LTS via NodeSource
########################################
say "Installing Node.js (LTS) via NodeSource"
# Make install idempotent: if node exists and is reasonably new, skip reinstall
if command -v node >/dev/null 2>&1; then
  say "Node detected: $(node -v). Skipping NodeSource install."
else
  curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
  ensure_pkg nodejs
fi

require_cmd node
require_cmd npm
say "Node: $(node -v) | npm: $(npm -v)"

########################################
# PM2
########################################
say "Installing PM2 globally"
if command -v pm2 >/dev/null 2>&1; then
  say "PM2 detected: $(pm2 -v). Skipping install."
else
  npm i -g pm2
fi
require_cmd pm2

########################################
# Mosquitto
########################################
say "Installing Mosquitto (MQTT broker)"
ensure_pkg mosquitto mosquitto-clients
systemctl enable --now mosquitto

say "Configuring Mosquitto"
MOSQ_CONF="/etc/mosquitto/mosquitto.conf"
MOSQ_PASSFILE="/etc/mosquitto/passwordfile"

safe_backup_file "$MOSQ_CONF"

if [[ -n "${MQTT_USERNAME}" && -n "${MQTT_PASSWORD}" ]]; then
  cat > "$MOSQ_CONF" <<EOF
allow_anonymous false
password_file ${MOSQ_PASSFILE}

listener 1883

listener 9001
protocol websockets
EOF
  
  # Create password file with proper ownership and permissions
  if [ ! -f "$MOSQ_PASSFILE" ]; then
    install -o mosquitto -g mosquitto -m 640 /dev/null "$MOSQ_PASSFILE"
  fi
  
  # Set/update password (use -b to avoid prompt)
  mosquitto_passwd -b "$MOSQ_PASSFILE" "$MQTT_USERNAME" "$MQTT_PASSWORD"
  
  # Ensure correct ownership and permissions
  chown mosquitto:mosquitto "$MOSQ_PASSFILE"
  chmod 640 "$MOSQ_PASSFILE"
else
  warn "MQTT_USERNAME or MQTT_PASSWORD empty -> enabling anonymous MQTT"
  cat > "$MOSQ_CONF" <<EOF
allow_anonymous true

listener 1883

listener 9001
protocol websockets
EOF
fi

systemctl restart mosquitto
if ! systemctl is-active --quiet mosquitto; then
  err "Mosquitto failed to start. Recent logs:"
  journalctl -u mosquitto -n 60 --no-pager
  exit 1
fi
say "✓ Mosquitto is running"

########################################
# SMB Mounts (optional)
########################################
if [[ "${ENABLE_SMB_MOUNTS}" == "yes" ]]; then
  say "Configuring SMB mounts to TrueNAS host"
  
  # Install CIFS utilities
  ensure_pkg cifs-utils
  
  # Create mount points
  mkdir -p /mnt/datalake /mnt/media
  
  # Create credentials file
  SMB_CREDS="/root/.smbcredentials"
  cat > "$SMB_CREDS" <<EOF
username=${SMB_USER}
password=${SMB_PASS}
EOF
  chmod 600 "$SMB_CREDS"
  
  # Test mount before adding to fstab
  say "Testing SMB mount to ${TRUENAS_HOST_IP}..."
  if ! mount -t cifs "//${TRUENAS_HOST_IP}/Datalake" /mnt/datalake -o credentials="$SMB_CREDS",vers=3.1.1,iocharset=utf8 2>/dev/null; then
    warn "SMB mount test failed. Skipping fstab configuration."
    warn "You may need to configure SMB shares manually."
  else
    say "✓ SMB mount successful, adding to fstab"
    umount /mnt/datalake
    
    # Add to fstab if not already present
    if ! grep -q "/mnt/datalake" /etc/fstab; then
      cat >> /etc/fstab <<EOF

# TrueNAS SMB shares
//${TRUENAS_HOST_IP}/Datalake  /mnt/datalake  cifs  credentials=${SMB_CREDS},vers=3.1.1,iocharset=utf8,uid=1000,gid=1000,file_mode=0755,dir_mode=0755  0  0
//${TRUENAS_HOST_IP}/Media     /mnt/media     cifs  credentials=${SMB_CREDS},vers=3.1.1,iocharset=utf8,uid=1000,gid=1000,file_mode=0755,dir_mode=0755  0  0
EOF
    fi
    
    # Mount all
    mount -a
    
    # Verify
    if mount | grep -q "on /mnt/datalake "; then
      say "✓ SMB shares mounted successfully"
    else
      warn "SMB mount verification failed"
    fi
  fi
fi

########################################
# App user + directories
########################################
say "Ensuring app user exists: ${APP_USER}"
if ! id -u "$APP_USER" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "$APP_USER"
  # Add to users group
  usermod -aG users "$APP_USER"
fi

say "Ensuring app directory exists: ${APP_ROOT}"
mkdir -p "$APP_ROOT"
chown -R "$APP_USER:$APP_USER" "$APP_ROOT"

########################################
# Clone/update repo
########################################
say "Cloning/updating repo: ${REPO_URL}"
sudo -u "$APP_USER" bash -lc "
set -euo pipefail
if [[ -d '${APP_DIR}/.git' ]]; then
  cd '${APP_DIR}'
  git fetch --all
  git pull --ff-only
else
  cd '${APP_ROOT}'
  git clone '${REPO_URL}' '${APP_DIR}'
fi
"

########################################
# Install dependencies
########################################
say "Installing Node dependencies"
sudo -u "$APP_USER" bash -lc "
set -euo pipefail
cd '${APP_DIR}'
if [[ -f package-lock.json ]]; then
  npm ci
else
  npm install
fi
"

########################################
# Validate entry script exists
########################################
say "Validating entry script exists: ${ENTRY_SCRIPT}"
if [[ ! -f "${APP_DIR}/${ENTRY_SCRIPT}" ]]; then
  err "Entrypoint not found: ${APP_DIR}/${ENTRY_SCRIPT}"
  err "Fix ENTRY_SCRIPT in the script to the correct file, then re-run."
  exit 1
fi

########################################
# Write .env (owned by app user, 600)
########################################
say "Writing .env"
sudo -u "$APP_USER" bash -lc "
set -euo pipefail
cat > '${APP_DIR}/.env' <<EOF
NODE_ENV=${NODE_ENV}
PORT=${PORT}

# MongoDB
MONGO_URL=mongodb://${MONGO_HOST}:${MONGO_PORT}
MONGO_DB_NAME=${MONGO_DB_NAME}

# MQTT
MQTT_BROKER_URL=${MQTT_BROKER_URL}
MQTT_USERNAME=${MQTT_USERNAME}
MQTT_PASSWORD=${MQTT_PASSWORD}
MQTT_ISS_TOPIC=${MQTT_ISS_TOPIC}
EOF
chmod 600 '${APP_DIR}/.env'
"

########################################
# PM2 ecosystem file
########################################
say "Writing PM2 ecosystem config"
sudo -u "$APP_USER" bash -lc "
set -euo pipefail
cat > '${APP_DIR}/ecosystem.config.cjs' <<'EOF'
module.exports = {
  apps: [
    {
      name: '${APP_NAME}',
      script: '${ENTRY_SCRIPT}',
      cwd: '${APP_DIR}',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      time: true,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: '${NODE_ENV}',
        PORT: '${PORT}',
        MONGO_URL: 'mongodb://${MONGO_HOST}:${MONGO_PORT}',
        MONGO_DB_NAME: '${MONGO_DB_NAME}',
        MQTT_BROKER_URL: '${MQTT_BROKER_URL}',
        MQTT_USERNAME: '${MQTT_USERNAME}',
        MQTT_PASSWORD: '${MQTT_PASSWORD}',
        MQTT_ISS_TOPIC: '${MQTT_ISS_TOPIC}',
      },
    },
  ],
};
EOF
"

########################################
# Start / reload PM2 process
########################################
say "Starting/reloading PM2 app: ${APP_NAME}"
sudo -u "$APP_USER" bash -lc "
set -euo pipefail
cd '${APP_DIR}'
if pm2 describe '${APP_NAME}' >/dev/null 2>&1; then
  pm2 reload '${APP_NAME}' --update-env
else
  pm2 start ecosystem.config.cjs
fi
pm2 save
"

########################################
# Enable PM2 startup on boot
########################################
say "Enabling PM2 startup via systemd"
# pm2 startup outputs a command; capture and execute it properly
STARTUP_CMD=$(env PATH=$PATH:/usr/bin pm2 startup systemd -u "$APP_USER" --hp "/home/${APP_USER}" | tail -n 1)
if [[ "$STARTUP_CMD" =~ ^sudo ]]; then
  eval "$STARTUP_CMD"
fi
sudo -u "$APP_USER" pm2 save

########################################
# Nginx (optional)
########################################
if [[ "${ENABLE_NGINX}" == "yes" ]]; then
  say "Installing + configuring Nginx reverse proxy"
  ensure_pkg nginx

  NGINX_SITE="/etc/nginx/sites-available/dataapi"
  safe_backup_file "$NGINX_SITE"

  cat > "$NGINX_SITE" <<EOF
server {
  listen 80;
  server_name ${SERVER_IP};

  location / {
    proxy_pass http://127.0.0.1:${PORT};
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;

    proxy_buffering off;
    proxy_read_timeout 3600;
  }
}
EOF

  ln -sf "$NGINX_SITE" /etc/nginx/sites-enabled/dataapi
  rm -f /etc/nginx/sites-enabled/default || true
  nginx -t
  systemctl enable --now nginx
  systemctl reload nginx
fi

########################################
# Final checks
########################################
say "Final status"
echo "Mosquitto: $(systemctl is-active mosquitto)"
if [[ "${ENABLE_NGINX}" == "yes" ]]; then
  echo "Nginx:     $(systemctl is-active nginx)"
fi

sudo -u "$APP_USER" pm2 ls || true

echo
echo "DEPLOYMENT SUCCESSFUL!"
echo "Smoke test:"
if [[ "${ENABLE_NGINX}" == "yes" ]]; then
  echo "  curl -i http://${SERVER_IP}/"
else
  echo "  curl -i http://${SERVER_IP}:${PORT}/"
fi
echo
echo "Logs:"
echo "  sudo -u ${APP_USER} pm2 logs ${APP_NAME}"
echo "  sudo journalctl -u mosquitto -n 200 --no-pager"
if [[ "${ENABLE_NGINX}" == "yes" ]]; then
  echo "  sudo journalctl -u nginx -n 200 --no-pager"
fi
