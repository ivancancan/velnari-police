/**
 * GPS + Incident Simulator — Velnari demo
 * Simulates 6 police units patrolling CDMX Centro Histórico with realistic
 * patrol routes, status transitions, incidents, and assignments.
 *
 * Usage:
 *   node scripts/simulate-gps.mjs
 *
 * Requirements: API running on http://localhost:3001
 * Tip: Run `pnpm --filter api db:seed` first if units are missing.
 */

const API = process.env.API_URL ?? 'http://localhost:3001/api';
const LOCATION_INTERVAL_MS = 2500;   // GPS ping every 2.5s
const INCIDENT_INTERVAL_MS = 20000;  // new incident every ~20s
const STATUS_LOG_EVERY    = 8;       // print status every N ticks

// ── Patrol zones around CDMX Centro Histórico ────────────────────────────────
// Each unit patrols a specific zone with waypoints for realistic movement.
const PATROL_ZONES = [
  {
    callSign: 'P-01',
    zone: 'Zócalo / Centro',
    waypoints: [
      { lat: 19.4326, lng: -99.1332 },  // Zócalo
      { lat: 19.4310, lng: -99.1355 },  // Palacio Nacional
      { lat: 19.4340, lng: -99.1300 },  // Catedral
      { lat: 19.4295, lng: -99.1310 },  // Correo Mayor
      { lat: 19.4326, lng: -99.1332 },  // back to Zócalo
    ],
  },
  {
    callSign: 'P-02',
    zone: 'La Merced',
    waypoints: [
      { lat: 19.4284, lng: -99.1276 },  // Merced
      { lat: 19.4260, lng: -99.1260 },  // Correo Mayor Sur
      { lat: 19.4250, lng: -99.1300 },  // Fray Servando
      { lat: 19.4270, lng: -99.1320 },  // Anillo de Circunvalación
      { lat: 19.4284, lng: -99.1276 },
    ],
  },
  {
    callSign: 'P-03',
    zone: 'Tlatelolco',
    waypoints: [
      { lat: 19.4516, lng: -99.1449 },  // Plaza de las Tres Culturas
      { lat: 19.4490, lng: -99.1400 },
      { lat: 19.4469, lng: -99.1430 },
      { lat: 19.4510, lng: -99.1480 },
      { lat: 19.4516, lng: -99.1449 },
    ],
  },
  {
    callSign: 'P-04',
    zone: 'Tepito',
    waypoints: [
      { lat: 19.4390, lng: -99.1247 },  // Tepito
      { lat: 19.4410, lng: -99.1220 },
      { lat: 19.4370, lng: -99.1210 },
      { lat: 19.4360, lng: -99.1250 },
      { lat: 19.4390, lng: -99.1247 },
    ],
  },
  {
    callSign: 'P-05',
    zone: 'Guerrero',
    waypoints: [
      { lat: 19.4420, lng: -99.1350 },  // Col. Guerrero
      { lat: 19.4450, lng: -99.1380 },
      { lat: 19.4430, lng: -99.1420 },
      { lat: 19.4400, lng: -99.1390 },
      { lat: 19.4420, lng: -99.1350 },
    ],
  },
  {
    callSign: 'P-06',
    zone: 'San Rafael / Santa María',
    waypoints: [
      { lat: 19.4380, lng: -99.1550 },  // San Rafael
      { lat: 19.4360, lng: -99.1580 },
      { lat: 19.4340, lng: -99.1560 },
      { lat: 19.4355, lng: -99.1530 },
      { lat: 19.4380, lng: -99.1550 },
    ],
  },
];

