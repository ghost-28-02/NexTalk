const express = require('express');
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const fileUpload = require('express-fileupload');

const apiRoutes = require('./api/index');
const { errorMiddleware, notFoundMiddleware } = require('./core/middleware/error.middleware');
const { requestLogger } = require('./core/middleware/request-logger.middleware');
const { requestId } = require('./core/middleware/request-id.middleware');
const { apiRateLimiter } = require('./core/middleware/rate-limit.middleware');
const { appConfig } = require('./config/app.config');

const app = express();

/**
 * Trust the first hop proxy (Nginx, Heroku, AWS ALB, etc.)
 * so that req.ip reflects the real client IP, not the proxy IP.
 * Without this, IP-based rate limiting sees every user as the same "client".
 * Set to the number of trusted proxy hops in front of the app.
 */
app.set('trust proxy', 1);

// --- Security Headers (helmet) ---
// Sets X-Content-Type-Options, X-Frame-Options, Referrer-Policy, X-DNS-Prefetch-Control, etc.
// crossOriginResourcePolicy: 'cross-origin' — allows avatars/media to load in <img> tags
// from the frontend domain even when hosted on a CDN.
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// --- CORS ---
app.use(cors({
  origin: appConfig.frontendUrl,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  exposedHeaders: ['X-Request-ID'], // Allow client to read correlation ID from response
}));

// --- Compression (gzip) ---
// Skip compression for responses smaller than 1 KB (already tiny; overhead > benefit)
app.use(compression({ threshold: 1024 }));

// --- Request ID — attach before parsers so req.id is available in all subsequent middleware ---
app.use(requestId);

// --- Body Parsing ---
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(fileUpload({
  useTempFiles: true,
  tempFileDir: '/tmp/',
  limits: { fileSize: 50 * 1024 * 1024 },
}));

// --- Observability ---
app.use(requestLogger);

// --- Local upload static serving ---
// Active when STORAGE_PROVIDER=local or Cloudinary env vars are absent (dev default).
// In production with Cloudinary/S3, this directory will be empty and harmless.
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// --- Health check (no auth, no rate limit) ---
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- API routes ---
app.use('/api/v1', apiRateLimiter, apiRoutes);

// --- Error handling (must be last) ---
app.use(notFoundMiddleware);
app.use(errorMiddleware);

module.exports = app;
