/**
 * GPS + Incident Simulator — Velnari demo
 * Moves 6 units around CDMX Centro Histórico and generates incidents
 *
 * Usage:
 *   node scripts/simulate-gps.mjs
 *
 * Requirements: API running on http://localhost:3001
 */

const API = 'http://localhost:3001/api';
const LOCATION_INTERVAL_MS = 2000;   // location update every 2s
const INCIDENT_INTERVAL_MS = 18000;  // new incident every ~18s

// ── Starting positions around CDMX Centro Histórico ───────────────────────
const UNIT_STARTS = [
  { callSign: 'P-01', lat: 19.4326, lng: -99.1332 },  // Zócalo
  { callSign: 'P-02', lat: 19.4284, lng: -99.1276 },  // Merced
  { callSign: 'P-03', lat: 19.4369, lng: -99.1397 },  // Tlatelolco
  { callSign: 'P-04', lat: 19.4190, lng: -99.1247 },  // Tepito
  { callSign: 'P-05', lat: 19.4420, lng: -99.1210 },  // Guerrero
  { callSign: 'P-06', lat: 19.4260, lng: -99.1450 },  // San Rafael
];

const STEP = 0.0008;

// ── Incident templates ────────────────────────────────────────────────────
const INCIDENT_TYPES = [
  { type: 'robbery',        priority: 'high',     desc: 'Reporte de robo a transeúnte',          address: 'Av. Juárez' },
  { type: 'assault',        priority: 'critical', desc: 'Persona agredida, requiere apoyo',       address: 'Eje Central' },
  { type: 'traffic',        priority: 'low',      desc: 'Accidente vial, daños materiales',       address: 'Circuito Interior' },
  { type: 'noise',          priority: 'low',      desc: 'Ruido excesivo, fiesta clandestina',     address: 'Av. Insurgentes' },
  { type: 'domestic',       priority: 'medium',   desc: 'Llamada por violencia doméstica',        address: 'Calle Regina' },
  { type: 'missing_person', priority: 'high',     desc: 'Menor de edad extraviado',               address: 'Parque Alameda' },
  { type: 'other',          priority: 'medium',   desc: 'Individuo sospechoso, portación de arma', address: 'Plaza Garibaldi' },
  { type: 'robbery',        priority: 'critical', desc: 'Asalto a negocio en curso',              address: 'Mercado de Tepito' },
];

const RESOLUTIONS = [
  'Situación controlada, delincuente detenido',
  'Unidad atendió el reporte, sin novedad',
  'Personas desistieron, situación normalizada',
  'Se trasladó lesionado a hospital, área asegurada',
  'Detenido puesto a disposición del MP',
];

// ── Auth ──────────────────────────────────────────────────────────────────
async function login() {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@velnari.mx', password: 'Velnari2024!' }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status} ${await res.text()}`);
  return (await res.json()).accessToken;
}