// ── Incident templates ────────────────────────────────────────────────────────
const INCIDENT_TYPES = [
  { type: 'robbery',        priority: 'high',     desc: 'Reporte de robo a transeúnte en vía pública',        address: 'Av. Juárez' },
  { type: 'assault',        priority: 'critical', desc: 'Persona agredida con arma blanca, requiere apoyo',    address: 'Eje Central Lázaro Cárdenas' },
  { type: 'traffic',        priority: 'low',      desc: 'Accidente vial con daños materiales, dos vehículos',  address: 'Circuito Interior Norte' },
  { type: 'noise',          priority: 'low',      desc: 'Ruido excesivo, fiesta clandestina en vecindad',      address: 'Calle Mesones' },
  { type: 'domestic',       priority: 'medium',   desc: 'Llamada por violencia intrafamiliar, vecinos reportan', address: 'Calle Regina 45' },
  { type: 'missing_person', priority: 'high',     desc: 'Menor de edad extraviado, 8 años, playera roja',      address: 'Parque Alameda Central' },
  { type: 'other',          priority: 'medium',   desc: 'Individuo sospechoso con actitud evasiva',            address: 'Plaza Garibaldi' },
  { type: 'robbery',        priority: 'critical', desc: 'Asalto a negocio en curso, presunto armado',          address: 'Mercado de Tepito, Puesto 47' },
  { type: 'assault',        priority: 'high',     desc: 'Riña tumultuaria, aproximadamente 10 personas',       address: 'Av. del Trabajo s/n' },
  { type: 'traffic',        priority: 'medium',   desc: 'Vehículo obstruyendo carril, conductor agresivo',     address: 'Eje 1 Norte, frente a Metro Garibaldi' },
];

const RESOLUTIONS = [
  'Situación controlada, delincuente detenido y puesto a disposición del MP',
  'Unidad atendió el reporte, sin novedad, personas se retiraron voluntariamente',
  'Se aplicó acta administrativa, partes desistieron de cualquier acción legal',
  'Se trasladó lesionado al Hospital Juárez, área asegurada y cordón establecido',
  'Detenido puesto a disposición del Ministerio Público, oficio de remisión generado',
  'Patrullaje preventivo aplicado, situación normalizada sin detenidos',
];

// ── Auth ──────────────────────────────────────────────────────────────────────
let currentToken = null;

async function login() {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@velnari.mx', password: 'Velnari2024!' }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status} ${await res.text()}`);
  currentToken = (await res.json()).accessToken;
  return currentToken;
}

async function refreshTokenLoop() {
  // Re-login every 10 minutes (JWT expires in 15)
  setInterval(async () => {
    try {
      await login();
      console.log(`  🔑 token renovado ${new Date().toISOString()}`);
    } catch (err) {
      console.warn(`  ⚠ refresh falló: ${err.message}`);
    }
  }, 10 * 60 * 1000);
}

// ── API helpers ───────────────────────────────────────────────────────────────
async function loadUnits(token) {
  const res = await fetch(`${API}/units`, { headers: { Authorization: `Bearer ${currentToken}` } });
  if (!res.ok) throw new Error(`Failed to load units: ${res.status}`);
  return await res.json();
}

async function loadSectors(token) {
  const res = await fetch(`${API}/sectors`, { headers: { Authorization: `Bearer ${currentToken}` } });
  if (!res.ok) return [];
  return await res.json();
}

async function updateLocation(token, unitId, lat, lng) {
  const res = await fetch(`${API}/units/${unitId}/location`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentToken}` },
    body: JSON.stringify({ lat, lng }),
  });
  if (!res.ok && res.status !== 204) {
    console.warn(`  ⚠ location update failed for ${unitId}: ${res.status}`);
  }
}

async function setUnitStatus(token, unitId, status) {
  const res = await fetch(`${API}/units/${unitId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentToken}` },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    console.warn(`  ⚠ status update failed for ${unitId}: ${res.status}`);
  }
}

async function createIncident(token, sectorId, lat, lng, template) {
  const res = await fetch(`${API}/incidents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentToken}` },
    body: JSON.stringify({
      type: template.type,
      priority: template.priority,
      description: template.desc,
      address: template.address + ', CDMX',
      lat,
      lng,
      sectorId,
    }),
  });
  if (!res.ok) {
    console.warn(`  ⚠ incident create failed: ${res.status} ${await res.text()}`);
    return null;
  }
  return await res.json();
}

async function assignUnit(token, incidentId, unitId) {
  const res = await fetch(`${API}/incidents/${incidentId}/assign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentToken}` },
    body: JSON.stringify({ unitId }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.warn(`  ⚠ assign failed: ${res.status} ${body}`);
    return false;
  }
  return true;
}

async function closeIncident(token, incidentId) {
  const resolution = RESOLUTIONS[Math.floor(Math.random() * RESOLUTIONS.length)];
  const res = await fetch(`${API}/incidents/${incidentId}/close`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentToken}` },
    body: JSON.stringify({ resolution }),
  });
  if (!res.ok) console.warn(`  ⚠ close failed: ${res.status}`);
}

