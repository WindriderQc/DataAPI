const mqtt = require('mqtt');
require('dotenv').config();

let client;

const brokerUrl = process.env.MQTT_BROKER_URL;

function init(options = {}) {
  const connectOptions = {
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
    ...options,
  };

  client = mqtt.connect(brokerUrl, connectOptions);

  client.on('connect', () => {
    console.log('Connected to MQTT broker');
  });

  client.on('error', (error) => {
    console.error('MQTT client error:', error);
  });

  client.on('reconnect', () => {
    console.log('Reconnecting to MQTT broker...');
  });

  return client;
}

function publish(topic, message) {
  if (!client || !client.connected) {
    console.error('MQTT client is not connected. Cannot publish message.');
    return;
  }

  const messageToPublish = typeof message === 'object' ? JSON.stringify(message) : message;

  client.publish(topic, messageToPublish, (error) => {
    if (error) {
      console.error('Error publishing message:', error);
    } //else {
      //console.log(`Message published to topic ${topic}: ${messageToPublish}`);
    //}
  });
}

function getClient() {
  return client;
}

function close() {
  if (client) {
    client.end(true, () => { // true forces a disconnect
      console.log('MQTT client disconnected');
      client = null;
    });
  }
}

module.exports = {
  init,
  publish,
  getClient,
  close,
};
