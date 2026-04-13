import * as Sentry from '@sentry/nextjs';

// Unified error sink — use this instead of `console.error` in prod code paths.
// In dev: logs to console for easy debugging.
// In prod: forwards to Sentry (if wired) with optional context tag for filtering.
//
// Usage:
//   .catch((err) => reportError(err, { tag: 'command.loadUnits' }))
//   reportError(new Error('...'), { extras: { userId } })

interface ReportErrorOptions {
  /** Short identifier (e.g. "command.loadUnits") — becomes a Sentry tag. */
  tag?: string;
  /** Extra context attached to the Sentry event (avoid PII). */
  extras?: Record<string, unknown>;
}

export function reportError(err: unknown, opts: ReportErrorOptions = {}): void {
  const error = err instanceof Error ? err : new Error(String(err));

  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.error(`[reportError${opts.tag ? `:${opts.tag}` : ''}]`, error, opts.extras);
    return;
  }

  try {
    Sentry.withScope((scope) => {
      if (opts.tag) scope.setTag('area', opts.tag);
      if (opts.extras) {
        for (const [k, v] of Object.entries(opts.extras)) scope.setExtra(k, v);
      }
      Sentry.captureException(error);
    });
  } catch {
    // Sentry not initialized — swallow; we don't want error-reporting to throw.
  }
}
