'use client';

import { useEffect, useState } from 'react';

// SLA targets (minutes from creation to first assignment). Operators see a
// live ticker per incident so "stuck in queue" cases are visually obvious
// before they breach. Tuned for municipal ops — override via props if needed.
const SLA_TARGETS_MIN: Record<string, number> = {
  critical: 3,
  high: 5,
  medium: 15,
  low: 30,
};

interface Props {
  priority: string;
  createdAt: string;
  /** If assigned, the ticker freezes at the assignment time and shows "✓". */
  assignedAt?: string | null;
  /** If closed, render nothing — nothing to count down. */
  status: string;
  size?: 'sm' | 'md';
}

type State = 'ok' | 'warning' | 'breach' | 'complete';

function classify(elapsedMin: number, targetMin: number): State {
  if (elapsedMin >= targetMin) return 'breach';
  if (elapsedMin >= targetMin * 0.6) return 'warning';
  return 'ok';
}

const STATE_STYLES: Record<State, { color: string; label: string; animate: string }> = {
  ok: { color: 'text-green-400', label: '', animate: '' },
  warning: { color: 'text-amber-400', label: '⚠', animate: '' },
  breach: { color: 'text-red-400', label: '🚨', animate: 'animate-pulse' },
  complete: { color: 'text-tactical-blue', label: '✓', animate: '' },
};

export default function SlaCountdown({
  priority,
  createdAt,
  assignedAt,
  status,
  size = 'sm',
}: Props): JSX.Element | null {
  const target = SLA_TARGETS_MIN[priority] ?? 30;

  // Closed incidents don't need a ticker.
  if (status === 'closed') return null;

  const isAssigned = !!assignedAt;
  // Re-render every 15s for the countdown (cheap — only visible rows).
  const [, setTick] = useState(0);
  useEffect(() => {
    if (isAssigned) return;
    const id = setInterval(() => setTick((n) => n + 1), 15_000);
    return () => clearInterval(id);
  }, [isAssigned]);

  const created = new Date(createdAt).getTime();
  const reference = isAssigned ? new Date(assignedAt!).getTime() : Date.now();
  const elapsedMin = Math.max(0, (reference - created) / 60_000);
  const state: State = isAssigned ? 'complete' : classify(elapsedMin, target);
  const styles = STATE_STYLES[state];

  const remaining = target - elapsedMin;
  const text = isAssigned
    ? `Asignada en ${Math.round(elapsedMin)} min`
    : state === 'breach'
    ? `SLA excedido · +${Math.round(elapsedMin - target)} min`
    : `${Math.ceil(remaining)} min para asignar`;

  const textSize = size === 'md' ? 'text-xs' : 'text-[10px]';

  return (
    <span
      className={`inline-flex items-center gap-1 font-mono ${textSize} ${styles.color} ${styles.animate}`}
      aria-live="polite"
      aria-label={`SLA: ${text}`}
      title={`Target ${target} min para prioridad ${priority}`}
    >
      {styles.label && <span aria-hidden="true">{styles.label}</span>}
      {text}
    </span>
  );
}
