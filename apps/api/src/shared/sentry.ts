import * as Sentry from '@sentry/node';

export function initSentry() {
  const dsn = process.env['SENTRY_DSN'];
  if (!dsn || process.env['NODE_ENV'] !== 'production') return;

  Sentry.init({
    dsn,
    environment: process.env['NODE_ENV'],
    release: process.env['GIT_SHA'] ?? 'unknown',

    // Performance monitoring — capture 20% of transactions
    tracesSampleRate: 0.2,

    // Profile 10% of sampled transactions (CPU/memory flamegraphs)
    profilesSampleRate: 0.1,

    // Strip sensitive data before sending to Sentry
    beforeSend(event) {
      // Remove Authorization headers from request breadcrumbs
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
      }
      // Don't send 401/403 as errors — they're expected auth failures
      if (event.tags?.['http.status_code']) {
        const status = Number(event.tags['http.status_code']);
        if (status === 401 || status === 403) return null;
      }
      return event;
    },

    // Ignore noise that isn't actionable
    ignoreErrors: [
      'ThrottlerException',
      'UnauthorizedException',
      'ForbiddenException',
      'NotFoundException',
      'BadRequestException',
    ],

    integrations: [
      // Capture unhandled promise rejections
      Sentry.onUncaughtExceptionIntegration({ exitEvenIfOtherHandlersAreRegistered: false }),
      Sentry.onUnhandledRejectionIntegration({ mode: 'warn' }),
    ],
  });
}

/**
 * Wrap an async route handler to capture unexpected errors in Sentry
 * with request context attached.
 */
export function sentryCapture(error: unknown, context?: Record<string, unknown>): void {
  Sentry.withScope((scope) => {
    if (context) {
      scope.setExtras(context);
    }
    Sentry.captureException(error);
  });
}
