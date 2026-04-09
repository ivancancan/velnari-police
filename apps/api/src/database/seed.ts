/**
 * Seed script — creates demo data for local development
 * Run: pnpm db:seed
 *
 * Creates:
 *   - 1 admin user:    admin@velnari.mx    / Velnari2024!
 *   - 1 operator user: operador@velnari.mx / Velnari2024!
 *   - 1 supervisor:    supervisor@velnari.mx / Velnari2024!
 *   - 1 commander:     comandante@velnari.mx / Velnari2024!
 *   - 2 field units:   campo1/campo2@velnari.mx / Velnari2024!
 *   - 4 sectors: Centro Histórico, Norte, Sur, Oriente
 *   - 6 patrol units: P-01 … P-06
 *   - 5 demo incidents
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

  // ── More users for demo ──
  const extraUsers = [
    { email: 'comandante@velnari.mx', role: 'commander', name: 'Roberto Comandante', badge: 'CMD-001' },
    { email: 'campo1@velnari.mx', role: 'field_unit', name: 'Miguel Patrullero', badge: 'FLD-001' },
    { email: 'campo2@velnari.mx', role: 'field_unit', name: 'Laura Patrullera', badge: 'FLD-002' },
  ];

  for (const u of extraUsers) {
    const existing = await query.query(`SELECT id FROM users WHERE email = $1 LIMIT 1`, [u.email]);
    if (existing.length === 0) {
      await query.query(
        `INSERT INTO users (email, password_hash, role, name, badge_number, sector_id, is_active)
         VALUES ($1, $2, $3::user_role, $4, $5, $6, true)`,
        [u.email, hash, u.role, u.name, u.badge, sectorId],
      );
      console.log(`  ✓ user created: ${u.email}`);
    }
  }

  // ── Demo incidents ──
  const demoIncidents = [
    { type: 'robbery', priority: 'high', desc: 'Asalto a mano armada en tienda de conveniencia', address: 'Av. Juárez 120, Centro Histórico', lat: 19.4352, lng: -99.1412 },
    { type: 'traffic', priority: 'medium', desc: 'Colisión entre dos vehículos, sin lesionados', address: 'Eje Central y Av. Hidalgo', lat: 19.4380, lng: -99.1398 },
    { type: 'assault', priority: 'critical', desc: 'Persona agredida con arma blanca, requiere ambulancia', address: 'Calle Regina 45, Centro', lat: 19.4268, lng: -99.1335 },
    { type: 'noise', priority: 'low', desc: 'Fiesta con música a alto volumen después de medianoche', address: 'Calle Donceles 78', lat: 19.4345, lng: -99.1380 },
    { type: 'domestic', priority: 'high', desc: 'Vecinos reportan gritos y golpes en departamento', address: 'Republica de Cuba 32, Depto 4', lat: 19.4310, lng: -99.1355 },
  ];

  for (const inc of demoIncidents) {
    const existing = await query.query(`SELECT id FROM incidents WHERE description = $1 LIMIT 1`, [inc.desc]);
    if (existing.length === 0) {
      const [adminUser] = await query.query(`SELECT id FROM users WHERE email = 'admin@velnari.mx' LIMIT 1`);
      if (adminUser) {
        const folio = `IC-${String(Math.floor(Math.random() * 900) + 100).padStart(3, '0')}`;
        await query.query(
          `INSERT INTO incidents (folio, type, priority, status, description, address, lat, lng, location, sector_id, created_by)
           VALUES ($1, $2::incident_type, $3::incident_priority, 'open'::incident_status, $4, $5, $6, $7, ST_SetSRID(ST_MakePoint($8, $9), 4326), $10, $11)`,
          [folio, inc.type, inc.priority, inc.desc, inc.address, inc.lat, inc.lng, inc.lng, inc.lat, sectorId, adminUser.id],
        );
        console.log(`  ✓ incident created: ${folio} — ${inc.type}`);
      }
    }
  }

  // ── Additional sectors ──
  const extraSectors = [
    { name: 'Sector Norte', color: '#10B981' },
    { name: 'Sector Sur', color: '#F59E0B' },
    { name: 'Sector Oriente', color: '#8B5CF6' },
  ];

  for (const s of extraSectors) {
    const existing = await query.query(`SELECT id FROM sectors WHERE name = $1 LIMIT 1`, [s.name]);
    if (existing.length === 0) {
      await query.query(
        `INSERT INTO sectors (name, color, is_active) VALUES ($1, $2, true)`,
        [s.name, s.color],
      );
      console.log(`  ✓ sector created: ${s.name}`);
    }
  }

  await query.release();
  await AppDataSource.destroy();

  console.log('');
  console.log('✅ Seed complete!');
  console.log('');
  console.log('  Login credentials:');
  console.log('  📧 admin@velnari.mx       / Velnari2024!  (Admin)');
  console.log('  📧 operador@velnari.mx    / Velnari2024!  (Operador)');
  console.log('  📧 supervisor@velnari.mx  / Velnari2024!  (Supervisor)');
  console.log('  📧 comandante@velnari.mx  / Velnari2024!  (Comandante)');
  console.log('  📧 campo1@velnari.mx      / Velnari2024!  (Unidad de Campo)');
  console.log('  📧 campo2@velnari.mx      / Velnari2024!  (Unidad de Campo)');
  console.log('');
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
