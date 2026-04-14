// apps/mobile/src/hooks/useNetworkStatus.ts
//
// Offline detection designed for field operations, not a coffee shop.
// Officers go genuinely offline in rural/underground areas for minutes
// at a time — the banner should only appear then, not on a slow API
// cold-start or a 3-second cellular handoff.
//
// Strategy:
//  1. 30-second startup grace — never show the banner right after login.
//     Railway cold-start, cellular attach, and VPN startup all happen here.
//  2. After grace: ping the API every 25s. Need 3 consecutive failures
//     (~75 seconds of no response) before showing the banner.
//  3. Single success clears the counter and hides the banner immediately.
//  4. NetInfo kept as a fast "came back online" trigger to flush queues.
import { useEffect, useRef, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { flushQueue } from '../lib/offline-queue';
import { flushPhotoQueue } from '../lib/photo-queue';
import { flushLocationQueue } from '../lib/location-queue';

const API_BASE = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3001/api';
const PING_URL = `${API_BASE}/units/stats`;  // GET, returns 401 but server IS reachable
const STARTUP_GRACE_MS = 30_000;
const PING_INTERVAL_MS = 25_000;
const PING_TIMEOUT_MS  =  8_000;
const FAIL_THRESHOLD   = 3;       // 3 × 25s ≈ 75s of sustained failure

async function pingServer(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
    const res = await fetch(PING_URL, { method: 'GET', signal: controller.signal });
    clearTimeout(timer);
    return res.status > 0; // any HTTP response = network works
  } catch {
    return false;
  }
}

export function useNetworkStatus(): { isConnected: boolean } {
  const [isConnected, setIsConnected] = useState(true);
  const failCount  = useRef(0);
  const wasOffline = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const flushQueues = () => {
    void flushQueue().catch(() => {});
    void flushPhotoQueue().catch(() => {});
    void flushLocationQueue().catch(() => {});
  };

  useEffect(() => {
    let cancelled = false;

    async function check() {
      if (cancelled) return;
      const ok = await pingServer();
      if (cancelled) return;
      if (ok) {
        failCount.current = 0;
        if (wasOffline.current) {
          wasOffline.current = false;
          setIsConnected(true);
          flushQueues();
        }
      } else {
        failCount.current += 1;
        if (failCount.current >= FAIL_THRESHOLD) {
          wasOffline.current = true;
          setIsConnected(false);
        }
      }
    }

    // Grace period: don't ping at all for the first 30s
    const grace = setTimeout(() => {
      if (cancelled) return;
      void check();
      intervalRef.current = setInterval(() => { void check(); }, PING_INTERVAL_MS);
    }, STARTUP_GRACE_MS);

    // NetInfo: fast wake-up signal when coming back online
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false && wasOffline.current) {
        void check();
      }
    });

    return () => {
      cancelled = true;
      clearTimeout(grace);
      if (intervalRef.current) clearInterval(intervalRef.current);
      unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { isConnected };
}
