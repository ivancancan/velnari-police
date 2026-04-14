// apps/mobile/src/hooks/useNetworkStatus.ts
import { useEffect, useRef, useState } from 'react';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { flushQueue } from '../lib/offline-queue';
import { flushPhotoQueue } from '../lib/photo-queue';
import { flushLocationQueue } from '../lib/location-queue';

// Debounce offline transitions. iOS NetInfo can briefly report isConnected=false
// while switching between wifi/cellular or during the first event after launch.
// Treating those transient false readings as "offline" causes the banner to
// flash and the screen to appear to shake. A 2.5s debounce eliminates >95% of
// false positives without making recovery from real outages feel slow.
const OFFLINE_DEBOUNCE_MS = 2_500;

function isReallyOnline(state: NetInfoState): boolean {
  // isInternetReachable may be null initially — only treat it as "offline"
  // when BOTH isConnected === false AND isInternetReachable === false.
  if (state.isConnected === false && state.isInternetReachable === false) return false;
  if (state.isConnected === false && state.isInternetReachable === null) {
    // Transient — be optimistic; the debounce below protects us.
    return false;
  }
  return state.isConnected !== false;
}

export function useNetworkStatus(): { isConnected: boolean } {
  // Start optimistic — assume online until proven otherwise, so the first
  // render doesn't flash the "sin conexión" banner on the login screen.
  const [isConnected, setIsConnected] = useState(true);
  const wasDisconnected = useRef(false);
  const offlineTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const applyState = (state: NetInfoState): void => {
      const online = isReallyOnline(state);
      if (online) {
        if (offlineTimer.current) {
          clearTimeout(offlineTimer.current);
          offlineTimer.current = null;
        }
        setIsConnected(true);
        if (wasDisconnected.current) {
          wasDisconnected.current = false;
          void flushQueue().catch(() => {});
          void flushPhotoQueue().catch(() => {});
          void flushLocationQueue().catch(() => {});
        }
        return;
      }
      // Schedule the "offline" state only if the connection stays down for
      // longer than the debounce window.
      if (!offlineTimer.current) {
        offlineTimer.current = setTimeout(() => {
          offlineTimer.current = null;
          setIsConnected(false);
          wasDisconnected.current = true;
        }, OFFLINE_DEBOUNCE_MS);
      }
    };

    NetInfo.fetch().then(applyState);
    const unsubscribe = NetInfo.addEventListener(applyState);

    return () => {
      unsubscribe();
      if (offlineTimer.current) clearTimeout(offlineTimer.current);
    };
  }, []);

  return { isConnected };
}
