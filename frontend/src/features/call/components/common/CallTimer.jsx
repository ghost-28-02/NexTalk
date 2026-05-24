'use client';

import { useSelector } from 'react-redux';
import { selectCallDuration } from '../../store/callSelectors';
import { formatDuration } from '../../utils/callUtils';

/** Live call duration counter driven by Redux state. */
export function CallTimer({ className }) {
  const duration = useSelector(selectCallDuration);
  return <span className={className}>{formatDuration(duration)}</span>;
}
