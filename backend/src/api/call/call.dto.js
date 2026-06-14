/**
 * CallLog DTO — shapes a call record for the API, RELATIVE to the viewer.
 *
 * The same stored document looks different to each participant:
 *   - direction: 'outgoing' if the viewer placed the call, else 'incoming'
 *   - peer:      always the OTHER participant (who the viewer called / was called by)
 *
 * `viewerId` must be the requesting user's id so direction/peer resolve correctly.
 */

function pickAvatar(user) {
  return (
    user?.avatar?.url ??
    (typeof user?.avatar === 'string' ? user.avatar : null) ??
    null
  );
}

function toUserSummary(user) {
  if (!user?._id) return null;
  return {
    id:       user._id,
    username: user.username,
    name:     user.displayName || user.username,
    avatar:   pickAvatar(user),
  };
}

function toCallLogDTO(log, viewerId) {
  const viewer    = viewerId?.toString();
  const callerId  = (log.caller?._id ?? log.caller)?.toString();
  const isOutgoing = callerId === viewer;

  // The "other" participant from the viewer's perspective.
  const peerDoc = isOutgoing ? log.callee : log.caller;

  return {
    id:         log._id,
    callId:     log.callId,
    direction:  isOutgoing ? 'outgoing' : 'incoming',
    type:       log.callType,          // 'audio' | 'video'
    status:     log.status,            // 'answered' | 'missed' | 'declined'
    peer:       toUserSummary(peerDoc),
    chatId:     log.chatId ? log.chatId.toString() : null,
    startedAt:  log.startedAt,
    answeredAt: log.answeredAt || null,
    endedAt:    log.endedAt || null,
    duration:   log.duration || 0,     // seconds (0 unless answered)
    createdAt:  log.createdAt,
  };
}

module.exports = { toCallLogDTO };
