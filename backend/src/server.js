require('dotenv').config();

const http = require('http');
const app = require('./app');
const { validateEnv, connectDatabase, disconnectDatabase, connectCloudinary } = require('./config/index');
const { initSocketManager } = require('./sockets/socket.manager');
const { logger } = require('./shared/utils/logger');
const { appConfig } = require('./config/app.config');

// Fail fast on missing env — catches misconfigured deploys immediately
validateEnv();

const httpServer = http.createServer(app);

// Socket.IO is attached to the same HTTP server — no extra port needed
initSocketManager(httpServer);

async function start() {
  await connectDatabase();
  connectCloudinary();

  httpServer.listen(appConfig.port, () => {
    logger.info(`[Server] Running on port ${appConfig.port} (${appConfig.env})`);
    logger.info(`[Server] API: http://localhost:${appConfig.port}/api/v1`);
  });
}

// --- Graceful shutdown ---
async function shutdown(signal) {
  logger.info(`[Server] ${signal} received — shutting down gracefully`);

  httpServer.close(async () => {
    await disconnectDatabase();
    logger.info('[Server] Shutdown complete');
    process.exit(0);
  });

  // Force exit if graceful shutdown hangs beyond 10s
  setTimeout(() => {
    logger.error('[Server] Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('[Server] Unhandled promise rejection', { reason: String(reason) });
});

process.on('uncaughtException', (err) => {
  logger.error('[Server] Uncaught exception — exiting', { err: err.message });
  process.exit(1);
});

start();
