# DataAPI Deployment (Linux Mint + PM2) — 192.168.2.33

This setup runs `WindriderQc/DataAPI` on Linux Mint using:
- Node.js (LTS)
- PM2 (with systemd boot startup)
- Mosquitto MQTT (1883 + websockets 9001)
- Optional Nginx reverse proxy (port 80)
- **MongoDB is required, but installed manually** (documented below)

## ⚠️ Important: Install MongoDB First!

The deployment script **does not install MongoDB**. You must install it manually before running the script. The script includes a preflight check that will abort the deployment if MongoDB is not reachable at `127.0.0.1:27017`.

## 1) Prepare the Machine & Install MongoDB

### Step A — Identify your Ubuntu base codename
Linux Mint is based on Ubuntu. Find out which version you are mimicking:
```bash
. /etc/os-release
echo "UBUNTU_CODENAME=$UBUNTU_CODENAME"
```
- Mint 21.x ≈ Ubuntu 22.04 (`jammy`)
- Mint 22.x ≈ Ubuntu 24.04 (`noble`)

If `UBUNTU_CODENAME` is empty, try `lsb_release -a`.

### Step B — Install MongoDB from the official repo
Follow [MongoDB’s official install documentation](https://www.mongodb.com/docs/manual/administration/install-on-linux/) for your Ubuntu base release (`jammy` or `noble`).

**Key configuration steps after install:**

1.  **Enable and start MongoDB:**
    ```bash
    sudo systemctl enable --now mongod
    ```

2.  **Verify it’s alive:**
    ```bash
    mongosh --eval 'db.runCommand({ ping: 1 })'
    ```

3.  **Ensure it binds to localhost:**
    Edit `/etc/mongod.conf` and ensure:
    ```yaml
    net:
      bindIp: 127.0.0.1
      port: 27017
    ```
    Then restart: `sudo systemctl restart mongod`

## 2) Run the Deployment Script

Once MongoDB is running, you can proceed with the script.

1.  **Create the script file:**
    ```bash
    nano deploy_dataapi_mint.sh
    # Paste the content of deploy_dataapi_mint.sh here
    ```

2.  **Make it executable:**
    ```bash
    chmod +x deploy_dataapi_mint.sh
    ```

3.  **Run it:**
    ```bash
    sudo bash ./deploy_dataapi_mint.sh
    ```
    *The script is idempotent: Re-running it is safe (it will pull updates, reinstall deps as needed, reload PM2, keep configs backed up).*

## 3) Where things live

- **App code:** `/opt/servers/DataAPI`
- **Env file:** `/opt/servers/DataAPI/.env` (chmod 600)
- **PM2 config:** `/opt/servers/DataAPI/ecosystem.config.cjs`
- **Mosquitto config:** `/etc/mosquitto/mosquitto.conf`
- **Nginx site (if enabled):** `/etc/nginx/sites-available/dataapi`

## 4) Verify Services

### PM2
```bash
sudo -u dataapi pm2 ls
sudo -u dataapi pm2 logs DataAPI
sudo -u dataapi pm2 monit
```

### MQTT (Mosquitto)
```bash
systemctl status mosquitto --no-pager
journalctl -u mosquitto -n 200 --no-pager
```
Quick pub/sub test (if auth enabled):
```bash
mosquitto_sub -t test -u dataapi -P 'ChangeMeNow!' &
mosquitto_pub -t test -m hello -u dataapi -P 'ChangeMeNow!'
```

### HTTP
If Nginx enabled:
```bash
curl -i http://192.168.2.33/
```
If Nginx disabled:
```bash
curl -i http://192.168.2.33:3003/
```

## 5) Update / Redeploy Workflow

To update the application code:
```bash
sudo -u dataapi bash -lc "
cd /opt/servers/DataAPI
git pull --ff-only
if [[ -f package-lock.json ]]; then npm ci; else npm install; fi
pm2 reload DataAPI --update-env
pm2 save
"
```
Or simply re-run the `deploy_dataapi_mint.sh` script.

## 6) Common Failure Patterns

- **App keeps restarting in PM2:**
  Usually means MongoDB is down or the connection string in `.env` is wrong.
  Check logs: `sudo -u dataapi pm2 logs DataAPI`

- **MQTT issues:**
  Check broker status: `systemctl status mosquitto`

- **Nginx issues:**
  Check config syntax: `nginx -t`
  Check logs: `journalctl -u nginx`
