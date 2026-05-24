'use client';

import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setDuration } from '../store/callSlice';
import { selectCallState, selectCallStartedAt } from '../store/callSelectors';
import { CALL_STATE } from '../constants/callConstants';

/**
 * Runs a 1-second interval that updates call.duration in Redux
 * while the call is in CONNECTED state. Self-cleans on disconnect.
 */
export function useCallTimer() {
  const dispatch = useDispatch();
  const callState = useSelector(selectCallState);
  const startedAt = useSelector(selectCallStartedAt);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (callState === CALL_STATE.CONNECTED && startedAt) {
      intervalRef.current = setInterval(() => {
        dispatch(setDuration(Math.floor((Date.now() - startedAt) / 1000)));
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [callState, startedAt, dispatch]);
}
