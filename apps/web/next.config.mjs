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

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@velnari/shared-types'],
  experimental: {
    instrumentationHook: true,
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
