/**
 * Wraps an async route handler so thrown errors are forwarded to Express error middleware.
 * Eliminates try/catch boilerplate in every controller.
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = { asyncHandler };
