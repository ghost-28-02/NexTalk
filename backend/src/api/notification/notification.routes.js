const { Router } = require('express');
const { protect } = require('../../core/middleware/auth.middleware');
const { ApiResponse } = require('../../core/response/api.response');
const { asyncHandler } = require('../../shared/utils/async-handler');
const { NOTIFICATION_EVENTS } = require('../../shared/constants/events');
const notificationService = require('./notification.service');

const router = Router();

router.use(protect);

/** Lazy-require getIO to avoid circular imports at module-load time. */
function tryEmitToUser(userId, event, data) {
  try {
    const { getIO } = require('../../sockets/socket.manager');
    getIO().to(`user:${userId}`).emit(event, data);
  } catch { /* socket not yet initialised */ }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * GET /notifications?limit=20&before={cursor}
 * Cursor-based pagination — consistent with message pagination.
 * Returns: { notifications[], hasMore, nextCursor }
 */
router.get('/', asyncHandler(async (req, res) => {
  const { notifications, hasMore, nextCursor } =
    await notificationService.getUserNotifications(req.user._id, req.query);
  return ApiResponse.success(res, { notifications, hasMore, nextCursor });
}));

/**
 * GET /notifications/unread-count
 * Returns the total unread notification count for the badge.
 * IMPORTANT: Express routes are matched in declaration order — this must come
 * before PATCH /:id/read to avoid "unread-count" being captured as :id.
 */
router.get('/unread-count', asyncHandler(async (req, res) => {
  const count = await notificationService.getUnreadCount(req.user._id);
  return ApiResponse.success(res, { count });
}));

/**
 * PATCH /notifications/read-all
 * Marks all unread notifications as read and pushes cross-device sync event.
 * Must be declared before PATCH /:id/read.
 */
router.patch('/read-all', asyncHandler(async (req, res) => {
  await notificationService.markAllRead(req.user._id);

  // Cross-device sync: push read-all to all other sockets for this user
  // so badge/list on phone clears when desktop marks-all-read.
  tryEmitToUser(req.user._id.toString(), NOTIFICATION_EVENTS.READ_ALL, {});

  return ApiResponse.success(res, null, 'All notifications marked as read');
}));

/** PATCH /notifications/:id/read */
router.patch('/:id/read', asyncHandler(async (req, res) => {
  await notificationService.markRead(req.params.id, req.user._id);
  return ApiResponse.noContent(res);
}));

/** DELETE /notifications/:id */
router.delete('/:id', asyncHandler(async (req, res) => {
  await notificationService.deleteNotification(req.params.id, req.user._id);
  return ApiResponse.noContent(res);
}));

module.exports = router;
