// apps/mobile/src/hooks/useNetworkStatus.ts
import { useEffect, useRef, useState } from 'react';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { flushQueue } from '../lib/offline-queue';
import { flushPhotoQueue } from '../lib/photo-queue';
import { flushLocationQueue } from '../lib/location-queue';

export function useNetworkStatus(): { isConnected: boolean } {
  const [isConnected, setIsConnected] = useState(true);
  const wasDisconnected = useRef(false);

  useEffect(() => {
    // Get current state immediately
    NetInfo.fetch().then((state: NetInfoState) => {
      const connected = state.isConnected ?? true;
      setIsConnected(connected);
      if (!connected) wasDisconnected.current = true;
    });

    // Subscribe to future changes
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const connected = state.isConnected ?? true;
      setIsConnected(connected);

      // Auto-flush all queues when connectivity is restored
      if (connected && wasDisconnected.current) {
        wasDisconnected.current = false;
        void flushQueue().catch(() => {});
        void flushPhotoQueue().catch(() => {});
        void flushLocationQueue().catch(() => {});
      }

      if (!connected) {
        wasDisconnected.current = true;
      }
    });

    return unsubscribe;
  }, []);

  return { isConnected };
}
