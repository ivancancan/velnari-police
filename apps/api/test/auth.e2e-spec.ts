/**
 * Auth E2E Tests
 *
 * PREREQUISITES: Docker must be running with `docker compose up -d` from monorepo root.
 * These tests connect to the real PostgreSQL database.
 *
 * Run with: pnpm test:e2e (from apps/api directory)
 */
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { UserEntity } from '../src/entities/user.entity';
import { UserRole } from '@velnari/shared-types';

describe('Auth E2E (requires Docker + DB)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  const testUser = {
    email: 'e2e_operador@velnari.test',
    password: 'Test1234!',
    role: UserRole.OPERATOR,
    name: 'E2E Operador',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    dataSource = moduleFixture.get(DataSource);

    // Create test user
    const hashedPassword = await bcrypt.hash(testUser.password, 10);
    await dataSource.getRepository(UserEntity).save({
      email: testUser.email,
      passwordHash: hashedPassword,
      role: testUser.role,
      name: testUser.name,
    });
  });

  afterAll(async () => {
    // Clean up test user
    await dataSource.getRepository(UserEntity).delete({ email: testUser.email });
    await app.close();
  });

  describe('POST /api/auth/login', () => {
    it('retorna tokens con credenciales validas', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: testUser.email, password: testUser.password })
        .expect(200);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body.expiresIn).toBe(900);
      expect(typeof res.body.accessToken).toBe('string');
      expect(res.body.accessToken.length).toBeGreaterThan(50);
    });

    it('retorna 401 con credenciales incorrectas', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: testUser.email, password: 'wrong_password' })
        .expect(401);
    });

    it('retorna 401 con usuario inexistente', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'noexiste@velnari.test', password: 'Test1234!' })
        .expect(401);
    });

    it('retorna 400 con email invalido', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'no-es-email', password: 'Test1234!' })
        .expect(400);
    });

    it('retorna 400 con password demasiado corta', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: testUser.email, password: 'short' })
        .expect(400);
    });
  });

  describe('GET /api/auth/me', () => {
    let accessToken: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: testUser.email, password: testUser.password });
      accessToken = res.body.accessToken as string;
    });

    it('retorna perfil del usuario autenticado', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.email).toBe(testUser.email);
      expect(res.body.role).toBe(testUser.role);
      expect(res.body).not.toHaveProperty('passwordHash');
    });

    it('retorna 401 sin token', async () => {
      await request(app.getHttpServer()).get('/api/auth/me').expect(401);
    });

    it('retorna 401 con token invalido', async () => {
      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid.token.here')
        .expect(401);
    });
  });
});
