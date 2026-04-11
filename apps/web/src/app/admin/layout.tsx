'use client';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth.store';
import {
  Users, Truck, AlertTriangle, Map, BarChart2, FileText, LogOut, ArrowLeft, Shield, Clock, ClipboardList,
} from 'lucide-react';

const NAV = [
  {
    section: 'Operaciones',
    items: [
      { label: 'Usuarios', href: '/admin', icon: Users },
      { label: 'Unidades', href: '/admin/units', icon: Truck },
      { label: 'Turnos', href: '/admin/shifts', icon: Clock },
      { label: 'Entrega de Turno', href: '/admin/handoff', icon: ClipboardList },
    ],
  },
  {
    section: 'Configuración',
    items: [
      { label: 'Tipos de Incidente', href: '/admin/incident-types', icon: AlertTriangle },
      { label: 'Sectores', href: '/admin/sectors', icon: Map },
      { label: 'Municipios', href: '/admin/municipios', icon: Shield },
    ],
  },
  {
    section: 'Reportes',
    items: [
      { label: 'Anal\u00edtica', href: '/admin/analytics', icon: BarChart2 },
      { label: 'Reportes', href: '/admin/reports', icon: BarChart2 },
      { label: 'Desempe\u00f1o', href: '/admin/scoreboard', icon: BarChart2 },
      { label: 'Audit Log', href: '/admin/audit', icon: FileText },
      { label: 'Constructor de Reportes', href: '/admin/report-builder', icon: FileText },
      { label: 'Exportar Incidentes', href: '/admin/reports/export', icon: FileText },
    ],
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user, clearAuth } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isAuthenticated) { router.push('/login'); return; }
    if (user?.role !== 'admin') { router.push('/command'); return; }
  }, [isAuthenticated, user, router]);

  if (!isAuthenticated || user?.role !== 'admin') return null;

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-200 flex-shrink-0 flex flex-col">
        {/* Brand */}
        <div className="px-5 py-4 border-b-2 border-blue-600 bg-gradient-to-b from-blue-50/60 to-white">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-blue-600" />
            <span className="font-semibold text-gray-900 text-sm tracking-tight">Velnari Admin</span>
          </div>
          <p className="text-xs text-gray-400 mt-1.5 pl-6 truncate">{user?.name}</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {NAV.map(({ section, items }, sectionIdx) => (
            <div key={section}>
              {sectionIdx > 0 && <div className="mx-2 my-3 border-t border-gray-100" />}
              <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-widest mb-1.5 px-2">
                {section}
              </p>
              {items.map(({ label, href, icon: Icon }) => {
                const active = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm transition-all duration-150 ${
                      active
                        ? 'bg-blue-50 text-blue-700 font-medium border-l-[3px] border-blue-600 pl-2'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-l-[3px] border-transparent'
                    }`}
                  >
                    <Icon size={14} className={active ? 'text-blue-600' : 'text-gray-400'} />
                    {label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-gray-200 space-y-1 mt-auto">
          <Link
            href="/command"
            className="flex items-center gap-2 px-2.5 py-1.5 text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
          >
            <ArrowLeft size={13} />
            Centro de Mando
          </Link>
          <button
            onClick={clearAuth}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
          >
            <LogOut size={13} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 overflow-y-auto min-w-0">
        {children}
      </div>
    </div>
  );
}
