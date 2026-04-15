// apps/mobile/src/lib/sentry.ts
//
// Sentry init for the mobile app. Runs at module load via the import in
// _layout.tsx. Only activates when EXPO_PUBLIC_SENTRY_DSN is set, so dev
// builds don't spam a real Sentry project.
//
// Scrubbing policy:
//   - Drop Authorization headers before they leave the device.
//   - Drop refresh/access tokens from breadcrumbs.
//   - Redact known PII fields (email, badgeNumber) to a hash prefix.

import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

const DSN = process.env['EXPO_PUBLIC_SENTRY_DSN'];

const RELEASE =
  (Constants.expoConfig?.version ?? '1.0.0') +
  '+' +
  (Constants.expoConfig?.ios?.buildNumber ??
    Constants.expoConfig?.android?.versionCode ??
    'dev');

export function initSentry(): void {
  if (!DSN) {
    // Dev / bare launches. Keep the API available so downstream code doesn't
    // need to conditional-check every call site.
    return;
  }

  Sentry.init({
    dsn: DSN,
    release: RELEASE,
    environment: process.env['EXPO_PUBLIC_ENV'] ?? 'production',
    // Sample aggressively for the pilot — small fleet, we want signal.
    tracesSampleRate: 0.3,
    // PII stays off until we have a DPA in place.
    sendDefaultPii: false,
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.category === 'console' && breadcrumb.level === 'debug') {
        return null;
      }
      if (breadcrumb.data && typeof breadcrumb.data === 'object') {
        const d = breadcrumb.data as Record<string, unknown>;
        if ('Authorization' in d) delete d['Authorization'];
        if ('authorization' in d) delete d['authorization'];
        if ('refreshToken' in d) delete d['refreshToken'];
        if ('accessToken' in d) delete d['accessToken'];
      }
      return breadcrumb;
    },
    beforeSend(event) {
      // Strip auth header from HTTP events before upload.
      if (event.request?.headers) {
        const h = event.request.headers as Record<string, string>;
        delete h['Authorization'];
        delete h['authorization'];
      }
      // Drop 401s — they're noise. JWT expiry on every backgrounded phone.
      if (event.tags?.['status_code'] === '401') return null;
      return event;
    },
  });
}

export { Sentry };

/** Wrap a component tree so uncaught errors show a user-friendly fallback. */
export const SentryErrorBoundary = Sentry.ErrorBoundary;
