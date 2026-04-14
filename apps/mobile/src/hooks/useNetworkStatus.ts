// apps/mobile/src/hooks/useNetworkStatus.ts
import { useEffect, useRef, useState } from 'react';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { flushQueue } from '../lib/offline-queue';
import { flushPhotoQueue } from '../lib/photo-queue';
import { flushLocationQueue } from '../lib/location-queue';

// Proof-of-offline strategy: NetInfo on iOS is unreliable (reports false
// while actual network is working — happens with VPN, MDM profiles, some
// carriers, Low Data Mode). Trusting it leaks false "Sin conexión" banners.
//
// We combine two signals instead:
//  1. NetInfo MUST say isConnected === false AND isInternetReachable === false
//     (both false, not just one — eliminates 90% of false positives)
//  2. AND the state must persist for 15 seconds before we trust it
//
// When connectivity is restored (either signal flips), queues flush and the
// banner hides instantly — no debounce on the "back online" transition.
const OFFLINE_CONFIRM_MS = 15_000;

function definitelyOffline(state: NetInfoState): boolean {
  // Only treat as offline when BOTH signals say no internet. A nullish
  // isInternetReachable is iOS still warming up — never trust it as proof.
  return state.isConnected === false && state.isInternetReachable === false;
}

export function useNetworkStatus(): { isConnected: boolean } {
  const [isConnected, setIsConnected] = useState(true);
  const wasDisconnected = useRef(false);
  const offlineTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clearOfflineTimer = (): void => {
      if (offlineTimer.current) {
        clearTimeout(offlineTimer.current);
        offlineTimer.current = null;
      }
    };

    const applyState = (state: NetInfoState): void => {
      if (!definitelyOffline(state)) {
        // Any positive signal = treat as online immediately. Kill any
        // pending "go offline" timer so transient dips never flash the banner.
        clearOfflineTimer();
        setIsConnected(true);
        if (wasDisconnected.current) {
          wasDisconnected.current = false;
          void flushQueue().catch(() => {});
          void flushPhotoQueue().catch(() => {});
          void flushLocationQueue().catch(() => {});
        }
        return;
      }

      // Both signals say offline — but wait 15s before trusting it. The
      // banner is only worth showing if connectivity is *sustainably* down.
      if (!offlineTimer.current) {
        offlineTimer.current = setTimeout(() => {
          offlineTimer.current = null;
          setIsConnected(false);
          wasDisconnected.current = true;
        }, OFFLINE_CONFIRM_MS);
      }
    };

    NetInfo.fetch().then(applyState);
    const unsubscribe = NetInfo.addEventListener(applyState);

    return () => {
      unsubscribe();
      clearOfflineTimer();
    };
  }, []);

  return { isConnected };
}