// ── Load units from API ───────────────────────────────────────────────────
async function loadUnits(token) {
  const res = await fetch(`${API}/units`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to load units: ${res.status}`);
  return await res.json();
}

// ── Load sectors ──────────────────────────────────────────────────────────
async function loadSectors(token) {
  const res = await fetch(`${API}/sectors`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  return await res.json();
}

// ── Send location update ──────────────────────────────────────────────────
async function updateLocation(token, unitId, lat, lng) {
  const res = await fetch(`${API}/units/${unitId}/location`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ lat, lng }),
  });
  if (!res.ok && res.status !== 204) {
    console.warn(`  ⚠ location update failed for ${unitId}: ${res.status}`);
  }
}

// ── Create incident ───────────────────────────────────────────────────────
async function createIncident(token, sectorId, lat, lng, template) {
  const res = await fetch(`${API}/incidents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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

// ── Assign unit to incident ───────────────────────────────────────────────
async function assignUnit(token, incidentId, unitId) {
  const res = await fetch(`${API}/incidents/${incidentId}/assign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ unitId }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.warn(`  ⚠ assign failed: ${res.status} ${body}`);
    return false;
  }
  return true;
}

// ── Close incident ────────────────────────────────────────────────────────
async function closeIncident(token, incidentId) {
  const resolution = RESOLUTIONS[Math.floor(Math.random() * RESOLUTIONS.length)];
  const res = await fetch(`${API}/incidents/${incidentId}/close`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ resolution }),
  });
  if (!res.ok) {
    console.warn(`  ⚠ close incident failed: ${res.status}`);
  }
}

// ── Random walk ───────────────────────────────────────────────────────────
function randomStep(current) {
  const center = { lat: 19.4326, lng: -99.1332 };
  const distLat = center.lat - current.lat;
  const distLng = center.lng - current.lng;
  const dist = Math.sqrt(distLat ** 2 + distLng ** 2);
  const bias = dist > 0.02 ? 0.4 : 0;
  return {
    lat: current.lat + (Math.random() - 0.5 + distLat * bias) * STEP * 2,
    lng: current.lng + (Math.random() - 0.5 + distLng * bias) * STEP * 2,
  };
}

// ── Pick a random available unit ─────────────────────────────────────────
function pickAvailableUnit(state) {
  const available = state.filter((u) => u.busy === false);
  if (available.length === 0) return null;
  return available[Math.floor(Math.random() * available.length)];
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('🚔 Velnari GPS + Incident Simulator');
  console.log('   Connecting to API...\n');

  let token;
  try {
    token = await login();
    console.log('   ✓ Authenticated as admin@velnari.mx');
  } catch (err) {
    console.error(`\n   ❌ ${err.message}`);
    console.error('   Make sure the API is running: cd apps/api && pnpm dev\n');
    process.exit(1);
  }

  const allUnits = await loadUnits(token);
  const sectors = await loadSectors(token);
  const sectorId = sectors[0]?.id ?? null;

  console.log(`   ✓ Found ${allUnits.length} units`);
  console.log(`   ✓ Sector: ${sectors[0]?.name ?? 'none'}\n`);

  if (allUnits.length === 0) {
    console.error('   ❌ No units found. Run: cd apps/api && pnpm db:seed\n');
    process.exit(1);
  }

  // State: match API units with starting positions
  const state = UNIT_STARTS.map((start) => {
    const unit = allUnits.find((u) => u.callSign === start.callSign);
    if (!unit) return null;
    return { id: unit.id, callSign: start.callSign, lat: start.lat, lng: start.lng, busy: false };
  }).filter(Boolean);

  console.log(`   Simulating ${state.length} units + incidents. Press Ctrl+C to stop.\n`);
  state.forEach((u) => console.log(`   📍 ${u.callSign} — ${u.lat.toFixed(4)}, ${u.lng.toFixed(4)}`));
  console.log('');

  // Periodic re-auth (token expires in 15m)
  setInterval(async () => {
    try { token = await login(); } catch { /* retry next interval */ }
  }, 10 * 60 * 1000);

  // ── Location update loop ─────────────────────────────────────────────────
  let tick = 0;
  setInterval(async () => {
    tick++;
    for (const unit of state) {
      const next = randomStep(unit);
      unit.lat = next.lat;
      unit.lng = next.lng;
      await updateLocation(token, unit.id, unit.lat, unit.lng);
    }

    if (tick % 10 === 0) {
      const positions = state
        .map((u) => `${u.callSign}${u.busy ? '🔴' : '🟢'}(${u.lat.toFixed(4)},${u.lng.toFixed(4)})`)
        .join('  ');
      console.log(`   [${new Date().toLocaleTimeString('es-MX')}] ${positions}`);
    }
  }, LOCATION_INTERVAL_MS);

  // ── Incident lifecycle loop ───────────────────────────────────────────────
  setInterval(async () => {
    const unit = pickAvailableUnit(state);
    if (!unit) return; // all units busy

    const template = INCIDENT_TYPES[Math.floor(Math.random() * INCIDENT_TYPES.length)];

    // Spawn incident near a random unit
    const target = state[Math.floor(Math.random() * state.length)];
    const incLat = target.lat + (Math.random() - 0.5) * 0.005;
    const incLng = target.lng + (Math.random() - 0.5) * 0.005;

    const incident = await createIncident(token, sectorId, incLat, incLng, template);
    if (!incident) return;

    console.log(`\n   🚨 [${new Date().toLocaleTimeString('es-MX')}] INCIDENTE ${incident.folio}`);
    console.log(`      ${template.priority.toUpperCase()} · ${template.type} · ${template.address}`);
    console.log(`      "${template.desc}"`);

    // Assign a unit after 3 seconds
    setTimeout(async () => {
      const ok = await assignUnit(token, incident.id, unit.id);
      if (ok) {
        unit.busy = true;
        console.log(`\n   📡 [${new Date().toLocaleTimeString('es-MX')}] ${unit.callSign} asignada → ${incident.folio}`);

        // Close incident after 30–60 seconds
        const closeDelay = 30000 + Math.random() * 30000;
        setTimeout(async () => {
          await closeIncident(token, incident.id);
          unit.busy = false;
          console.log(`\n   ✅ [${new Date().toLocaleTimeString('es-MX')}] ${incident.folio} cerrado · ${unit.callSign} disponible`);
        }, closeDelay);
      }
    }, 3000);
  }, INCIDENT_INTERVAL_MS);
}

main();
