const presenceAdapter = require('../adapters/memory.adapter');
// FUTURE [Redis]: swap import above — handler code unchanged
const { CALL_EVENTS } = require('../../shared/constants/events');
const { logger } = require('../../shared/utils/logger');

/**
 * WebRTC call signaling handler.
 *
 * Architecture: pure signaling relay — no media passes through the server.
 * The server relays SDP offers/answers and ICE candidates between peers.
 * WebRTC handles direct peer-to-peer media once the connection is established.
 *
 * Call room naming: `call:{callId}` — both participants join this room.
 *
 * Event flow:
 *   Caller emits INITIATE → server delivers INCOMING to callee
 *   Callee emits ACCEPT   → server delivers ACCEPTED to caller
 *   Callee emits DECLINE  → server delivers DECLINED to caller
 *   Either emits END      → server delivers ENDED to room partner
 *   Either emits ICE_CANDIDATE / SDP_OFFER / SDP_ANSWER → relayed to room
 *   Either emits NOTIFY_MUTED / NOTIFY_VIDEO_OFF → relayed as REMOTE_* to room
 *
 * FUTURE [Redis]: Socket.IO's Redis adapter ensures room broadcasts reach the
 * correct socket regardless of which instance the target user is on.
 * No handler code changes required.
 *
 * FUTURE: Persist call records to DB via call.service.js for history/billing.
 */
function registerCallHandler(io, socket) {
  const userId = socket.user._id.toString();

  // ── Initiate ───────────────────────────────────────────────────────────────
  // Caller starts the call — server delivers INCOMING to all callee sockets.
  // Uses personal rooms (`user:{userId}`) for targeted delivery.

  socket.on(CALL_EVENTS.INITIATE, ({ callId, targetUserId, callType, sdpOffer }) => {
    // Check if target is online via presence adapter
    const targetOnline = presenceAdapter.isUserOnline(targetUserId);
    if (!targetOnline) {
      return socket.emit(CALL_EVENTS.ENDED, { callId, reason: 'USER_OFFLINE' });
    }

    socket.join(`call:${callId}`);

    // Deliver to target's personal room (covers all their devices)
    io.to(`user:${targetUserId}`).emit(CALL_EVENTS.INCOMING, {
      callId,
      callerId: userId,
      callerName: socket.user.displayName || socket.user.username,
      callerAvatar: socket.user.avatar,
      callType,
      sdpOffer,
    });

    logger.debug(
      `[Call] ${socket.user.username} initiating ${callType} call ${callId} → ${targetUserId}`
    );
  });

  // ── Accept ─────────────────────────────────────────────────────────────────
  // Callee accepts — join the call room, notify caller with ACCEPTED.

  socket.on(CALL_EVENTS.ACCEPT, ({ callId, sdpAnswer }) => {
    socket.join(`call:${callId}`);
    socket.to(`call:${callId}`).emit(CALL_EVENTS.ACCEPTED, { callId, sdpAnswer });
    logger.debug(`[Call] ${socket.user.username} accepted call ${callId}`);
  });

  // ── Decline ────────────────────────────────────────────────────────────────

  socket.on(CALL_EVENTS.DECLINE, ({ callId }) => {
    socket.to(`call:${callId}`).emit(CALL_EVENTS.DECLINED, { callId, userId });
    socket.leave(`call:${callId}`);
    logger.debug(`[Call] ${socket.user.username} declined call ${callId}`);
  });

  // ── End ────────────────────────────────────────────────────────────────────

  socket.on(CALL_EVENTS.END, ({ callId }) => {
    socket.to(`call:${callId}`).emit(CALL_EVENTS.ENDED, { callId, endedBy: userId });
    socket.leave(`call:${callId}`);
    logger.debug(`[Call] ${socket.user.username} ended call ${callId}`);
  });

  // ── ICE candidate relay ────────────────────────────────────────────────────

  socket.on(CALL_EVENTS.ICE_CANDIDATE, ({ callId, candidate }) => {
    socket.to(`call:${callId}`).emit(CALL_EVENTS.ICE_CANDIDATE, { callId, candidate });
  });

  // ── SDP renegotiation (e.g. screen share toggle) ──────────────────────────

  socket.on(CALL_EVENTS.SDP_OFFER, ({ callId, sdpOffer }) => {
    socket.to(`call:${callId}`).emit(CALL_EVENTS.SDP_OFFER, { callId, sdpOffer });
  });

  socket.on(CALL_EVENTS.SDP_ANSWER, ({ callId, sdpAnswer }) => {
    socket.to(`call:${callId}`).emit(CALL_EVENTS.SDP_ANSWER, { callId, sdpAnswer });
  });

  // ── Media state relay ──────────────────────────────────────────────────────
  // Notify the remote peer when local user toggles mute or camera.
  // The "NOTIFY_*" events from the sender become "REMOTE_*" events for the receiver.

  socket.on(CALL_EVENTS.NOTIFY_MUTED, ({ callId, muted }) => {
    socket.to(`call:${callId}`).emit(CALL_EVENTS.REMOTE_MUTED, { callId, muted });
  });

  socket.on(CALL_EVENTS.NOTIFY_VIDEO_OFF, ({ callId, videoOff }) => {
    socket.to(`call:${callId}`).emit(CALL_EVENTS.REMOTE_VIDEO_OFF, { callId, videoOff });
  });

  // ── Reconnect signal ───────────────────────────────────────────────────────

  socket.on(CALL_EVENTS.RECONNECT, ({ callId }) => {
    socket.to(`call:${callId}`).emit(CALL_EVENTS.RECONNECT, { callId, userId });
  });
}

module.exports = { registerCallHandler };
