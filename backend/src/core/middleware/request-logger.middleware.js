const { logger } = require('../../shared/utils/logger');

function requestLogger(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    logger[level](`${req.method} ${req.path} ${res.statusCode} — ${duration}ms`, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  });

  next();
}

module.exports = { requestLogger };
