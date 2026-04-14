// Circular buffer that captures the last N console.log / console.warn /
// console.error calls. Attached to bug reports so operators can send context
// we couldn't otherwise observe (RN doesn't ship a production log viewer).
//
// Usage:
//   import { installLogBuffer, getRecentLogs } from '@/lib/log-buffer';
//   installLogBuffer(); // once at app startup
//
//   // Later, when submitting bug report:
//   const logs = getRecentLogs();

export interface LogEntry {
  t: string; // ISO timestamp
  level: 'log' | 'warn' | 'error';
  msg: string;
}

const CAPACITY = 100;
const buffer: LogEntry[] = [];
let installed = false;

function push(level: LogEntry['level'], args: unknown[]): void {
  try {
    const msg = args
      .map((a) => {
        if (typeof a === 'string') return a;
        try {
          return JSON.stringify(a, null, 0).slice(0, 500);
        } catch {
          return String(a).slice(0, 500);
        }
      })
      .join(' ')
      .slice(0, 1_000);
    buffer.push({ t: new Date().toISOString(), level, msg });
    if (buffer.length > CAPACITY) buffer.shift();
  } catch {
    // Never throw from a console override.
  }
}

export function installLogBuffer(): void {
  if (installed) return;
  installed = true;
  const origLog = console.log.bind(console);
  const origWarn = console.warn.bind(console);
  const origError = console.error.bind(console);
  // eslint-disable-next-line no-console
  console.log = (...args: unknown[]) => {
    push('log', args);
    origLog(...args);
  };
  // eslint-disable-next-line no-console
  console.warn = (...args: unknown[]) => {
    push('warn', args);
    origWarn(...args);
  };
  // eslint-disable-next-line no-console
  console.error = (...args: unknown[]) => {
    push('error', args);
    origError(...args);
  };
}

export function getRecentLogs(): LogEntry[] {
  return buffer.slice();
}

export function clearLogBuffer(): void {
  buffer.length = 0;
}
