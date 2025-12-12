#!/usr/bin/env bash
# deploy_dataapi_mint.sh
# Linux Mint (Ubuntu-based) deployment for WindriderQc/DataAPI using PM2.
# MongoDB is NOT installed by this script (documented in DEPLOY_MINT.md).
set -euo pipefail

########################################
# CONFIG (edit before running)
########################################
SERVER_IP="192.168.2.33"

REPO_URL="https://github.com/WindriderQc/DataAPI.git"
APP_NAME="DataAPI"
APP_USER="dataapi"

APP_ROOT="/opt/servers"
APP_DIR="${APP_ROOT}/DataAPI"

PORT="3003"
NODE_ENV="production"

# MongoDB Configuration (Manual install required)
MONGO_HOST="127.0.0.1"
MONGO_PORT="27017"
MONGO_DB_NAME="IoT"

# MQTT (Mosquitto installed/configured by script)
MQTT_BROKER_URL="mqtt://localhost:1883"
MQTT_ISS_TOPIC="liveData/iss"
MQTT_USERNAME="dataapi"         # set "" to allow anonymous
MQTT_PASSWORD="ChangeMeNow!"    # set "" to allow anonymous

# Nginx reverse proxy
ENABLE_NGINX="yes"              # yes/no

# Entrypoint - repo root includes data_serv.js
ENTRY_SCRIPT="data_serv.js"

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

########################################
# Check MongoDB Reachability (Preflight)
########################################
say "Checking MongoDB reachability on ${MONGO_HOST}:${MONGO_PORT}"
# Using bash's built-in TCP check to avoid netcat dependency issues
if ! timeout 2 bash -c "cat < /dev/null > /dev/tcp/${MONGO_HOST}/${MONGO_PORT}"; then
  err "MongoDB is NOT reachable at ${MONGO_HOST}:${MONGO_PORT}."
  err "This deployment script REQUIRES MongoDB to be installed and running first."
  err "Please install MongoDB and ensure it is listening on ${MONGO_HOST}:${MONGO_PORT}."
  err "Refer to DEPLOY_MINT.md for manual MongoDB installation instructions."
  exit 1
fi
say "MongoDB is reachable."

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
  touch "$MOSQ_PASSFILE"
  chmod 600 "$MOSQ_PASSFILE"
  mosquitto_passwd -b "$MOSQ_PASSFILE" "$MQTT_USERNAME" "$MQTT_PASSWORD"
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
systemctl is-active --quiet mosquitto || { err "Mosquitto failed to start. Check: sudo journalctl -u mosquitto -n 200 --no-pager"; exit 1; }

########################################
# App user + directories
########################################
say "Ensuring app user exists: ${APP_USER}"
if ! id -u "$APP_USER" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "$APP_USER"
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
# pm2 startup outputs a command; run it safely
env PATH=$PATH:/usr/bin pm2 startup systemd -u "$APP_USER" --hp "/home/${APP_USER}" | bash
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
