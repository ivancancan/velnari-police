'use client';

import { useState } from 'react';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  OPEN: { label: 'Reportado', color: 'text-blue-400' },
  ASSIGNED: { label: 'Asignado', color: 'text-amber-400' },
  EN_ROUTE: { label: 'En camino', color: 'text-amber-400' },
  ON_SCENE: { label: 'En atención', color: 'text-green-400' },
  CLOSED: { label: 'Resuelto', color: 'text-slate-400' },
};

const PRIORITY_LABELS: Record<string, string> = {
  CRITICAL: 'Crítica',
  HIGH: 'Alta',
  MEDIUM: 'Media',
  LOW: 'Baja',
};

interface TrackingResult {
  folio: string;
  status: string;
  type: string;
  priority: string;
  createdAt: string;
  assignedAt: string | null;
  closedAt: string | null;
  resolution: string | null;
}

export default function SeguimientoPage() {
  const [token, setToken] = useState('');
  const [result, setResult] = useState<TrackingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!token.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/api/incidents/track/${token.trim().toUpperCase()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? 'Reporte no encontrado. Verifica tu código de seguimiento.');
        return;
      }
      setResult(await res.json());
    } catch {
      setError('Error de conexión. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  const steps = ['OPEN', 'ASSIGNED', 'ON_SCENE', 'CLOSED'];

  return (
    <main className="min-h-screen bg-[#0F172A] text-[#F8FAFC] flex flex-col items-center justify-start px-4 py-16">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-10 text-center">
          <h1 className="text-2xl font-bold text-[#F8FAFC] tracking-tight mb-2">Seguimiento de Reporte</h1>
          <p className="text-[#64748B] text-sm">Ingresa el código que recibiste al hacer tu reporte para conocer su estado.</p>
        </div>

        {/* Search form */}
        <form onSubmit={handleSearch} className="flex gap-3 mb-8">
          <input
            type="text"
            value={token}
            onChange={(e) => setToken(e.target.value.toUpperCase())}
            placeholder="Ej. AB3K7MNP"
            maxLength={8}
            className="flex-1 bg-[#1E293B] border border-[#334155] rounded-lg px-4 py-3 text-[#F8FAFC] font-mono text-lg tracking-widest placeholder:text-[#475569] focus:outline-none focus:border-[#3B82F6]"
          />
          <button
            type="submit"
            disabled={loading || token.length < 8}
            className="px-6 py-3 bg-[#3B82F6] hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-semibold text-sm transition-colors"
          >
            {loading ? '...' : 'Buscar'}
          </button>
        </form>

        {/* Error */}
        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg px-4 py-3 text-red-300 text-sm mb-6">
            {error}
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-6 space-y-6">
            {/* Folio + status */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-[#64748B] uppercase tracking-wider">Folio</p>
                <p className="font-mono text-lg font-bold">{result.folio}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-[#64748B] uppercase tracking-wider">Estado</p>
                <p className={`font-semibold ${STATUS_LABELS[result.status]?.color ?? 'text-white'}`}>
                  {STATUS_LABELS[result.status]?.label ?? result.status}
                </p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="flex gap-1">
              {steps.map((step, i) => {
                const currentIdx = steps.indexOf(result.status);
                const isActive = i <= currentIdx || (result.status === 'EN_ROUTE' && i <= 1);
                return (
                  <div
                    key={step}
                    className={`h-1.5 flex-1 rounded-full transition-colors ${isActive ? 'bg-[#3B82F6]' : 'bg-[#334155]'}`}
                  />
                );
              })}
            </div>
            <div className="flex justify-between text-xs text-[#64748B]">
              <span>Reportado</span>
              <span>Asignado</span>
              <span>En atención</span>
              <span>Resuelto</span>
            </div>

            {/* Details */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-[#64748B] mb-1">Tipo</p>
                <p>{result.type}</p>
              </div>
              <div>
                <p className="text-xs text-[#64748B] mb-1">Prioridad</p>
                <p>{PRIORITY_LABELS[result.priority] ?? result.priority}</p>
              </div>
              <div>
                <p className="text-xs text-[#64748B] mb-1">Reportado</p>
                <p>{new Date(result.createdAt).toLocaleString('es-MX')}</p>
              </div>
              {result.assignedAt && (
                <div>
                  <p className="text-xs text-[#64748B] mb-1">Asignado</p>
                  <p>{new Date(result.assignedAt).toLocaleString('es-MX')}</p>
                </div>
              )}
              {result.closedAt && (
                <div>
                  <p className="text-xs text-[#64748B] mb-1">Resuelto</p>
                  <p>{new Date(result.closedAt).toLocaleString('es-MX')}</p>
                </div>
              )}
              {result.resolution && (
                <div className="col-span-2">
                  <p className="text-xs text-[#64748B] mb-1">Resolución</p>
                  <p className="text-[#94A3B8]">{result.resolution}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
