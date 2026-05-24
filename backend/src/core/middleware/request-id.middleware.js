const crypto = require('crypto');

/**
 * Attaches a unique request ID to every inbound request.
 *
 * Priority: honour the incoming X-Request-ID header (set by API gateways,
 * load balancers, or the client) so the ID is consistent across your entire
 * distributed stack. If none is present, generate a fresh UUID.
 *
 * The ID is:
 *   • Stored on req.id for use in logger middleware and error handlers
 *   • Echoed back in the X-Request-ID response header so clients can correlate
 *     their request with a specific server-side log line
 *
 * FUTURE: When using Winston/Datadog, pass req.id as the `requestId` field in
 * every log entry within the request lifecycle via AsyncLocalStorage.
 */
function requestId(req, res, next) {
  const id = req.headers['x-request-id'] || crypto.randomUUID();
  req.id = id;
  res.setHeader('X-Request-ID', id);
  next();
}

module.exports = { requestId };
