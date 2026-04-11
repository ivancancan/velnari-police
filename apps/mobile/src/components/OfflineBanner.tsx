import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

// These keys match the constants in offline-queue.ts, photo-queue.ts, location-queue.ts
const QUEUE_KEYS = ['velnari_offline_queue', 'velnari_photo_queue', 'velnari_location_queue'];

async function getPendingCount(): Promise<number> {
  try {
    const values = await AsyncStorage.multiGet(QUEUE_KEYS);
    let total = 0;
    for (const [, value] of values) {
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
  const [pendingCount, setPendingCount] = useState(0);
  const slideAnim = useRef(new Animated.Value(-48)).current;

  useEffect(() => {
    if (!isConnected) {
      getPendingCount().then(setPendingCount);
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
    } else {
      Animated.timing(slideAnim, { toValue: -48, useNativeDriver: true, duration: 200 }).start();
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

  return (
    <Animated.View style={[styles.banner, { transform: [{ translateY: slideAnim }] }]}>
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
    paddingTop: 44, // safe area offset — covers status bar on iPhone
    paddingBottom: 8,
    paddingHorizontal: 16,
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
