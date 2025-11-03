const crypto = require("crypto");

function apiKey(req, res, next) {
  const got = req.header("x-api-key");
  if (!got || got !== process.env.INTEGRATIONS_API_KEY) return res.status(401).end();
  next();
}

function hmacVerify(req, res, next) {
  const sig = req.header("x-signature") || "";
  const ts = req.header("x-timestamp") || "";
  const body = JSON.stringify(req.body || {});
  const base = `${ts}.${body}`;
  const calc = crypto.createHmac("sha256", process.env.INTEGRATIONS_HMAC_SECRET)
                     .update(base)
                     .digest("hex");
  if (crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(calc))) return next();
  return res.status(401).end();
}

module.exports = { apiKey, hmacVerify };
