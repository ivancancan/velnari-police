import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { join } from 'path';

dotenv.config({ path: join(__dirname, '../../.env') });

const databaseUrl = process.env['DATABASE_URL'];

export const AppDataSource = new DataSource({
  type: 'postgres',
  ...(databaseUrl
    ? {
        url: databaseUrl,
        ...(process.env['DB_SSL'] !== 'false'
          ? { ssl: { rejectUnauthorized: false } }
          : {}),
      }
    : {
        host: process.env['DB_HOST'] ?? 'localhost',
        port: parseInt(process.env['DB_PORT'] ?? '5432', 10),
        username: process.env['DB_USER'] ?? 'velnari',
        password: process.env['DB_PASS'] ?? 'velnari_dev',
        database: process.env['DB_NAME'] ?? 'velnari_dev',
      }),
  entities: [join(__dirname, '../**/*.entity{.ts,.js}')],
  migrations: [join(__dirname, './migrations/*{.ts,.js}')],
  synchronize: false,
  connectTimeoutMS: 5_000,
  maxQueryExecutionTime: 10_000,
  extra: {
    max: 20,
    min: 2,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  },
});
