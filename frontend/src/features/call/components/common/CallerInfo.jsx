import { RingingAnimation } from './RingingAnimation';
import { CallTimer } from './CallTimer';
import { CALL_STATE } from '../../constants/callConstants';
import { getCallStatusLabel } from '../../utils/callUtils';

/**
 * Displays caller avatar, name, and dynamic status line.
 * Used by both incoming and outgoing screens.
 */
export function CallerInfo({ user, callState, callType }) {
  const isRinging = callState === CALL_STATE.RINGING;
  const isConnected = callState === CALL_STATE.CONNECTED;

  return (
    <div className="flex flex-col items-center text-center gap-2">
      <div className="mb-6">
        <RingingAnimation user={user} isRinging={isRinging} />
      </div>
      <h1 className="text-2xl font-bold">{user?.name}</h1>
      <p className="text-muted-foreground">
        {isConnected ? <CallTimer /> : getCallStatusLabel(callState, callType)}
      </p>
    </div>
  );
}
