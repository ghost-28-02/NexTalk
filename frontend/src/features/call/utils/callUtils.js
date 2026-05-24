export function formatDuration(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function generateCallId() {
  return `call_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function isTerminalCallState(callState) {
  return ['idle', 'ended', 'missed', 'declined', 'failed'].includes(callState);
}

export function getCallStatusLabel(callState, callType) {
  switch (callState) {
    case 'ringing':
      return callType === 'video' ? 'Incoming video call...' : 'Incoming audio call...';
    case 'outgoing':
      return 'Calling...';
    case 'connecting':
      return 'Connecting...';
    case 'reconnecting':
      return 'Reconnecting...';
    default:
      return '';
  }
}
