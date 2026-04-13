// Centralized timezone formatting. Velnari operates in Mexican municipalities,
// so dates/times MUST render in the municipality's local zone regardless of
// the operator's browser locale or where the server clock runs.
//
// Default zone is Mexico City; override via NEXT_PUBLIC_TIMEZONE at build/runtime
// for deployments in other tenants (e.g. Quintana Roo runs on America/Cancun).
//
// Usage:
//   import { formatDate, formatTime, formatDateTime } from '@/lib/timezone';
//   formatDateTime(incident.createdAt)   // "13 abr 2026, 14:22"
//   formatTime(incident.createdAt)       // "14:22"
//   formatDate('2026-04-13T...')         // "13/04/2026"

const LOCALE = 'es-MX';
const TZ = process.env['NEXT_PUBLIC_TIMEZONE'] ?? 'America/Mexico_City';

function toDate(input: string | Date): Date {
  return input instanceof Date ? input : new Date(input);
}

export function formatDate(input: string | Date): string {
  return toDate(input).toLocaleDateString(LOCALE, {
    timeZone: TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatTime(input: string | Date): string {
  return toDate(input).toLocaleTimeString(LOCALE, {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatDateTime(input: string | Date): string {
  return toDate(input).toLocaleString(LOCALE, {
    timeZone: TZ,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** Relative time for timelines — "hace 5 min", "hace 2 h". */
export function formatRelative(input: string | Date): string {
  const date = toDate(input);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'ahora';
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `hace ${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `hace ${diffD} d`;
  return formatDate(date);
}
