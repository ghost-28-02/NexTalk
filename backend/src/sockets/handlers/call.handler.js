const presenceAdapter = require('../adapters/memory.adapter');
// FUTURE [Redis]: swap above import for redis.adapter.js — no changes below needed
const { CALL_EVENTS } = require('../../shared/constants/events');
const { logger } = require('../../shared/utils/logger');
const callService = require('../../api/call/call.service');
const { CALL_LOG_STATUS } = require('../../database/models/CallLog.model');

/**
 * Call handler — WebRTC signaling relay.
 *
 * The server NEVER touches media. Audio/video flows peer-to-peer via WebRTC.
 * This handler only forwards the handshake (offer / answer / ICE) and the
 * call lifecycle events (initiate / accept / reject / end) between the two
 * users' personal rooms (`user:{userId}`) — the same targeted-delivery
 * pattern used by notifications.
 *
 * Why personal rooms (not chat rooms)?
 *   Call signals must reach the callee even when they don't have the chat
 *   open (they haven't joined `chat:{chatId}`). Personal rooms are joined
 *   on connect, so delivery is guaranteed for every online device.
 *
 * Busy tracking:
 *   In-memory Map<userId, { callId, peerId, state }> mirrors the
 *   memory.adapter presence pattern. A user is "busy" from the moment a
 *   call starts ringing until it ends. Single-server only.
 *   FUTURE [Redis multi-instance]: move this Map into Redis
 *   (HSET call:active:{userId}) so busy state is shared across instances.
 *
 * Known limitation (multi-device):
 *   If a user accepts a call on device A, the incoming-call UI on their
 *   device B is dismissed client-side when ACCEPTED/REJECTED/ENDED reaches
 *   the personal room — all devices share `user:{userId}`.
 */

// ─── Active call registry ─────────────────────────────────────────────────────
// userId → { callId, peerId, state: 'ringing' | 'active' }
const activeCalls = new Map();

// ─── Call history metadata ────────────────────────────────────────────────────
// callId → { callerId, calleeId, callType, chatId, startedAt, answeredAt }
// Timing lives here while the call is in flight; on a terminal event we compute
// the final status + duration and persist ONE CallLog. Deleted after finalize
// so a relayed double-END can't write twice. FUTURE [Redis]: move to Redis too.
const callMeta = new Map();

const CALL_STATES = Object.freeze({ RINGING: 'ringing', ACTIVE: 'active' });

function clearCall(callId) {
  for (const [uid, call] of activeCalls.entries()) {
    if (call.callId === callId) activeCalls.delete(uid);
  }
}

/**
 * Persist a finished call exactly once, then notify both participants so their
 * history refreshes. `outcome` is 'declined' for an active reject; anything
 * else falls back to 'missed' when the call was never answered.
 *
 * @param {import('socket.io').Server} io
 * @param {string} callId
 * @param {'declined'|'ended'|'disconnect'} outcome
 */
async function finalizeCall(io, callId, outcome) {
  const meta = callMeta.get(callId);
  if (!meta) return;          // already finalized (idempotent)
  callMeta.delete(callId);

  const answered = Boolean(meta.answeredAt);
  const endedAt  = Date.now();

  let status;
  if (answered)                  status = CALL_LOG_STATUS.ANSWERED;
  else if (outcome === 'declined') status = CALL_LOG_STATUS.DECLINED;
  else                           status = CALL_LOG_STATUS.MISSED;

  const duration = answered
    ? Math.max(0, Math.round((endedAt - meta.answeredAt) / 1000))
    : 0;

  try {
    await callService.recordCall({
      callId,
      caller:     meta.callerId,
      callee:     meta.calleeId,
      callType:   meta.callType,
      chatId:     meta.chatId,
      status,
      startedAt:  new Date(meta.startedAt),
      answeredAt: answered ? new Date(meta.answeredAt) : null,
      endedAt:    new Date(endedAt),
      duration,
    });

    // Nudge both clients to refresh their Calls list.
    io.to(`user:${meta.callerId}`).emit(CALL_EVENTS.LOGGED, { callId });
    io.to(`user:${meta.calleeId}`).emit(CALL_EVENTS.LOGGED, { callId });
  } catch (err) {
    logger.error(`[Call] failed to persist ${callId}: ${err.message}`);
  }
}

// ─── Handler ─────────────────────────────────────────────────────────────────

