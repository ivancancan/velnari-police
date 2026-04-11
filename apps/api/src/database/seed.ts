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
 *   - 25 demo incidents (5 basic + 20 extended with timelines)
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

  // ── Demo Municipio (tenant) ────────────────────────────────────────────────
  const existingMunicipio = await query.query(
    `SELECT id FROM municipios WHERE slug = 'demo' LIMIT 1`,
  );
  let demoTenantId: string | null = null;
  if (existingMunicipio.length > 0) {
    demoTenantId = existingMunicipio[0].id;
    console.log(`  municipio already exists: ${demoTenantId}`);
  } else {
    const [mun] = await query.query(
      `INSERT INTO municipios (name, state, slug, contact_email, is_active)
       VALUES ($1, $2, $3, $4, true) RETURNING id`,
      ['Municipio Demo', 'CDMX', 'demo', 'demo@velnari.mx'],
    );
    demoTenantId = mun.id;
    console.log(`  ✓ municipio created: ${demoTenantId}`);
  }

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
      `INSERT INTO sectors (name, color, is_active, tenant_id) VALUES ($1, $2, $3, $4) RETURNING id`,
      ['Centro Histórico', '#3B82F6', true, demoTenantId],
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
        `INSERT INTO users (email, password_hash, role, name, badge_number, sector_id, is_active, tenant_id)
         VALUES ($1, $2, $3::user_role, $4, $5, $6, true, $7)`,
        [u.email, hash, u.role, u.name, u.badge, u.role === 'operator' ? sectorId : null, demoTenantId],
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
        `INSERT INTO units (call_sign, status, sector_id, shift, is_active, tenant_id)
         VALUES ($1, 'available'::unit_status, $2, $3, true, $4)`,
        [callSign, sectorId, callSign <= 'P-03' ? 'Matutino' : 'Vespertino', demoTenantId],
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
        `INSERT INTO users (email, password_hash, role, name, badge_number, sector_id, is_active, tenant_id)
         VALUES ($1, $2, $3::user_role, $4, $5, $6, true, $7)`,
        [u.email, hash, u.role, u.name, u.badge, sectorId, demoTenantId],
      );
      console.log(`  ✓ user created: ${u.email}`);
    }
  }

  // ── Assign field officers to units ────────────────────────────────────────
  const [campo1User] = await query.query(`SELECT id FROM users WHERE email = 'campo1@velnari.mx' LIMIT 1`);
  const [campo2User] = await query.query(`SELECT id FROM users WHERE email = 'campo2@velnari.mx' LIMIT 1`);
  const [unitP01] = await query.query(`SELECT id FROM units WHERE call_sign = 'P-01' LIMIT 1`);
  const [unitP02] = await query.query(`SELECT id FROM units WHERE call_sign = 'P-02' LIMIT 1`);

  if (campo1User && unitP01) {
    await query.query(`UPDATE units SET assigned_user_id = $1 WHERE id = $2`, [campo1User.id, unitP01.id]);
    console.log(`  ✓ campo1 assigned to P-01`);
  }
  if (campo2User && unitP02) {
    await query.query(`UPDATE units SET assigned_user_id = $1 WHERE id = $2`, [campo2User.id, unitP02.id]);
    console.log(`  ✓ campo2 assigned to P-02`);
  }

  // ── More field officers for fuller demo ───────────────────────────────────
  const moreFieldUsers = [
    { email: 'campo3@velnari.mx', name: 'Juan Patrullero', badge: 'FLD-003', unit: 'P-03' },
    { email: 'campo4@velnari.mx', name: 'Sofia Patrullera', badge: 'FLD-004', unit: 'P-04' },
    { email: 'campo5@velnari.mx', name: 'Carlos Patrullero', badge: 'FLD-005', unit: 'P-05' },
  ];

  for (const u of moreFieldUsers) {
    let userId: string | null = null;
    const existing = await query.query(`SELECT id FROM users WHERE email = $1 LIMIT 1`, [u.email]);
    if (existing.length === 0) {
      const [created] = await query.query(
        `INSERT INTO users (email, password_hash, role, name, badge_number, sector_id, is_active)
         VALUES ($1, $2, 'field_unit'::user_role, $3, $4, $5, true) RETURNING id`,
        [u.email, hash, u.name, u.badge, sectorId],
      );
      userId = created.id;
      console.log(`  ✓ user created: ${u.email}`);
    } else {
      userId = existing[0].id;
    }
    if (userId) {
      const [unitRow] = await query.query(`SELECT id FROM units WHERE call_sign = $1 LIMIT 1`, [u.unit]);
      if (unitRow) {
        await query.query(`UPDATE units SET assigned_user_id = $1 WHERE id = $2`, [userId, unitRow.id]);
        console.log(`  ✓ ${u.email} assigned to ${u.unit}`);
      }
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

  // ── Additional sectors (created before incidents so we can spread across them) ──
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

  const [sectorNorteRow] = await query.query(`SELECT id FROM sectors WHERE name = 'Sector Norte' LIMIT 1`);
  const [sectorSurRow] = await query.query(`SELECT id FROM sectors WHERE name = 'Sector Sur' LIMIT 1`);
  const sectorNorteId: string = sectorNorteRow?.id ?? sectorId;
  const sectorSurId: string = sectorSurRow?.id ?? sectorId;

  // ── Extended demo incidents (20 more, spanning 7 days) ──────────────────
  const moreIncidents = [
    // Today
    { type: 'robbery', priority: 'critical', status: 'closed', desc: 'Asalto con arma de fuego en joyería', address: 'Calle Madero 42, Centro', lat: 19.4338, lng: -99.1395, resolution: 'Detenido puesto a disposición del MP. Arma asegurada.', daysAgo: 0 },
    { type: 'traffic', priority: 'medium', status: 'open', desc: 'Choque múltiple en Eje Central, 3 vehículos', address: 'Eje Central Lázaro Cárdenas y Fray Servando', lat: 19.4290, lng: -99.1365, resolution: null, daysAgo: 0 },
    { type: 'assault', priority: 'high', status: 'assigned', desc: 'Riña entre 5 personas afuera de bar', address: 'Plaza Garibaldi, Centro', lat: 19.4398, lng: -99.1397, resolution: null, daysAgo: 0 },
    // Yesterday
    { type: 'domestic', priority: 'high', status: 'closed', desc: 'Violencia doméstica, mujer con lesiones visibles', address: 'Calle República de Chile 28', lat: 19.4355, lng: -99.1348, resolution: 'Víctima trasladada a hospital. Agresor detenido.', daysAgo: 1 },
    { type: 'noise', priority: 'low', status: 'closed', desc: 'Música a alto volumen en vecindad, queja de vecinos', address: 'Calle Mesones 89, Centro', lat: 19.4275, lng: -99.1345, resolution: 'Se habló con responsable, bajó el volumen.', daysAgo: 1 },
    { type: 'robbery', priority: 'high', status: 'closed', desc: 'Robo de celular con violencia en Metro Zócalo', address: 'Estación Metro Zócalo', lat: 19.4325, lng: -99.1332, resolution: 'Víctima identificó a agresor. Remitido a MP.', daysAgo: 1 },
    { type: 'missing_person', priority: 'critical', status: 'closed', desc: 'Menor de 8 años extraviado en Alameda Central', address: 'Alameda Central, Centro', lat: 19.4360, lng: -99.1442, resolution: 'Menor localizado con familiar. Situación resuelta.', daysAgo: 1 },
    // 2 days ago
    { type: 'traffic', priority: 'low', status: 'closed', desc: 'Vehículo estacionado en doble fila bloqueando tránsito', address: 'Av. 5 de Mayo esquina Bolívar', lat: 19.4335, lng: -99.1405, resolution: 'Grúa retiró vehículo. Infracción aplicada.', daysAgo: 2 },
    { type: 'assault', priority: 'critical', status: 'closed', desc: 'Persona apuñalada en vía pública', address: 'Calle Corregidora 12, Centro', lat: 19.4305, lng: -99.1310, resolution: 'Lesionado trasladado a hospital. Agresor prófugo.', daysAgo: 2 },
    { type: 'other', priority: 'medium', status: 'closed', desc: 'Individuo en estado de intoxicación generando disturbios', address: 'Calle Moneda 15, Centro', lat: 19.4318, lng: -99.1312, resolution: 'Persona trasladada a albergue municipal.', daysAgo: 2 },
    // 3 days ago
    { type: 'robbery', priority: 'high', status: 'closed', desc: 'Asalto a tienda de conveniencia OXXO', address: 'Av. Juárez 78, Centro', lat: 19.4348, lng: -99.1425, resolution: 'Cámaras de seguridad revisadas. Caso en investigación.', daysAgo: 3 },
    { type: 'noise', priority: 'low', status: 'closed', desc: 'Construcción sin permiso generando ruido excesivo', address: 'Calle Donceles 55, Centro', lat: 19.4348, lng: -99.1388, resolution: 'Obra suspendida. Se notificó a Desarrollo Urbano.', daysAgo: 3 },
    { type: 'domestic', priority: 'medium', status: 'closed', desc: 'Discusión fuerte entre vecinos por estacionamiento', address: 'Calle Guatemala 24, Centro', lat: 19.4342, lng: -99.1320, resolution: 'Mediación realizada. Partes llegaron a acuerdo.', daysAgo: 3 },
    // 4 days ago
    { type: 'traffic', priority: 'high', status: 'closed', desc: 'Motociclista atropellado por camión de carga', address: 'Circuito Interior y Av. Congreso de la Unión', lat: 19.4255, lng: -99.1180, resolution: 'Motociclista con fracturas, hospitalizado. Peritaje en proceso.', daysAgo: 4 },
    { type: 'robbery', priority: 'medium', status: 'closed', desc: 'Carterismo en transporte público Ruta 1', address: 'Av. Hidalgo, parada de autobús', lat: 19.4370, lng: -99.1410, resolution: 'Carpeta de investigación iniciada.', daysAgo: 4 },
    // 5 days ago
    { type: 'assault', priority: 'high', status: 'closed', desc: 'Asalto a peatón con navaja, robo de pertenencias', address: 'Calle Tacuba 15, Centro', lat: 19.4355, lng: -99.1400, resolution: 'Detenido en flagrancia a 2 cuadras. Pertenencias recuperadas.', daysAgo: 5 },
    { type: 'other', priority: 'low', status: 'closed', desc: 'Mascota agresiva sin correa atacó a transeúnte', address: 'Parque de la Ciudadela', lat: 19.4278, lng: -99.1420, resolution: 'Dueño identificado. Infracción y responsiva firmada.', daysAgo: 5 },
    // 6 days ago
    { type: 'missing_person', priority: 'high', status: 'closed', desc: 'Adulto mayor desorientado sin identificación', address: 'Mercado de la Merced', lat: 19.4280, lng: -99.1240, resolution: 'Identificado por familiar. Entregado a su domicilio.', daysAgo: 6 },
    { type: 'robbery', priority: 'critical', status: 'closed', desc: 'Robo a casa habitación con personas adentro', address: 'Calle República de Argentina 50', lat: 19.4365, lng: -99.1335, resolution: '2 detenidos. Objetos recuperados parcialmente.', daysAgo: 6 },
    { type: 'traffic', priority: 'medium', status: 'closed', desc: 'Semáforo descompuesto causando caos vial', address: 'Av. 20 de Noviembre y Fray Servando', lat: 19.4260, lng: -99.1330, resolution: 'Agente de tránsito controló el flujo. Semáforo reparado.', daysAgo: 6 },
  ];

  const [adminUser] = await query.query(`SELECT id FROM users WHERE email = 'admin@velnari.mx' LIMIT 1`);
  const unitRows = await query.query(`SELECT id FROM units ORDER BY call_sign LIMIT 6`);

  for (let i = 0; i < moreIncidents.length; i++) {
    const inc = moreIncidents[i]!;
    const existing = await query.query(`SELECT id FROM incidents WHERE description = $1 LIMIT 1`, [inc.desc]);
    if (existing.length > 0) {
      console.log(`  incident already exists: ${inc.desc.substring(0, 40)}...`);
      continue;
    }

    const folio = `IC-${String(200 + i).padStart(3, '0')}`;
    const now = new Date();
    const createdAt = new Date(now.getTime() - inc.daysAgo * 24 * 60 * 60 * 1000);
    // Randomize hour between 6:00 and 23:00
    createdAt.setHours(6 + Math.floor(Math.random() * 17), Math.floor(Math.random() * 60), Math.floor(Math.random() * 60));

    const assignedAt = inc.status !== 'open'
      ? new Date(createdAt.getTime() + (1 + Math.random() * 4) * 60000)
      : null;
    const closedAt = inc.status === 'closed'
      ? new Date(createdAt.getTime() + (30 + Math.random() * 90) * 60000)
      : null;
    const assignedUnitId = inc.status !== 'open'
      ? unitRows[Math.floor(Math.random() * unitRows.length)]!.id
      : null;

    const [inserted] = await query.query(
      `INSERT INTO incidents (folio, type, priority, status, description, address, lat, lng, location, sector_id, created_by, assigned_unit_id, assigned_at, closed_at, resolution, created_at, updated_at)
       VALUES ($1, $2::incident_type, $3::incident_priority, $4::incident_status, $5, $6, $7, $8,
               ST_SetSRID(ST_MakePoint($9, $10), 4326), $11, $12, $13, $14, $15, $16, $17, $17)
       RETURNING id, created_at`,
      [folio, inc.type, inc.priority, inc.status, inc.desc, inc.address, inc.lat, inc.lng,
       inc.lng, inc.lat, i % 3 === 0 ? sectorId : i % 3 === 1 ? sectorNorteId : sectorSurId, adminUser.id, assignedUnitId, assignedAt, closedAt, inc.resolution, createdAt],
    );
    console.log(`  ✓ incident created: ${folio} — ${inc.type} (${inc.status})`);

    // ── Incident events / timeline ──
    if (adminUser) {
      // 'created' event
      await query.query(
        `INSERT INTO incident_events (incident_id, type, description, actor_id, created_at)
         VALUES ($1, 'created', 'Incidente creado y registrado en el sistema', $2, $3)`,
        [inserted.id, adminUser.id, createdAt],
      );

      if (inc.status !== 'open' && assignedAt) {
        // 'assigned' event
        await query.query(
          `INSERT INTO incident_events (incident_id, type, description, actor_id, created_at)
           VALUES ($1, 'assigned', 'Unidad asignada al incidente', $2, $3)`,
          [inserted.id, adminUser.id, assignedAt],
        );
      }

      if (inc.status === 'closed' && closedAt) {
        // 'arrived' event (between assigned and closed)
        const arrivedAt = new Date(
          (assignedAt as Date).getTime() + (5 + Math.random() * 10) * 60000,
        );
        await query.query(
          `INSERT INTO incident_events (incident_id, type, description, actor_id, created_at)
           VALUES ($1, 'arrived', 'Unidad llegó al lugar de los hechos', $2, $3)`,
          [inserted.id, adminUser.id, arrivedAt],
        );

        // 'note' event — operational observations
        const notes = [
          'Área asegurada, se acordonó perímetro.',
          'Se solicitó apoyo adicional.',
          'Testigos entrevistados en el lugar.',
          'Evidencia fotográfica recopilada.',
          'Se coordinó con servicios de emergencia.',
          'Perimetral establecido, sin más afectados.',
        ];
        const noteAt = new Date(arrivedAt.getTime() + (3 + Math.random() * 5) * 60000);
        await query.query(
          `INSERT INTO incident_events (incident_id, type, description, actor_id, created_at)
           VALUES ($1, 'note', $2, $3, $4)`,
          [inserted.id, notes[Math.floor(Math.random() * notes.length)], adminUser.id, noteAt],
        );

        // 'closed' event
        await query.query(
          `INSERT INTO incident_events (incident_id, type, description, actor_id, created_at)
           VALUES ($1, 'closed', $2, $3, $4)`,
          [inserted.id, `Incidente cerrado. ${inc.resolution}`, adminUser.id, closedAt],
        );
      }
    }
  }

  console.log(`  ✓ ${moreIncidents.length} extended incidents processed with timelines`);

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
  console.log('  📧 campo1@velnari.mx      / Velnari2024!  (Unidad de Campo — P-01)');
  console.log('  📧 campo2@velnari.mx      / Velnari2024!  (Unidad de Campo — P-02)');
  console.log('  📧 campo3@velnari.mx      / Velnari2024!  (Unidad de Campo — P-03)');
  console.log('  📧 campo4@velnari.mx      / Velnari2024!  (Unidad de Campo — P-04)');
  console.log('  📧 campo5@velnari.mx      / Velnari2024!  (Unidad de Campo — P-05)');
  console.log('');
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
