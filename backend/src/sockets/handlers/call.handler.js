const presenceAdapter = require('../adapters/memory.adapter');
// FUTURE [Redis]: swap above import for redis.adapter.js — no changes below needed
const { CALL_EVENTS } = require('../../shared/constants/events');
const { logger } = require('../../shared/utils/logger');

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

const CALL_STATES = Object.freeze({ RINGING: 'ringing', ACTIVE: 'active' });

function clearCall(callId) {
  for (const [uid, call] of activeCalls.entries()) {
    if (call.callId === callId) activeCalls.delete(uid);
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

    toUser(targetUserId).emit(CALL_EVENTS.ACCEPTED, { callId, fromUserId: userId });
    logger.info(`[Call] ${callId} accepted by ${socket.user.username}`);
  });

  // ── REJECT — callee declines ────────────────────────────────────────────────
  socket.on(CALL_EVENTS.REJECT, ({ callId, targetUserId, reason } = {}) => {
    if (!callId || !targetUserId) return;
    clearCall(callId);
    toUser(targetUserId).emit(CALL_EVENTS.REJECTED, {
      callId,
      fromUserId: userId,
      reason: reason || 'rejected', // 'rejected' | 'busy'
    });
    logger.info(`[Call] ${callId} rejected by ${socket.user.username}`);
  });

  // ── END — either side hangs up (also covers caller-cancel while ringing) ───
  socket.on(CALL_EVENTS.END, ({ callId, targetUserId, reason } = {}) => {
    if (!callId || !targetUserId) return;
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
