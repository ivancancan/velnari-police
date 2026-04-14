// apps/mobile/src/hooks/useNetworkStatus.ts
//
// Connectivity detection strategy:
//
// NetInfo.isInternetReachable is unreliable on iOS — it uses Apple's
// SCNetworkReachability which returns false positives with VPN, MDM profiles,
// carrier-level filtering, and Low Data Mode. We cannot trust it alone.
//
// Instead: do a real HTTP HEAD request to our API every 20s. If the request
// succeeds, we're online. If it times out or errors, we wait one more cycle
// before declaring offline (prevents flashing on a single bad request).
// NetInfo is kept only as a fast "came back online" signal to flush queues.
import { useEffect, useRef, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { flushQueue } from '../lib/offline-queue';
import { flushPhotoQueue } from '../lib/photo-queue';
import { flushLocationQueue } from '../lib/location-queue';

const PING_URL = (process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3001/api') + '/auth/login';
const PING_INTERVAL_MS = 20_000;
const PING_TIMEOUT_MS = 6_000;
// Require two consecutive failures before showing the banner
const FAIL_THRESHOLD = 2;

async function pingServer(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
    // HEAD on /auth/login — fast, no auth needed, always returns 2xx or 4xx (both mean reachable)
    const res = await fetch(PING_URL, { method: 'HEAD', signal: controller.signal });
    clearTimeout(timer);
    return res.status < 500; // 4xx = auth error but server is reachable
  } catch {
    return false;
  }
}

export function useNetworkStatus(): { isConnected: boolean } {
  const [isConnected, setIsConnected] = useState(true);
  const failCount = useRef(0);
  const wasDisconnected = useRef(false);

  const flushQueues = () => {
    void flushQueue().catch(() => {});
    void flushPhotoQueue().catch(() => {});
    void flushLocationQueue().catch(() => {});
  };

  useEffect(() => {
    let cancelled = false;

    async function check() {
      if (cancelled) return;
      const reachable = await pingServer();
      if (cancelled) return;

      if (reachable) {
        failCount.current = 0;
        if (!isConnected || wasDisconnected.current) {
          wasDisconnected.current = false;
          setIsConnected(true);
          flushQueues();
        }
      } else {
        failCount.current += 1;
        if (failCount.current >= FAIL_THRESHOLD) {
          wasDisconnected.current = true;
          setIsConnected(false);
        }
      }
    }

    // Run immediately, then on interval
    void check();
    const interval = setInterval(check, PING_INTERVAL_MS);

    // Also use NetInfo as a fast "back online" trigger to flush queues sooner
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        // Optimistic: run a ping right away to confirm
        void check();
      }
    });

    return () => {
      cancelled = true;
      clearInterval(interval);
      unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { isConnected };
}
