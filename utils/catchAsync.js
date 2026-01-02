// Wrapper for async route handlers to catch errors
// and pass them to Express error handling middleware
module.exports = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
