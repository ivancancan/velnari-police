'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth.store';
import {
  Users, Truck, AlertTriangle, Map, BarChart2, FileText, LogOut, ArrowLeft, Shield, Clock, ClipboardList, Menu, X,
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) { router.push('/login'); return; }
    if (user?.role !== 'admin') { router.push('/command'); return; }
  }, [isAuthenticated, user, router]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  if (!isAuthenticated || user?.role !== 'admin') return null;

  return (
    <div className="flex flex-col lg:flex-row h-[100dvh] bg-gray-50 font-sans">
      {/* Mobile top bar */}
      <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 shrink-0">
        <button
          onClick={() => setMobileNavOpen(true)}
          aria-label="Abrir menú"
          className="w-10 h-10 flex items-center justify-center rounded-md border border-gray-200 text-gray-700 active:bg-gray-100"
        >
          <Menu size={18} />
        </button>
        <div className="flex items-center gap-2">
          <Shield size={16} className="text-blue-600" />
          <span className="font-semibold text-gray-900 text-sm">Velnari Admin</span>
        </div>
        <Link href="/command" className="text-xs text-gray-500 px-2 py-1">Mapa</Link>
      </header>

      {/* Mobile overlay */}
      {mobileNavOpen && (
        <div className="lg:hidden fixed inset-0 z-50" onClick={() => setMobileNavOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
        </div>
      )}

      {/* Sidebar */}
      <aside
        className={`
          bg-white border-r border-gray-200 flex-shrink-0 flex flex-col
          lg:w-56 lg:static lg:translate-x-0
          fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] transition-transform duration-300
          ${mobileNavOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Mobile close button */}
        <button
          onClick={() => setMobileNavOpen(false)}
          aria-label="Cerrar menú"
          className="lg:hidden absolute top-3 right-3 w-9 h-9 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-100"
        >
          <X size={18} />
        </button>
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
