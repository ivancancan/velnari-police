'use client';

import { useEffect } from 'react';
import { useAlertsStore } from '@/store/alerts.store';
import Toast from './Toast';

const AUTO_DISMISS_MS = 8000;

export default function ToastContainer() {
  const { alerts, dismissAlert } = useAlertsStore();

  useEffect(() => {
    if (alerts.length === 0) return;
    const oldest = alerts[0]!;
    const age = Date.now() - oldest.createdAt;
    const remaining = Math.max(0, AUTO_DISMISS_MS - age);
    const timer = setTimeout(() => dismissAlert(oldest.id), remaining);
    return () => clearTimeout(timer);
  }, [alerts, dismissAlert]);

  if (alerts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
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
