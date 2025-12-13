# DataAPI
MongoDB API

## Automated Deployment (Recommended)

For automated deployment on Linux Mint / Ubuntu (especially TrueNAS SCALE VMs):

```bash
# 1. Review prerequisites
cat DEPLOY_PREREQUISITES.md

# 2. Run preflight check
sudo ./scripts/preflight_check.sh

# 3. Configure deployment
cp deploy.env.example deploy.env
nano deploy.env  # Edit with your credentials

# 4. Deploy
set -a; source deploy.env; set +a; sudo -E ./deploy_dataapi_mint.sh
```

**Documentation:**
- 📋 [`DEPLOY_PREREQUISITES.md`](DEPLOY_PREREQUISITES.md) - TrueNAS/VM setup requirements
- ⚡ [`QUICK_START.md`](QUICK_START.md) - Quick deployment guide  
- 🔧 [`DEPLOY_CONFIG_GUIDE.md`](DEPLOY_CONFIG_GUIDE.md) - Environment variable configuration
- 📝 [`DEPLOYMENT_FIXES_SUMMARY.md`](DEPLOYMENT_FIXES_SUMMARY.md) - What was fixed

---

## Manual Installation

On a fresh linux install like Bodhi 7


sudo apt install -y openssh-server
sudo curl -fsSL https://deb.nodesource.com/setup_current.x|sudo -E bash -
sudo apt update && sudo apt upgrade -y
sudo apt install -y nodejs
node -v
#sudo apt install -y nginx



/*  Install Mosquitto    */ 

sudo apt install mosquitto
mosquitto -d     ->  -d Run mosquitto in the background as a daemon
@flyinghq:~$ mosquitto_sub -t "test"
mosquitto_pub -m "message from mosquitto_pub client" -t "test"

sudo mosquitto_passwd -c passwordfile user              -> Create passwordfile and add user
mosquitto_passwd -b passwordfile user password          -> to add user to the created password file
mosquitto_passwd -D passwordfile user                   -> to delete user

sudo nano /etc/mosquitto/mosquitto.conf   
ex:
      pid_file /var/run/mosquitto.pid

      allow_anonymous false
      password_file /etc/mosquitto/passwordfile

      listener 1883

      listener 9001
      protocol websockets

      persistence false

      log_dest file /var/log/mosquitto/mosquitto.log






sudo npm install pm2@latest -g
sudo pm2 startup systemd
pm2 status
pm2 save



sudo apt install git -y


mkdir Servers
cd Servers
git clone https://github.com/WindriderQc/DataAPI.git
cd DataAPI

/* // Create .env file
USER=
PASSWORD=

PORT = 3003
*/

npm install
npm audit fix 
npm start


Usually configured with 192.168.1.33 static IP adresss (Patrick Roy = Keeper)






Install MongoDB
---------------

sudo apt install gnupg curl
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc |    sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg    --dearmor
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org
sudo systemctl start mongod
#sudo systemctl status mongod
#Download and install MongoDB Compass:
wget https://downloads.mongodb.com/compass/mongodb-compass_1.40.4_amd64.deb
sudo dpkg -i mongodb-compass_1.40.4_amd64.deb




Link to connect to local DB in Compass:
mongodb://localhost:27017
mongodb://localhost:27017/?readPreference=primary&appname=MongoDB%20Compass&ssl=false



Link to connect to cloud MongoDB or local in node.js:
DB_CONNECTION=mongodb+srv://USER:!!!PASSWORD!!!@cluster0-XXXX.mongodb.net/test?retryWrites=true&w=majority
DB_CONNECTION=mongodb://127.0.0.1:27017/IoT





Corruption recover:

sudo service mongod stop
sudo apt purge mongodb-org*
sudo rm -r /var/log/mongodb
sudo rm -r /var/lib/mongodb
wget -qO - https://www.mongodb.org/static/pgp/server-4.4.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/4.4 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-4.4.list
sudo apt update


sudo apt-get install mongodb-org=4.4.8 mongodb-org-server=4.4.8 mongodb-org-shell=4.4.8 mongodb-org-mongos=4.4.8 mongodb-org-tools=4.4.8
or
sudo apt install mongodb-org
sudo systemctl enable mongod
sudo systemctl start mongod
mongosh     //  test if working


## Live ISS Data via MQTT

Live International Space Station (ISS) location data is broadcast via MQTT. You can subscribe to this data stream using any MQTT client.

### Configuration

The following environment variables are used to configure the MQTT connection:

- `MQTT_BROKER_URL`: The URL of the MQTT broker (e.g., `mqtt://localhost:1883`). This is required.
- `MQTT_USERNAME`: The username for MQTT broker authentication (optional).
- `MQTT_PASSWORD`: The password for MQTT broker authentication (optional).
- `MQTT_ISS_TOPIC`: The MQTT topic to subscribe to for ISS data. Defaults to `liveData/iss` if not set (e.g., `liveData/iss`).

### Example Subscription (using Node.js `mqtt` library)

```javascript
const mqtt = require('mqtt');

const brokerUrl = 'mqtt://localhost:1883'; // Or your configured MQTT_BROKER_URL
const topic = 'liveData/iss'; // Or your configured MQTT_ISS_TOPIC

const client = mqtt.connect(brokerUrl);

client.on('connect', () => {
  console.log(`Connected to MQTT broker at ${brokerUrl}`);
  client.subscribe(topic, (err) => {
    if (err) {
      console.error('Subscription error:', err);
    } else {
      console.log(`Subscribed to topic: ${topic}`);
    }
  });
});

client.on('message', (receivedTopic, message) => {
  console.log(`Received message on topic ${receivedTopic}: ${message.toString()}`);
  // Example message: {"latitude":-20.745707393033,"longitude":-14.018700344334,"timeStamp":"2024-07-15T10:30:00.000Z"}
});

client.on('error', (error) => {
  console.error('MQTT client error:', error);
});

Database connections
--------------------

This application manages one MongoDB database per environment. The configuration and runtime access are simplified:

- MongoDB database names (actual DB names on the server). These are configured in `config/config.js`:
  - `config.db.mainDb` — the active database name (production: `datas`, non-production: `devdatas`).
  - `config.db.devDb`  — alias for the active database (kept for compatibility).

- Runtime DB handles exposed by the server at `app.locals.dbs`. Use these keys in application code:
  - `app.locals.dbs.mainDb` — the `Db` instance connected to the active database (production: `datas`, non-prod: `devdatas`).

Example usage in controllers:

```js
const db = req.app.locals.dbs.mainDb;
const users = await db.collection('users').find().toArray();
```

For compatibility, modules should use `app.locals.dbs.mainDb` as the single entry point for DB access.

If you need the `Db` instance keyed by the actual MongoDB database name (for dynamic lookup), you can also use:

```js
const db = req.app.locals.dbs[config.db.mainDb];
```

Prefer `app.locals.dbs.mainDb` in application code for clarity.