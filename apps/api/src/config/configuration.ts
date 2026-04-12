const isProd = process.env['NODE_ENV'] === 'production';

function requireInProd(name: string, fallback: string): string {
  const val = process.env[name];
  if (val) return val;
  if (isProd) throw new Error(`Missing required env var: ${name}`);
  return fallback;
}

/**
 * Validates that all production-required environment variables are present.
 * Runs at module load time so the process crashes immediately with a clear
 * list of missing vars rather than silently falling back to dev defaults.
 */
export function validateEnv(): void {
  if (!isProd) return;

  const required = [
    'DB_HOST', 'DB_USER', 'DB_PASS', 'DB_NAME',
    'REDIS_HOST',
    'JWT_SECRET', 'JWT_REFRESH_SECRET',
    'ALLOWED_ORIGINS',
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `[STARTUP] Missing required production environment variables:\n` +
      missing.map((k) => `  ❌  ${k}`).join('\n') +
      `\n\nSet these in your deployment platform (Railway / ECS / Vercel) before starting.`,
    );
  }

  // Sanity check: ALLOWED_ORIGINS must not contain localhost in production
  const origins = process.env['ALLOWED_ORIGINS'] ?? '';
  if (origins.includes('localhost') || origins.includes('127.0.0.1')) {
    throw new Error(
      `[STARTUP] ALLOWED_ORIGINS contains a localhost entry in production: "${origins}"\n` +
      `Set it to your real frontend domain, e.g. https://app.velnari.mx`,
    );
  }
}

export default () => ({
  port: parseInt(process.env['PORT'] ?? '3001', 10),
  nodeEnv: process.env['NODE_ENV'] ?? 'development',
  allowedOrigins: (process.env['ALLOWED_ORIGINS'] ?? 'http://localhost:3000').split(','),
  database: {
    host: process.env['DB_HOST'] ?? 'localhost',
    port: parseInt(process.env['DB_PORT'] ?? '5432', 10),
    username: requireInProd('DB_USER', 'velnari'),
    password: requireInProd('DB_PASS', 'velnari_dev'),
    database: requireInProd('DB_NAME', 'velnari_dev'),
  },
  redis: {
    host: process.env['REDIS_HOST'] ?? 'localhost',
    port: parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
  },
  jwt: {
    secret: requireInProd('JWT_SECRET', 'dev_secret_change_in_prod'),
    expiresIn: process.env['JWT_EXPIRES_IN'] ?? '15m',
    refreshSecret: requireInProd('JWT_REFRESH_SECRET', 'dev_refresh_secret'),
    refreshExpiresIn: process.env['JWT_REFRESH_EXPIRES_IN'] ?? '7d',
  },
});
