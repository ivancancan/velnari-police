/** @type {import('next').NextConfig} */
const nextConfig = {
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
