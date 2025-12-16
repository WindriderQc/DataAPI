module.exports.requireToolKey = (req, res, next) => {
  const got = req.header('x-api-key');
  const expected = process.env.DATAAPI_API_KEY;

  if (!expected) {
    return res.status(500).json({
      status: 'error',
      message: 'DATAAPI_API_KEY not set on server'
    });
  }

  if (!got || got !== expected) {
    return res.status(401).json({
      status: 'error',
      message: 'Unauthorized'
    });
  }

  res.locals.isToolAuthenticated = true;
  return next();
};
