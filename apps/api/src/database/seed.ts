/**
 * Seed script — creates demo data for local development
 * Run: pnpm db:seed
 *
 * Creates:
 *   - 1 admin user:    admin@velnari.mx    / Velnari2024!
 *   - 1 operator user: operador@velnari.mx / Velnari2024!
 *   - 1 supervisor:    supervisor@velnari.mx / Velnari2024!
 *   - 1 sector: "Centro Histórico"
 *   - 6 field units: P-01 … P-06
 */

import 'reflect-metadata';
import * as bcrypt from 'bcrypt';
import { AppDataSource } from './data-source';

const PASSWORD_PLAIN = 'Velnari2024!';

// CDMX — Centro Histórico bounds (rough)
const SECTOR_CENTER = { lat: 19.4326, lng: -99.1332 };

async function seed(): Promise<void> {
  await AppDataSource.initialize();
  const query = AppDataSource.createQueryRunner();
  await query.connect();

  console.log('🌱 Starting seed...');

  const hash = await bcrypt.hash(PASSWORD_PLAIN, 10);

  // ── Sector ────────────────────────────────────────────────────────────────
  const existingSector = await query.query(
    `SELECT id FROM sectors WHERE name = 'Centro Histórico' LIMIT 1`,
  );

  let sectorId: string;
  if (existingSector.length > 0) {
    sectorId = existingSector[0].id;
    console.log(`  sector already exists: ${sectorId}`);
  } else {
    const [sector] = await query.query(
      `INSERT INTO sectors (name, color, is_active) VALUES ($1, $2, $3) RETURNING id`,
      ['Centro Histórico', '#3B82F6', true],
    );
    sectorId = sector.id;
    console.log(`  ✓ sector created: ${sectorId}`);
  }

  // ── Users ─────────────────────────────────────────────────────────────────
  const users = [
    { email: 'admin@velnari.mx', role: 'admin', name: 'Admin Velnari', badge: 'ADM-001' },
    { email: 'operador@velnari.mx', role: 'operator', name: 'Carlos Operador', badge: 'OPR-001' },
    { email: 'supervisor@velnari.mx', role: 'supervisor', name: 'Ana Supervisora', badge: 'SUP-001' },
  ];

  for (const u of users) {
    const existing = await query.query(
      `SELECT id FROM users WHERE email = $1 LIMIT 1`,
      [u.email],
    );
    if (existing.length > 0) {
      console.log(`  user already exists: ${u.email}`);
    } else {
      await query.query(
        `INSERT INTO users (email, password_hash, role, name, badge_number, sector_id, is_active)
         VALUES ($1, $2, $3::user_role, $4, $5, $6, true)`,
        [u.email, hash, u.role, u.name, u.badge, u.role === 'operator' ? sectorId : null],
      );
      console.log(`  ✓ user created: ${u.email}`);
    }
  }

  // ── Field units ───────────────────────────────────────────────────────────
  const unitCallSigns = ['P-01', 'P-02', 'P-03', 'P-04', 'P-05', 'P-06'];

  for (const callSign of unitCallSigns) {
    const existing = await query.query(
      `SELECT id FROM units WHERE call_sign = $1 LIMIT 1`,
      [callSign],
    );
    if (existing.length > 0) {
      console.log(`  unit already exists: ${callSign}`);
    } else {
      await query.query(
        `INSERT INTO units (call_sign, status, sector_id, shift, is_active)
         VALUES ($1, 'available'::unit_status, $2, $3, true)`,
        [callSign, sectorId, callSign <= 'P-03' ? 'Matutino' : 'Vespertino'],
      );
      console.log(`  ✓ unit created: ${callSign}`);
    }
  }

  await query.release();
  await AppDataSource.destroy();

  console.log('');
  console.log('✅ Seed complete!');
  console.log('');
  console.log('  Login credentials:');
  console.log('  📧 admin@velnari.mx    / Velnari2024!');
  console.log('  📧 operador@velnari.mx / Velnari2024!');
  console.log('');
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
