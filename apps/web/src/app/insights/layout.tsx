'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';

const ALLOWED_ROLES = ['admin', 'commander', 'supervisor'];

export default function InsightsLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) { router.push('/login'); return; }
    if (!ALLOWED_ROLES.includes(user?.role ?? '')) { router.push('/command'); }
  }, [isAuthenticated, user, router]);

  if (!isAuthenticated || !ALLOWED_ROLES.includes(user?.role ?? '')) return null;

  return <>{children}</>;
}
