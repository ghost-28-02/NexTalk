const { CallLog, CALL_LOG_STATUS } = require('../../database/models/CallLog.model');
const { toCallLogDTO } = require('./call.dto');

/**
 * Call service — persistence + history for the call feature.
 *
 * Pagination is cursor-based (consistent with notifications/messages):
 *   Initial:   GET /calls?limit=20         → 20 newest
 *   Load more: GET /calls?before={id}      → 20 older than that id
 */

const POPULATE = 'username displayName avatar';

function parseLimit(query, defaultLimit = 20, maxLimit = 50) {
  return Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
}

/**
 * Persist a finished call. Idempotent on `callId` — a second END (or a relayed
 * disconnect) won't create a duplicate row. Returns the saved document.
 */
async function recordCall({
  callId, caller, callee, callType, status, chatId,
  startedAt, answeredAt, endedAt, duration,
}) {
  return CallLog.findOneAndUpdate(
    { callId },
    {
      $setOnInsert: {
        callId, caller, callee, callType, status,
        chatId:    chatId || null,
        startedAt: startedAt || new Date(),
        answeredAt: answeredAt || null,
        endedAt:    endedAt || null,
        duration:   duration || 0,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
}

/**
 * Call history for a user — every call where they were caller OR callee,
 * newest first, with the peer populated and direction resolved per viewer.
 */
async function getUserCallHistory(userId, query) {
  const limit  = parseLimit(query);
  const before = query.before || null;

  const filter = { $or: [{ caller: userId }, { callee: userId }] };
  if (before) filter._id = { $lt: before };

  const raw = await CallLog.find(filter)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .populate('caller', POPULATE)
    .populate('callee', POPULATE)
    .lean();

  const hasMore    = raw.length > limit;
  const items      = hasMore ? raw.slice(0, limit) : raw;
  const nextCursor = hasMore ? items[items.length - 1]._id : null;

  return {
    calls: items.map((log) => toCallLogDTO(log, userId)),
    hasMore,
    nextCursor: nextCursor?.toString() ?? null,
  };
}

/** Count of missed INCOMING calls — used for a nav badge if desired. */
async function getMissedCount(userId) {
  return CallLog.countDocuments({ callee: userId, status: CALL_LOG_STATUS.MISSED });
}

/** Delete a single entry — only if the user was a participant. */
async function deleteCallEntry(callLogId, userId) {
  return CallLog.findOneAndDelete({
    _id: callLogId,
    $or: [{ caller: userId }, { callee: userId }],
  });
}

/** Clear the user's entire history (deletes only rows they were part of). */
async function clearHistory(userId) {
  return CallLog.deleteMany({ $or: [{ caller: userId }, { callee: userId }] });
}

module.exports = {
  recordCall,
  getUserCallHistory,
  getMissedCount,
  deleteCallEntry,
  clearHistory,
};
