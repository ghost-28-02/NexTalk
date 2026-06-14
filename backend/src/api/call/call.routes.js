const { Router } = require('express');
const { protect } = require('../../core/middleware/auth.middleware');
const { ApiResponse } = require('../../core/response/api.response');
const { asyncHandler } = require('../../shared/utils/async-handler');
const callService = require('./call.service');

const router = Router();

router.use(protect);

/**
 * GET /calls?limit=20&before={cursor}
 * Cursor-based call history (both directions), newest first.
 * Returns: { calls[], hasMore, nextCursor }
 */
router.get('/', asyncHandler(async (req, res) => {
  const { calls, hasMore, nextCursor } =
    await callService.getUserCallHistory(req.user._id, req.query);
  return ApiResponse.success(res, { calls, hasMore, nextCursor });
}));

/**
 * GET /calls/missed-count
 * Count of incoming missed calls (optional nav badge).
 * Declared before DELETE /:id so "missed-count" isn't captured as :id.
 */
router.get('/missed-count', asyncHandler(async (req, res) => {
  const count = await callService.getMissedCount(req.user._id);
  return ApiResponse.success(res, { count });
}));

/** DELETE /calls — clear the whole history for this user. */
router.delete('/', asyncHandler(async (req, res) => {
  await callService.clearHistory(req.user._id);
  return ApiResponse.success(res, null, 'Call history cleared');
}));

/** DELETE /calls/:id — remove a single entry. */
router.delete('/:id', asyncHandler(async (req, res) => {
  await callService.deleteCallEntry(req.params.id, req.user._id);
  return ApiResponse.noContent(res);
}));

module.exports = router;
