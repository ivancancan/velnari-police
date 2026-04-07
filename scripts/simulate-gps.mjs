/**
 * GPS Simulator — Velnari demo
 * Moves 6 units around CDMX Centro Histórico in real-time
 *
 * Usage:
 *   node scripts/simulate-gps.mjs
 *
 * Requirements: API running on http://localhost:3001
 */

const API = 'http://localhost:3001/api';
const UPDATE_INTERVAL_MS = 2000; // location update every 2 seconds

// ── Starting positions around CDMX Centro Histórico ───────────────────────
// Each unit starts at a different point in the city
const UNIT_STARTS = [
  { callSign: 'P-01', lat: 19.4326, lng: -99.1332 },  // Zócalo
  { callSign: 'P-02', lat: 19.4284, lng: -99.1276 },  // Merced
  { callSign: 'P-03', lat: 19.4369, lng: -99.1397 },  // Tlatelolco
  { callSign: 'P-04', lat: 19.4190, lng: -99.1247 },  // Tepito
  { callSign: 'P-05', lat: 19.4420, lng: -99.1210 },  // Guerrero
  { callSign: 'P-06', lat: 19.4260, lng: -99.1450 },  // San Rafael
];

// Random walk speed (degrees per step — approx 50-100m per step)
const STEP = 0.0008;

// ── Auth ──────────────────────────────────────────────────────────────────
async function login() {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@velnari.mx', password: 'Velnari2024!' }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.accessToken;
}

// ── Load units from API ───────────────────────────────────────────────────
async function loadUnits(token) {
  const res = await fetch(`${API}/units`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to load units: ${res.status}`);
  return await res.json();
}

// ── Send location update ──────────────────────────────────────────────────
async function updateLocation(token, unitId, lat, lng) {
  const res = await fetch(`${API}/units/${unitId}/location`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ lat, lng }),
  });
  if (!res.ok && res.status !== 204) {
    console.warn(`  ⚠ location update failed for ${unitId}: ${res.status}`);
  }
}

// ── Random walk ───────────────────────────────────────────────────────────
function randomStep(current) {
  // Bias toward returning to center to keep units in the city
  const center = { lat: 19.4326, lng: -99.1332 };
  const distLat = center.lat - current.lat;
  const distLng = center.lng - current.lng;
  const dist = Math.sqrt(distLat ** 2 + distLng ** 2);

  // If too far from center, pull back
  const bias = dist > 0.02 ? 0.4 : 0;

  const dlat = (Math.random() - 0.5 + distLat * bias) * STEP * 2;
  const dlng = (Math.random() - 0.5 + distLng * bias) * STEP * 2;

  return {
    lat: current.lat + dlat,
    lng: current.lng + dlng,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('🚔 Velnari GPS Simulator');
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
  console.log(`   ✓ Found ${allUnits.length} units\n`);

  if (allUnits.length === 0) {
    console.error('   ❌ No units found. Run: cd apps/api && pnpm db:seed\n');
    process.exit(1);
  }

  // Match API units with starting positions by callSign
  const state = UNIT_STARTS.map((start) => {
    const unit = allUnits.find((u) => u.callSign === start.callSign);
    if (!unit) return null;
    return { id: unit.id, callSign: start.callSign, lat: start.lat, lng: start.lng };
  }).filter(Boolean);

  console.log(`   Simulating ${state.length} units. Press Ctrl+C to stop.\n`);
  state.forEach((u) => console.log(`   📍 ${u.callSign} — ${u.lat.toFixed(4)}, ${u.lng.toFixed(4)}`));
  console.log('');

  // Periodic re-auth (token expires in 15m)
  setInterval(async () => {
    try {
      token = await login();
    } catch {
      // ignore, will retry next interval
    }
  }, 10 * 60 * 1000);

  // Main loop
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
      // Print status every 20 seconds
      const positions = state.map((u) => `${u.callSign}(${u.lat.toFixed(4)},${u.lng.toFixed(4)})`).join('  ');
      console.log(`   [${new Date().toLocaleTimeString('es-MX')}] ${positions}`);
    }
  }, UPDATE_INTERVAL_MS);
}

main();
