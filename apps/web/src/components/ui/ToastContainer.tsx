'use client';

import { useEffect } from 'react';
import { useAlertsStore } from '@/store/alerts.store';
import Toast from './Toast';

const AUTO_DISMISS_MS: Record<string, number> = {
  critical: 15000,
  high: 10000,
  geofence: 12000,
  stale: 12000,
};
const DEFAULT_DISMISS_MS = 8000;

export default function ToastContainer() {
  const { alerts, dismissAlert } = useAlertsStore();

  useEffect(() => {
    if (alerts.length === 0) return;
    const oldest = alerts[0]!;
    const dismissMs = AUTO_DISMISS_MS[oldest.priority] ?? DEFAULT_DISMISS_MS;
    const age = Date.now() - oldest.createdAt;
    const remaining = Math.max(0, dismissMs - age);
    const timer = setTimeout(() => dismissAlert(oldest.id), remaining);
    return () => clearTimeout(timer);
  }, [alerts, dismissAlert]);

  if (alerts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 lg:right-6 2xl:right-8 z-50 flex flex-col gap-2 pointer-events-none max-w-[calc(100vw-2rem)]">
      {alerts.map((alert) => (
        <div key={alert.id} className="pointer-events-auto">
          <Toast
            id={alert.id}
            folio={alert.folio}
            message={alert.message}
            priority={alert.priority}
            onDismiss={dismissAlert}
          />
        </div>
      ))}
    </div>
  );
}
