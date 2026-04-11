const isProd = process.env['NODE_ENV'] === 'production';

function requireInProd(name: string, fallback: string): string {
  const val = process.env[name];
  if (val) return val;
  if (isProd) throw new Error(`Missing required env var: ${name}`);
  return fallback;
}

export default () => ({
  port: parseInt(process.env['PORT'] ?? '3001', 10),
  nodeEnv: process.env['NODE_ENV'] ?? 'development',
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