function registerCallHandler(io, socket) {
  const userId = socket.user._id.toString();

  const toUser = (targetUserId) => io.to(`user:${targetUserId}`);

  // ── INITIATE — caller starts a call ────────────────────────────────────────
  // Ack callback tells the caller immediately whether ringing started:
  //   { ok: true }                      — callee is being rung
  //   { ok: false, reason: 'offline' }  — callee has no connected sockets
  //   { ok: false, reason: 'busy' }     — callee (or caller) already in a call
  socket.on(CALL_EVENTS.INITIATE, (payload = {}, ack) => {
    const { callId, targetUserId, callType, chatId } = payload;

    if (!callId || !targetUserId || !callType) {
      if (typeof ack === 'function') ack({ ok: false, reason: 'invalid_payload' });
      return;
    }

    if (!presenceAdapter.isUserOnline(targetUserId)) {
      if (typeof ack === 'function') ack({ ok: false, reason: 'offline' });
      return;
    }

    if (activeCalls.has(targetUserId) || activeCalls.has(userId)) {
      if (typeof ack === 'function') ack({ ok: false, reason: 'busy' });
      return;
    }

    // Mark BOTH parties busy while ringing — a third caller gets 'busy'.
    activeCalls.set(userId,      { callId, peerId: targetUserId, state: CALL_STATES.RINGING });
    activeCalls.set(targetUserId, { callId, peerId: userId,      state: CALL_STATES.RINGING });

    // Start tracking timing for the history record (finalized on terminal event).
    callMeta.set(callId, {
      callerId:   userId,
      calleeId:   targetUserId,
      callType,
      chatId:     chatId || null,
      startedAt:  Date.now(),
      answeredAt: null,
    });

    const avatar = socket.user.avatar?.url ?? socket.user.avatar ?? null;

    toUser(targetUserId).emit(CALL_EVENTS.INCOMING, {
      callId,
      callType, // 'audio' | 'video'
      chatId:   chatId || null,
      caller: {
        id:       userId,
        username: socket.user.username,
        name:     socket.user.displayName || socket.user.username,
        avatar,
      },
    });

    logger.info(`[Call] ${socket.user.username} → user:${targetUserId} (${callType}) ringing`);
    if (typeof ack === 'function') ack({ ok: true });
  });

  // ── ACCEPT — callee is ready (media acquired, listeners registered) ────────
  // The caller creates the SDP offer only AFTER receiving ACCEPTED, which
  // guarantees the callee's signaling listeners exist — no offer/page race.
  socket.on(CALL_EVENTS.ACCEPT, ({ callId, targetUserId } = {}) => {
    if (!callId || !targetUserId) return;

    const callerCall = activeCalls.get(targetUserId);
    if (!callerCall || callerCall.callId !== callId) return; // stale / cancelled

    activeCalls.set(userId,       { callId, peerId: targetUserId, state: CALL_STATES.ACTIVE });
    activeCalls.set(targetUserId, { callId, peerId: userId,       state: CALL_STATES.ACTIVE });

    // Stamp the answer time → marks this call 'answered' and starts the duration clock.
    const meta = callMeta.get(callId);
    if (meta && !meta.answeredAt) meta.answeredAt = Date.now();

    toUser(targetUserId).emit(CALL_EVENTS.ACCEPTED, { callId, fromUserId: userId });
    logger.info(`[Call] ${callId} accepted by ${socket.user.username}`);
  });

  // ── REJECT — callee declines ────────────────────────────────────────────────
  socket.on(CALL_EVENTS.REJECT, ({ callId, targetUserId, reason } = {}) => {
    if (!callId || !targetUserId) return;
    // Only an explicit decline counts as 'declined'; busy / timeout → 'missed'.
    finalizeCall(io, callId, reason === 'rejected' ? 'declined' : 'ended');
    clearCall(callId);
    toUser(targetUserId).emit(CALL_EVENTS.REJECTED, {
      callId,
      fromUserId: userId,
      reason: reason || 'rejected', // 'rejected' | 'busy' | 'missed'
    });
    logger.info(`[Call] ${callId} rejected by ${socket.user.username}`);
  });

  // ── END — either side hangs up (also covers caller-cancel while ringing) ───
  socket.on(CALL_EVENTS.END, ({ callId, targetUserId, reason } = {}) => {
    if (!callId || !targetUserId) return;
    finalizeCall(io, callId, 'ended'); // answered→answered, else→missed
    clearCall(callId);
    toUser(targetUserId).emit(CALL_EVENTS.ENDED, {
      callId,
      fromUserId: userId,
      reason: reason || 'hangup', // 'hangup' | 'cancelled' | 'failed'
    });
    logger.info(`[Call] ${callId} ended by ${socket.user.username}`);
  });

  // ── SDP / ICE relay — forwarded verbatim, server never inspects them ───────
  socket.on(CALL_EVENTS.OFFER, ({ callId, targetUserId, sdp } = {}) => {
    if (!callId || !targetUserId || !sdp) return;
    toUser(targetUserId).emit(CALL_EVENTS.OFFER, { callId, fromUserId: userId, sdp });
  });

  socket.on(CALL_EVENTS.ANSWER, ({ callId, targetUserId, sdp } = {}) => {
    if (!callId || !targetUserId || !sdp) return;
    toUser(targetUserId).emit(CALL_EVENTS.ANSWER, { callId, fromUserId: userId, sdp });
  });

  socket.on(CALL_EVENTS.ICE_CANDIDATE, ({ callId, targetUserId, candidate } = {}) => {
    if (!callId || !targetUserId || !candidate) return;
    toUser(targetUserId).emit(CALL_EVENTS.ICE_CANDIDATE, { callId, fromUserId: userId, candidate });
  });

  // ── Disconnect — notify peer if user dropped mid-call ──────────────────────
  // Note: fires per-socket. If the user has ANOTHER device still connected the
  // peer is still notified — acceptable for v1 since the WebRTC session lived
  // on the disconnected device anyway.
  socket.on('disconnect', () => {
    const call = activeCalls.get(userId);
    if (!call) return;
    finalizeCall(io, call.callId, 'disconnect'); // answered→answered, else→missed
    clearCall(call.callId);
    toUser(call.peerId).emit(CALL_EVENTS.ENDED, {
      callId:     call.callId,
      fromUserId: userId,
      reason:     'peer_disconnected',
    });
    logger.info(`[Call] ${call.callId} ended — ${socket.user.username} disconnected`);
  });
}

module.exports = { registerCallHandler };
