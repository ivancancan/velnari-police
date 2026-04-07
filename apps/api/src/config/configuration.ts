export default () => ({
  port: parseInt(process.env['PORT'] ?? '3001', 10),
  nodeEnv: process.env['NODE_ENV'] ?? 'development',
  database: {
    host: process.env['DB_HOST'] ?? 'localhost',
    port: parseInt(process.env['DB_PORT'] ?? '5432', 10),
    username: process.env['DB_USER'] ?? 'velnari',
    password: process.env['DB_PASS'] ?? 'velnari_dev',
    database: process.env['DB_NAME'] ?? 'velnari_dev',
  },
  redis: {
    host: process.env['REDIS_HOST'] ?? 'localhost',
    port: parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
  },
  jwt: {
    secret: process.env['JWT_SECRET'] ?? 'dev_secret_change_in_prod',
    expiresIn: process.env['JWT_EXPIRES_IN'] ?? '15m',
    refreshSecret: process.env['JWT_REFRESH_SECRET'] ?? 'dev_refresh_secret',
    refreshExpiresIn: process.env['JWT_REFRESH_EXPIRES_IN'] ?? '7d',
  },
});
