// Validate required env vars at build time (server-side) and at runtime
const REQUIRED_SERVER_ENV = [];
const REQUIRED_PUBLIC_ENV = ['NEXT_PUBLIC_API_URL', 'NEXT_PUBLIC_WS_URL'];

if (process.env.NODE_ENV === 'production') {
  const missing = REQUIRED_PUBLIC_ENV.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(
      `[next.config] Missing required public env vars for production build:\n` +
      missing.map((k) => `  ❌  ${k}`).join('\n') +
      `\n\nSet these in your deployment platform before building.`,
    );
  }
}

// Compose CSP from allowed endpoints. Mapbox needs specific hosts; API + WS need the Railway origin.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? '';
const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN ?? '';

const apiOrigin = (() => { try { return new URL(API_URL).origin; } catch { return ''; } })();
const wsOrigin = (() => {
  try {
    const u = new URL(WS_URL);
    return `${u.protocol === 'https:' ? 'wss:' : 'ws:'}//${u.host}`;
  } catch { return ''; }
})();
const sentryOrigin = (() => { try { return new URL(SENTRY_DSN).origin; } catch { return ''; } })();

// Allowlist the tile + style providers Velnari actually uses. MapLibre pulls
// basemap styles from Carto (`basemaps.cartocdn.com`) and raster/vector tiles
// from various CDN subdomains. We also keep Mapbox hosts whitelisted in case
// we fall back to Mapbox tiles or use Mapbox-hosted glyphs.
const MAP_HOSTS = [
  'https://*.cartocdn.com',
  'https://*.basemaps.cartocdn.com',
  'https://basemaps.cartocdn.com',
  'https://api.mapbox.com',
  'https://events.mapbox.com',
  'https://*.tiles.mapbox.com',
  'https://*.mapbox.com',
  'https://*.tile.openstreetmap.org',
  'https://api.maptiler.com',
].join(' ');

const cspDirectives = [
  `default-src 'self'`,
  // Next.js inline scripts + maps; no eval outside dev.
  `script-src 'self' 'unsafe-inline' ${process.env.NODE_ENV !== 'production' ? "'unsafe-eval'" : ''} ${MAP_HOSTS}`,
  `style-src 'self' 'unsafe-inline' ${MAP_HOSTS}`,
  `img-src 'self' data: blob: ${MAP_HOSTS} https://*.amazonaws.com`,
  `font-src 'self' data: ${MAP_HOSTS}`,
  `connect-src 'self' ${apiOrigin} ${wsOrigin} ${sentryOrigin} ${MAP_HOSTS}`,
  `worker-src 'self' blob:`,
  `frame-ancestors 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: cspDirectives },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@velnari/shared-types'],
  experimental: {
    instrumentationHook: true,
  },
  async headers() {
    return [
      {
        // Apply to all routes
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
  webpack: (config, { isServer }) => {
    // Ensure reflect-metadata is available before shared-types decorators run
    if (isServer) {
      const original = config.entry;
      config.entry = async () => {
        const entries = await (typeof original === 'function' ? original() : original);
        if (entries['main-app'] && !entries['main-app'].includes('reflect-metadata')) {
          entries['main-app'].unshift('reflect-metadata');
        }
        return entries;
      };
    }
    return config;
  },
};

export default nextConfig;
