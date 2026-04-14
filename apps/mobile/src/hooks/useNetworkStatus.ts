// apps/mobile/src/hooks/useNetworkStatus.ts
//
// TODO: re-enable real offline detection post-demo.
// NetInfo.isInternetReachable is unreliable on iOS and ping-based detection
// was triggering false positives against the Railway API (cold starts + 8s
// timeout = false failures). Stubbed to always-online for now; queues still
// flush via the NetInfo listener so offline writes are not lost.
import { useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { flushQueue } from '../lib/offline-queue';
import { flushPhotoQueue } from '../lib/photo-queue';
import { flushLocationQueue } from '../lib/location-queue';

export function useNetworkStatus(): { isConnected: boolean } {
  console.log('[useNetworkStatus] stub — always online');
  useEffect(() => {
    // Still flush queued writes when connectivity is restored
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        void flushQueue().catch(() => {});
        void flushPhotoQueue().catch(() => {});
        void flushLocationQueue().catch(() => {});
      }
    });
    return unsubscribe;
  }, []);

  return { isConnected: true };
}
