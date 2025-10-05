const EventEmitter = require('events');

// Simple in-memory progress bus keyed by jobId. Suitable for single-instance
// deployments or local use. For multi-instance deployments use a shared
// pub/sub (Redis, etc.).
const bus = new Map();

function create(jobId) {
  const emitter = new EventEmitter();
  // remove max listeners warning for legitimate multi-listener cases
  emitter.setMaxListeners(50);
  bus.set(jobId, emitter);
  return emitter;
}

function get(jobId) {
  return bus.get(jobId);
}

function emit(jobId, event, data) {
  const e = get(jobId);
  if (e) e.emit(event, data);
}

function remove(jobId) {
  const e = get(jobId);
  if (e) {
    e.removeAllListeners();
    bus.delete(jobId);
  }
}

module.exports = { create, get, emit, remove };