// ── Smooth waypoint navigation ─────────────────────────────────────────────
// Instead of random walk, move toward next waypoint with small jitter
function nextPosition(current, targetWaypoint) {
  const dlat = targetWaypoint.lat - current.lat;
  const dlng  = targetWaypoint.lng  - current.lng;
  const dist  = Math.sqrt(dlat ** 2 + dlng ** 2);

  if (dist < 0.0004) {
    // Close enough — snap to waypoint
    return { lat: targetWaypoint.lat, lng: targetWaypoint.lng, reached: true };
  }

  const speed = 0.00035; // ~40m per step
  const jitter = 0.00005;
  return {
    lat: current.lat + (dlat / dist) * speed + (Math.random() - 0.5) * jitter,
    lng: current.lng + (dlng / dist) * speed + (Math.random() - 0.5) * jitter,
    reached: false,
  };
}

// ── Pick available (non-busy) unit ────────────────────────────────────────
function pickAvailableUnit(state) {
  const available = state.filter((u) => !u.busy);
  if (available.length === 0) return null;
  return available[Math.floor(Math.random() * available.length)];
}

// ── Status emoji for console ──────────────────────────────────────────────
const STATUS_ICON = {
  available:      '🟢',
  en_route:       '🔵',
  on_scene:       '🟡',
  out_of_service: '⛔',
};

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║      🚔  Velnari GPS + Incident Simulator             ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');
  console.log('   Conectando a la API...\n');

  let token;
  try {
    token = await login();
    refreshTokenLoop();
    console.log('   ✓ Autenticado como admin@velnari.mx (auto-refresh cada 10 min)');
  } catch (err) {
    console.error(`\n   ❌ ${err.message}`);
    console.error('   Asegúrate que la API esté corriendo: cd apps/api && pnpm dev\n');
    process.exit(1);
  }

  const allUnits = await loadUnits(token);
  const sectors  = await loadSectors(token);
  const sectorId = sectors[0]?.id ?? null;

  console.log(`   ✓ ${allUnits.length} unidades encontradas`);
  console.log(`   ✓ Sector: ${sectors[0]?.name ?? '(sin sector)'}\n`);

  if (allUnits.length === 0) {
    console.error('   ❌ Sin unidades. Ejecuta: cd apps/api && pnpm db:seed\n');
    process.exit(1);
  }

  // Build state: match each patrol zone to its API unit
  const state = PATROL_ZONES.map((zone) => {
    const unit = allUnits.find((u) => u.callSign === zone.callSign);
    if (!unit) return null;
    const start = zone.waypoints[0];
    return {
      id:           unit.id,
      callSign:     zone.callSign,
      zone:         zone.zone,
      waypoints:    zone.waypoints,
      waypointIdx:  1, // index of NEXT waypoint to head toward
      lat:          start.lat,
      lng:          start.lng,
      busy:         false,
      status:       'available',
    };
  }).filter(Boolean);

  console.log(`   Simulando ${state.length} unidades en patrullaje:\n`);
  state.forEach((u) => {
    console.log(`   ${STATUS_ICON[u.status]} ${u.callSign.padEnd(5)} — ${u.zone}`);
  });
  console.log('\n   Presiona Ctrl+C para detener.\n');

  // Periodic token refresh (JWT expires in 15min)
  setInterval(async () => {
    try { token = await login(); }
    catch { /* will retry */ }
  }, 10 * 60 * 1000);

  // ── Location update loop ───────────────────────────────────────────────────
  let tick = 0;
  setInterval(async () => {
    tick++;

    for (const unit of state) {
      if (unit.busy) continue; // busy units' GPS still moves slightly

      const target = unit.waypoints[unit.waypointIdx];
      const next   = nextPosition(unit, target);

      unit.lat = next.lat;
      unit.lng = next.lng;

      if (next.reached) {
        unit.waypointIdx = (unit.waypointIdx + 1) % unit.waypoints.length;
      }

      await updateLocation(token, unit.id, unit.lat, unit.lng);
    }

    // Also update busy units (slower drift toward incident location)
    for (const unit of state) {
      if (!unit.busy || !unit.incidentLat) continue;
      const dlat = unit.incidentLat - unit.lat;
      const dlng  = unit.incidentLng  - unit.lng;
      const dist  = Math.sqrt(dlat ** 2 + dlng ** 2);
      if (dist > 0.0008) {
        unit.lat += dlat * 0.15;
        unit.lng  += dlng  * 0.15;
        await updateLocation(token, unit.id, unit.lat, unit.lng);
      }
    }

    if (tick % STATUS_LOG_EVERY === 0) {
      const time = new Date().toLocaleTimeString('es-MX');
      const line = state
        .map((u) => `${STATUS_ICON[u.status]} ${u.callSign}`)
        .join('  ');
      console.log(`   [${time}] ${line}`);
    }
  }, LOCATION_INTERVAL_MS);

  // ── Incident lifecycle loop ────────────────────────────────────────────────
  setInterval(async () => {
    const unit = pickAvailableUnit(state);
    if (!unit) return; // all units busy

    const template   = INCIDENT_TYPES[Math.floor(Math.random() * INCIDENT_TYPES.length)];
    const nearUnit   = state[Math.floor(Math.random() * state.length)];
    const incLat     = nearUnit.lat + (Math.random() - 0.5) * 0.006;
    const incLng     = nearUnit.lng  + (Math.random() - 0.5) * 0.006;

    const incident = await createIncident(token, sectorId, incLat, incLng, template);
    if (!incident) return;

    const priorityTag = {
      critical: '🚨 CRÍTICO',
      high:     '🔴 ALTO',
      medium:   '🟡 MEDIO',
      low:      '🟢 BAJO',
    }[template.priority] ?? template.priority.toUpperCase();

    console.log(`\n   ┌─ INCIDENTE ${incident.folio} ──────────────────────────────`);
    console.log(`   │  ${priorityTag} · ${template.type.toUpperCase()}`);
    console.log(`   │  📍 ${template.address}`);
    console.log(`   │  "${template.desc}"`);
    console.log(`   └──────────────────────────────────────────────────────\n`);

    // After 4 seconds, dispatch the nearest available unit
    setTimeout(async () => {
      const availNow = pickAvailableUnit(state);
      if (!availNow) return;

      const ok = await assignUnit(token, incident.id, availNow.id);
      if (!ok) return;

      availNow.busy        = true;
      availNow.status      = 'en_route';
      availNow.incidentLat = incLat;
      availNow.incidentLng  = incLng;
      await setUnitStatus(token, availNow.id, 'en_route');

      console.log(`   📡 [${new Date().toLocaleTimeString('es-MX')}] ${availNow.callSign} EN RUTA → ${incident.folio}`);

      // Arrive on scene after 15–25 seconds
      const arriveDelay = 15000 + Math.random() * 10000;
      setTimeout(async () => {
        availNow.status = 'on_scene';
        await setUnitStatus(token, availNow.id, 'on_scene');
        console.log(`   🏁 [${new Date().toLocaleTimeString('es-MX')}] ${availNow.callSign} EN ESCENA · ${incident.folio}`);

        // Close incident after 30–75 more seconds
        const closeDelay = 30000 + Math.random() * 45000;
        setTimeout(async () => {
          await closeIncident(token, incident.id);
          availNow.busy        = false;
          availNow.status      = 'available';
          availNow.incidentLat = null;
          availNow.incidentLng  = null;
          await setUnitStatus(token, availNow.id, 'available');
          console.log(`   ✅ [${new Date().toLocaleTimeString('es-MX')}] ${incident.folio} CERRADO · ${availNow.callSign} disponible`);
        }, closeDelay);
      }, arriveDelay);
    }, 4000);
  }, INCIDENT_INTERVAL_MS + Math.random() * 8000);
}

main();
