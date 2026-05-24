const isDev = (process.env.NODE_ENV || 'development') === 'development';

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = isDev ? LEVELS.debug : LEVELS.info;

function formatMessage(level, message, meta) {
  const ts = new Date().toISOString();
  const base = `[${ts}] [${level.toUpperCase()}] ${message}`;
  return meta ? `${base} ${JSON.stringify(meta)}` : base;
}

const logger = {
  error(message, meta) {
    if (currentLevel >= LEVELS.error) console.error(formatMessage('error', message, meta));
  },
  warn(message, meta) {
    if (currentLevel >= LEVELS.warn) console.warn(formatMessage('warn', message, meta));
  },
  info(message, meta) {
    if (currentLevel >= LEVELS.info) console.log(formatMessage('info', message, meta));
  },
  debug(message, meta) {
    if (currentLevel >= LEVELS.debug) console.log(formatMessage('debug', message, meta));
  },
};

// FUTURE: replace console calls with Winston transport when log aggregation (Datadog/Logtail) is added

module.exports = { logger };
