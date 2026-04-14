import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { getQueueSize } from '@/lib/offline-queue';

// Keys for AsyncStorage-backed queues
const ASYNC_QUEUE_KEYS = ['velnari_photo_queue', 'velnari_location_queue'];

async function getPendingCount(): Promise<number> {
  try {
    const [secureCount, asyncValues] = await Promise.all([
      getQueueSize(),
      AsyncStorage.multiGet(ASYNC_QUEUE_KEYS),
    ]);
    let total = secureCount;
    for (const [, value] of asyncValues) {
      if (!value) continue;
      const parsed = JSON.parse(value) as unknown[];
      if (Array.isArray(parsed)) total += parsed.length;
    }
    return total;
  } catch {
    return 0;
  }
}

export default function OfflineBanner() {
  const { isConnected } = useNetworkStatus();
  const insets = useSafeAreaInsets();
  const [pendingCount, setPendingCount] = useState(0);
  // Start above the screen by (notch height + banner height) so it slides
  // down cleanly onto the safe area when offline is confirmed.
  const slideAnim = useRef(new Animated.Value(-80)).current;

  useEffect(() => {
    if (!isConnected) {
      getPendingCount().then(setPendingCount);
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
    } else {
      Animated.timing(slideAnim, { toValue: -80, useNativeDriver: true, duration: 200 }).start();
    }
  }, [isConnected, slideAnim]);

  // Refresh count every 5s while offline
  useEffect(() => {
    if (isConnected) return;
    const interval = setInterval(() => {
      getPendingCount().then(setPendingCount);
    }, 5000);
    return () => clearInterval(interval);
  }, [isConnected]);

  // Safe-area-top respects iPhone notch / Dynamic Island so the banner
  // never gets clipped under the status bar. +8pt for comfortable padding.
  const topPadding = Math.max(insets.top, 20) + 8;

  return (
    <Animated.View
      style={[
        styles.banner,
        { transform: [{ translateY: slideAnim }], paddingTop: topPadding },
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.inner}>
        <Text style={styles.dot}>●</Text>
        <Text style={styles.text}>
          Sin conexión
          {pendingCount > 0 ? ` · ${pendingCount} pendiente${pendingCount !== 1 ? 's' : ''}` : ''}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    backgroundColor: '#F59E0B',
    paddingBottom: 10,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 6,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    color: '#78350F',
    fontSize: 10,
  },
  text: {
    color: '#78350F',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
