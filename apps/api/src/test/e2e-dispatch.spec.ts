/**
 * Dispatch E2E Tests — Full lifecycle
 *
 * PREREQUISITES:
 *   - Docker must be running with `docker compose up -d` from monorepo root
 *   - Database seeded with `pnpm --filter api db:seed`
 *   - These tests connect to the REAL PostgreSQL + Redis instances
 *
 * Run with: cd apps/api && pnpm test:e2e
 *
 * Covers:
 *   1. Auth (login, bad credentials, me)
 *   2. Units (list, status update, location update, stats, nearby)
 *   3. Incidents (create, get, stats, notes, events/timeline, close)
 *   4. Dispatch (assign unit, suggestion engine)
 *   5. RBAC (field_unit cannot create users)
 *   6. Public report (no auth required)
 *   7. Health check
 */
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { UserEntity } from '../entities/user.entity';
import { UnitEntity } from '../entities/unit.entity';
import { SectorEntity } from '../entities/sector.entity';
import { UserRole, UnitStatus, IncidentStatus } from '@velnari/shared-types';

describe('Dispatch E2E Flow (requires Docker + DB)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  // Tokens
  let adminToken: string;
  let operatorToken: string;
  let fieldUnitToken: string;

  // IDs created during test
  let testSectorId: string;
  let testUnitId: string;
  let testUnit2Id: string;
  let testIncidentId: string;

  // Test user credentials
  const TEST_PREFIX = 'e2e_dispatch_';
  const PASSWORD = 'TestPass1234!';

  const testUsers = {
    admin: { email: `${TEST_PREFIX}admin@velnari.test`, role: UserRole.ADMIN, name: 'E2E Admin' },
    operator: { email: `${TEST_PREFIX}operator@velnari.test`, role: UserRole.OPERATOR, name: 'E2E Operator' },
    fieldUnit: { email: `${TEST_PREFIX}field@velnari.test`, role: UserRole.FIELD_UNIT, name: 'E2E Field Unit' },
  };

  // ─── Setup & Teardown ──────────────────────────────────────────────────────

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

    // Seed test data directly in the database
    const hashedPassword = await bcrypt.hash(PASSWORD, 10);

    // Create sector for test units
    const sectorResult = await dataSource.getRepository(SectorEntity).save({
      name: `${TEST_PREFIX}Sector`,
      color: '#FF0000',
      isActive: true,
    });
    testSectorId = sectorResult.id;

    // Create test users
    for (const u of Object.values(testUsers)) {
      await dataSource.getRepository(UserEntity).save({
        email: u.email,
        passwordHash: hashedPassword,
        role: u.role,
        name: u.name,
        sectorId: testSectorId,
        isActive: true,
      });
    }

    // Create two test units (with GPS location for nearby/suggestions)
    const unitRepo = dataSource.getRepository(UnitEntity);
    const unit1 = await unitRepo.save({
      callSign: `${TEST_PREFIX}U-01`,
      status: UnitStatus.AVAILABLE,
      sectorId: testSectorId,
      shift: 'Matutino',
      isActive: true,
    });
    testUnitId = unit1.id;

    // Set GPS location via raw query (PostGIS)
    await dataSource.query(
      `UPDATE units SET current_location = ST_SetSRID(ST_MakePoint($1, $2), 4326), lat = $2, lng = $1 WHERE id = $3`,
      [-99.1332, 19.4326, testUnitId],
    );

    const unit2 = await unitRepo.save({
      callSign: `${TEST_PREFIX}U-02`,
      status: UnitStatus.AVAILABLE,
      sectorId: testSectorId,
      shift: 'Matutino',
      isActive: true,
    });
    testUnit2Id = unit2.id;

    await dataSource.query(
      `UPDATE units SET current_location = ST_SetSRID(ST_MakePoint($1, $2), 4326), lat = $2, lng = $1 WHERE id = $3`,
      [-99.1400, 19.4350, testUnit2Id],
    );
  }, 30_000);

  afterAll(async () => {
    // Clean up all test data (order matters due to FK constraints)
    await dataSource.query(
      `DELETE FROM incident_events WHERE incident_id IN (SELECT id FROM incidents WHERE description LIKE 'E2E%')`,
    );
    await dataSource.query(
      `DELETE FROM incident_unit_assignments WHERE incident_id IN (SELECT id FROM incidents WHERE description LIKE 'E2E%')`,
    );
    await dataSource.query(`DELETE FROM incidents WHERE description LIKE 'E2E%'`);
    await dataSource.query(`DELETE FROM unit_location_history WHERE unit_id IN ($1, $2)`, [testUnitId, testUnit2Id]);
    await dataSource.query(`DELETE FROM units WHERE call_sign LIKE '${TEST_PREFIX}%'`);
    await dataSource.query(`DELETE FROM users WHERE email LIKE '${TEST_PREFIX}%'`);
    await dataSource.query(`DELETE FROM sectors WHERE name = '${TEST_PREFIX}Sector'`);

    await app.close();
  }, 15_000);

  // ─── 1. Authentication ─────────────────────────────────────────────────────

  describe('Authentication', () => {
    it('should login as admin and return tokens', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: testUsers.admin.email, password: PASSWORD })
        .expect(200);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body.expiresIn).toBe(900);
      expect(typeof res.body.accessToken).toBe('string');
      expect(res.body.accessToken.length).toBeGreaterThan(50);

      adminToken = res.body.accessToken;
    });

    it('should login as operator', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: testUsers.operator.email, password: PASSWORD })
        .expect(200);

      expect(res.body.accessToken).toBeDefined();
      operatorToken = res.body.accessToken;
    });

    it('should login as field_unit', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: testUsers.fieldUnit.email, password: PASSWORD })
        .expect(200);

      expect(res.body.accessToken).toBeDefined();
      fieldUnitToken = res.body.accessToken;
    });

    it('should reject wrong password with 401', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: testUsers.admin.email, password: 'wrongPassword123!' })
        .expect(401);
    });

    it('should reject non-existent user with 401', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'noexiste@velnari.test', password: PASSWORD })
        .expect(401);
    });

    it('should reject invalid email format with 400', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'not-an-email', password: PASSWORD })
        .expect(400);
    });

    it('should return user profile with GET /auth/me', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.email).toBe(testUsers.admin.email);
      expect(res.body.role).toBe(UserRole.ADMIN);
      expect(res.body).not.toHaveProperty('passwordHash');
    });

    it('should reject unauthenticated request to /auth/me', async () => {
      await request(app.getHttpServer())
        .get('/api/auth/me')
        .expect(401);
    });

    it('should refresh tokens', async () => {
      // First get a refresh token
      const loginRes = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: testUsers.admin.email, password: PASSWORD })
        .expect(200);

      const res = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken: loginRes.body.refreshToken })
        .expect(200);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body.expiresIn).toBe(900);
    });
  });

  // ─── 2. Units ──────────────────────────────────────────────────────────────

  describe('Units', () => {
    it('should list all units', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/units')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2);

      // Verify our test units are present
      const testUnit = res.body.find((u: any) => u.id === testUnitId);
      expect(testUnit).toBeDefined();
      expect(testUnit.callSign).toBe(`${TEST_PREFIX}U-01`);
    });

    it('should filter units by status', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/units?status=available')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      for (const unit of res.body) {
        expect(unit.status).toBe('available');
      }
    });

    it('should get a single unit by id', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/units/${testUnitId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.id).toBe(testUnitId);
      expect(res.body.callSign).toBe(`${TEST_PREFIX}U-01`);
    });

    it('should get unit stats', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/units/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('available');
      expect(typeof res.body.total).toBe('number');
      expect(res.body.total).toBeGreaterThanOrEqual(2);
    });

    it('should update unit status', async () => {
      // Set to out_of_service, then back to available
      await request(app.getHttpServer())
        .patch(`/api/units/${testUnitId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'out_of_service' })
        .expect(200);

      const checkRes = await request(app.getHttpServer())
        .get(`/api/units/${testUnitId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(checkRes.body.status).toBe('out_of_service');

      // Restore to available for subsequent tests
      await request(app.getHttpServer())
        .patch(`/api/units/${testUnitId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'available' })
        .expect(200);
    });

    it('should update unit GPS location', async () => {
      await request(app.getHttpServer())
        .patch(`/api/units/${testUnitId}/location`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ lat: 19.4330, lng: -99.1340 })
        .expect(204);
    });

    it('should find nearby available units', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/units/nearby?lat=19.4326&lng=-99.1332&radiusKm=10')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should reject unauthenticated request to units', async () => {
      await request(app.getHttpServer())
        .get('/api/units')
        .expect(401);
    });
  });

  // ─── 3. Incident Creation ─────────────────────────────────────────────────

  describe('Incident Creation', () => {
    it('should create an incident', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/incidents')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          type: 'robbery',
          priority: 'high',
          lat: 19.4326,
          lng: -99.1332,
          description: 'E2E test incident for dispatch flow',
          address: 'Av. Reforma 123, Centro',
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('folio');
      expect(res.body.folio).toMatch(/^IC-\d{3,}$/);
      expect(res.body.status).toBe('open');
      expect(res.body.type).toBe('robbery');
      expect(res.body.priority).toBe('high');

      testIncidentId = res.body.id;
    });

    it('should reject incident creation with invalid type', async () => {
      await request(app.getHttpServer())
        .post('/api/incidents')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          type: 'invalid_type',
          priority: 'high',
          lat: 19.4326,
          lng: -99.1332,
        })
        .expect(400);
    });

    it('should reject incident creation with missing required fields', async () => {
      await request(app.getHttpServer())
        .post('/api/incidents')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ type: 'robbery' })
        .expect(400);
    });

    it('should reject incident creation with out-of-range coordinates', async () => {
      await request(app.getHttpServer())
        .post('/api/incidents')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          type: 'robbery',
          priority: 'high',
          lat: 999,
          lng: -99.1332,
        })
        .expect(400);
    });

    it('operator should also be able to create incidents', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/incidents')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          type: 'traffic',
          priority: 'medium',
          lat: 19.4350,
          lng: -99.1400,
          description: 'E2E operator-created incident',
          address: 'Eje Central 200',
        })
        .expect(201);

      expect(res.body.status).toBe('open');
    });
  });

  // ─── 4. Incident Retrieval ─────────────────────────────────────────────────

  describe('Incident Retrieval', () => {
    it('should get incident by id', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/incidents/${testIncidentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.id).toBe(testIncidentId);
      expect(res.body.status).toBe('open');
      expect(res.body.description).toBe('E2E test incident for dispatch flow');
    });

    it('should list incidents', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/incidents')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it('should filter incidents by status', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/incidents?status=open')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      for (const incident of res.body) {
        expect(incident.status).toBe('open');
      }
    });

    it('should get incident stats', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/incidents/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('open');
      expect(res.body).toHaveProperty('assigned');
      expect(res.body).toHaveProperty('closed');
      expect(res.body).toHaveProperty('byPriority');
      expect(res.body).toHaveProperty('byType');
      expect(res.body.total).toBeGreaterThanOrEqual(1);
    });

    it('should return 404 for non-existent incident', async () => {
      await request(app.getHttpServer())
        .get('/api/incidents/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('should return 400 for invalid UUID', async () => {
      await request(app.getHttpServer())
        .get('/api/incidents/not-a-uuid')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });
  });

  // ─── 5. Dispatch — Unit Suggestions ────────────────────────────────────────

  describe('Dispatch — Suggestions', () => {
    it('should suggest nearby units for an incident', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/incidents/${testIncidentId}/suggestions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      // We have 2 test units with GPS, both available — should appear
      if (res.body.length > 0) {
        expect(res.body[0]).toHaveProperty('unitId');
        expect(res.body[0]).toHaveProperty('callSign');
        expect(res.body[0]).toHaveProperty('distanceKm');
        expect(res.body[0]).toHaveProperty('score');
        expect(typeof res.body[0].distanceKm).toBe('number');
      }
    });
  });

  // ─── 6. Dispatch — Assignment Flow ─────────────────────────────────────────

  describe('Dispatch — Assignment', () => {
    it('should assign a unit to the incident', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/incidents/${testIncidentId}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ unitId: testUnitId })
        .expect(201);

      expect(res.body.status).toBe(IncidentStatus.ASSIGNED);
      expect(res.body.assignedUnitId).toBe(testUnitId);
      expect(res.body.assignedAt).toBeDefined();
    });

    it('assigned unit should now be en_route', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/units/${testUnitId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.status).toBe(UnitStatus.EN_ROUTE);
    });

    it('should reject assigning an unavailable unit', async () => {
      // testUnitId is now en_route, so it should fail
      const res = await request(app.getHttpServer())
        .post(`/api/incidents/${testIncidentId}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ unitId: testUnitId })
        .expect(400);

      expect(res.body.message).toContain('no est');
    });

    it('should reject assigning to a non-existent incident', async () => {
      await request(app.getHttpServer())
        .post('/api/incidents/00000000-0000-0000-0000-000000000000/assign')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ unitId: testUnit2Id })
        .expect(404);
    });

    it('field_unit should NOT be able to assign units', async () => {
      await request(app.getHttpServer())
        .post(`/api/incidents/${testIncidentId}/assign`)
        .set('Authorization', `Bearer ${fieldUnitToken}`)
        .send({ unitId: testUnit2Id })
        .expect(403);
    });
  });

  // ─── 7. Incident Notes & Timeline ──────────────────────────────────────────

  describe('Incident Notes & Timeline', () => {
    it('should add a note to the incident', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/incidents/${testIncidentId}/notes`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ text: 'E2E test note - unit en route' })
        .expect(201);

      expect(res.body.type).toBe('note');
      expect(res.body.description).toBe('E2E test note - unit en route');
      expect(res.body.incidentId).toBe(testIncidentId);
    });

    it('should add a second note', async () => {
      await request(app.getHttpServer())
        .post(`/api/incidents/${testIncidentId}/notes`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ text: 'E2E note from operator' })
        .expect(201);
    });

    it('should get incident events/timeline', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/incidents/${testIncidentId}/events`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      // Expected events: created + assigned + 2 notes = 4 minimum
      expect(res.body.length).toBeGreaterThanOrEqual(4);

      const types = res.body.map((e: any) => e.type);
      expect(types).toContain('created');
      expect(types).toContain('assigned');
      expect(types).toContain('note');
    });

    it('should get incident assignments', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/incidents/${testIncidentId}/assignments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0].unitId).toBe(testUnitId);
    });
  });

  // ─── 8. Incident Close ────────────────────────────────────────────────────

  describe('Incident Close', () => {
    it('should close the incident with resolution', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/incidents/${testIncidentId}/close`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ resolution: 'Resolved on scene', notes: 'E2E test completed' })
        .expect(201);

      expect(res.body.status).toBe(IncidentStatus.CLOSED);
      expect(res.body.resolution).toBe('Resolved on scene');
      expect(res.body.closedAt).toBeDefined();
    });

    it('closed incident should have a close event in timeline', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/incidents/${testIncidentId}/events`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const types = res.body.map((e: any) => e.type);
      expect(types).toContain('closed');
    });

    it('should reject assigning a unit to a closed incident', async () => {
      // First restore unit to available
      await request(app.getHttpServer())
        .patch(`/api/units/${testUnitId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'available' })
        .expect(200);

      await request(app.getHttpServer())
        .post(`/api/incidents/${testIncidentId}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ unitId: testUnitId })
        .expect(400);
    });
  });

  // ─── 9. RBAC ──────────────────────────────────────────────────────────────

  describe('RBAC', () => {
    it('field_unit should NOT be able to create users', async () => {
      await request(app.getHttpServer())
        .post('/api/users')
        .set('Authorization', `Bearer ${fieldUnitToken}`)
        .send({
          name: 'Unauthorized User',
          email: 'unauthorized@velnari.test',
          password: 'Test1234!',
          role: 'operator',
        })
        .expect(403);
    });

    it('field_unit should NOT be able to list users', async () => {
      await request(app.getHttpServer())
        .get('/api/users')
        .set('Authorization', `Bearer ${fieldUnitToken}`)
        .expect(403);
    });

    it('field_unit should NOT be able to create incidents', async () => {
      await request(app.getHttpServer())
        .post('/api/incidents')
        .set('Authorization', `Bearer ${fieldUnitToken}`)
        .send({
          type: 'noise',
          priority: 'low',
          lat: 19.4326,
          lng: -99.1332,
          description: 'E2E should be rejected',
        })
        .expect(403);
    });

    it('operator should be able to update unit status', async () => {
      await request(app.getHttpServer())
        .patch(`/api/units/${testUnitId}/status`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ status: 'available' })
        .expect(200);
    });

    it('admin should be able to list users', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // ─── 10. Public Report (no auth) ──────────────────────────────────────────

  describe('Public Report', () => {
    it('should accept a public citizen report without auth', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/incidents/public-report')
        .send({
          type: 'noise',
          description: 'E2E public report - ruido excesivo',
          lat: 19.43,
          lng: -99.13,
          address: 'Calle Test 123',
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('folio');
      expect(res.body.folio).toMatch(/^IC-/);
      expect(res.body.status).toBe('open');
      expect(res.body.priority).toBe('medium'); // public reports default to medium
    });

    it('should reject public report with missing coordinates', async () => {
      await request(app.getHttpServer())
        .post('/api/incidents/public-report')
        .send({
          type: 'noise',
          description: 'Missing coordinates',
        })
        .expect(400);
    });
  });

  // ─── 11. Health Check ─────────────────────────────────────────────────────

  describe('Health Check', () => {
    it('should return health check without auth', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/health')
        .expect(200);

      expect(res.body.status).toBe('ok');
      expect(res.body).toHaveProperty('timestamp');
      expect(res.body).toHaveProperty('uptime');
      expect(typeof res.body.uptime).toBe('number');
    });
  });

  // ─── 12. Heatmap ──────────────────────────────────────────────────────────

  describe('Heatmap', () => {
    it('should return heatmap data', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/incidents/heatmap')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      if (res.body.length > 0) {
        expect(res.body[0]).toHaveProperty('lat');
        expect(res.body[0]).toHaveProperty('lng');
        expect(res.body[0]).toHaveProperty('weight');
      }
    });
  });

  // ─── 13. Full Lifecycle Verification ───────────────────────────────────────

  describe('Full Lifecycle (second incident)', () => {
    let secondIncidentId: string;

    it('should create, assign, note, and close a second incident end-to-end', async () => {
      // 1. Create
      const createRes = await request(app.getHttpServer())
        .post('/api/incidents')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          type: 'assault',
          priority: 'critical',
          lat: 19.4300,
          lng: -99.1350,
          description: 'E2E lifecycle test - second incident',
          address: 'Calle Regina 45',
        })
        .expect(201);

      secondIncidentId = createRes.body.id;
      expect(createRes.body.status).toBe('open');

      // 2. Ensure unit is available
      await request(app.getHttpServer())
        .patch(`/api/units/${testUnit2Id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'available' })
        .expect(200);

      // 3. Assign
      const assignRes = await request(app.getHttpServer())
        .post(`/api/incidents/${secondIncidentId}/assign`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ unitId: testUnit2Id })
        .expect(201);
      expect(assignRes.body.status).toBe('assigned');

      // 4. Add note
      await request(app.getHttpServer())
        .post(`/api/incidents/${secondIncidentId}/notes`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ text: 'E2E unit arrived on scene' })
        .expect(201);

      // 5. Close
      const closeRes = await request(app.getHttpServer())
        .post(`/api/incidents/${secondIncidentId}/close`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ resolution: 'Suspect detained' })
        .expect(201);
      expect(closeRes.body.status).toBe('closed');

      // 6. Verify full timeline
      const eventsRes = await request(app.getHttpServer())
        .get(`/api/incidents/${secondIncidentId}/events`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const types = eventsRes.body.map((e: any) => e.type);
      expect(types).toContain('created');
      expect(types).toContain('assigned');
      expect(types).toContain('note');
      expect(types).toContain('closed');
      expect(eventsRes.body.length).toBe(4);
    });
  });
});
