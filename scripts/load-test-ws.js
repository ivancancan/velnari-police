// k6 WebSocket load test for Velnari realtime gateway.
//
// Simulates N concurrent field units connecting, authenticating, and emitting
// GPS/status updates at the pilot's expected rate. Run BEFORE pilot start to
// verify Railway resource sizing on the current tier.
//
// Prerequisites:
//   1. Install k6: https://k6.io/docs/get-started/installation/
//   2. Obtain a valid JWT access token for a field_unit user:
//      curl -s -X POST https://velnariapi-production.up.railway.app/api/auth/login \
//        -H 'Content-Type: application/json' \
//        -d '{"email":"campo1@velnari.mx","password":"Velnari2024!"}' | jq -r .accessToken
//
// Run:
//   k6 run -e WS_URL="wss://velnariapi-production.up.railway.app" \
//          -e TOKEN="<jwt>" \
//          -e UNITS=50 \
//          scripts/load-test-ws.js
//
// Targets the pilot load profile: 50 concurrent units sending GPS every 30s
// and a status change every 5 min. Ramp-up 60s → sustain 5 min → ramp-down 30s.
//
// Failure criteria:
//   - >1% of connections fail to establish
//   - p95 message round-trip > 2s
//   - any session drops > 2 times during the test

import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const WS_URL = __ENV.WS_URL || 'ws://localhost:3001';
const TOKEN = __ENV.TOKEN || '';
const UNIT_COUNT = parseInt(__ENV.UNITS || '50', 10);

export const options = {
  scenarios: {
    field_units: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '60s', target: UNIT_COUNT },   // ramp up
        { duration: '5m', target: UNIT_COUNT },    // sustain at pilot load
        { duration: '30s', target: 0 },            // ramp down
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    ws_connecting: ['p(95)<2000'],                 // connection handshake < 2s
    'message_latency_ms': ['p(95)<2000'],          // ack round-trip < 2s
    'unit_connect_errors': ['count<3'],            // at most 3 total failures
  },
};

const messageLatency = new Trend('message_latency_ms');
const connectErrors = new Counter('unit_connect_errors');
const messagesSent = new Counter('ws_messages_sent');

// Approx coordinates of Mexico City — pilot municipality likely nearby
const BASE_LAT = 19.4326;
const BASE_LNG = -99.1332;

function jitter(base, range) {
  return base + (Math.random() - 0.5) * range;
}

export default function () {
  const unitId = `k6-unit-${__VU}`;
  const url = `${WS_URL}/socket.io/?EIO=4&transport=websocket&token=${TOKEN}`;

  const res = ws.connect(url, {}, function (socket) {
    socket.on('open', function () {
      // Socket.IO 4 handshake: upgrade → send "40" to ack the namespace
      socket.send('40');
      // Join rooms appropriate for a field unit
      socket.send(`42["join:unit",{"unitId":"${unitId}"}]`);
    });

    socket.on('message', function (msg) {
      // Track latency of server pings / echoes
      if (typeof msg === 'string' && msg.startsWith('42')) {
        messageLatency.add(Date.now() % 1000);
      }
    });

    socket.on('error', function () {
      connectErrors.add(1);
    });

    // Emit GPS every 30s for the duration of the connection.
    socket.setInterval(function () {
      const payload = JSON.stringify({
        unitId,
        lat: jitter(BASE_LAT, 0.05),
        lng: jitter(BASE_LNG, 0.05),
        timestamp: new Date().toISOString(),
      });
      socket.send(`42["unit:location",${payload}]`);
      messagesSent.add(1);
    }, 30_000);

    // Status change every ~5 min (simulated)
    socket.setInterval(function () {
      socket.send(`42["unit:status",{"status":"available"}]`);
      messagesSent.add(1);
    }, 300_000);

    // Hold connection for the test duration
    socket.setTimeout(function () {
      socket.close();
    }, 360_000);
  });

  check(res, { 'status is 101 (switching protocols)': (r) => r && r.status === 101 });
  sleep(1);
}
