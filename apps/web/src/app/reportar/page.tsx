'use client';
import { useState } from 'react';
import * as React from 'react';
import Link from 'next/link';

const TYPES = [
  { value: 'robbery', label: 'Robo' },
  { value: 'assault', label: 'Agresion' },
  { value: 'traffic', label: 'Accidente vial' },
  { value: 'noise', label: 'Ruido / alteracion' },
  { value: 'domestic', label: 'Violencia domestica' },
  { value: 'missing_person', label: 'Persona desaparecida' },
  { value: 'other', label: 'Otro' },
];

export default function CitizenReportPage() {
  const [type, setType] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [loadingGps, setLoadingGps] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ folio: string } | null>(null);
  const [error, setError] = useState('');

  async function getLocation() {
    setLoadingGps(true);
    setError('');
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true }),
      );
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch {
      setError('No se pudo obtener la ubicacion. Verifica los permisos de tu navegador.');
    } finally {
      setLoadingGps(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!type || !description.trim() || description.trim().length < 10) return;
    setSubmitting(true);
    setError('');
    try {
      const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/api';
      const res = await fetch(`${API_URL}/incidents/public-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          description: description.trim(),
          address: address.trim() || undefined,
          lat: coords?.lat ?? 19.4326,
          lng: coords?.lng ?? -99.1332,
        }),
      });
      if (!res.ok) throw new Error('Error del servidor');
      const data = await res.json();
      setResult({ folio: data.folio });
    } catch {
      setError('Error al enviar el reporte. Intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setType('');
    setDescription('');
    setAddress('');
    setCoords(null);
    setResult(null);
    setError('');
  }

  const isValid = type && description.trim().length >= 10;

  return (
    <div className="min-h-screen bg-[#0F172A] text-[#F8FAFC] flex flex-col relative overflow-hidden">
      {/* Background decorations */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -right-32 w-[400px] h-[400px] rounded-full bg-[#3B82F6]/10 blur-[120px]" />
        <div className="absolute -bottom-32 -left-32 w-[300px] h-[300px] rounded-full bg-purple-600/8 blur-[100px]" />
      </div>

      {/* Subtle dot pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: 'radial-gradient(circle, #F8FAFC 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Header */}
      <header className="relative z-10 border-b border-white/5 px-6 py-4 backdrop-blur-sm">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#3B82F6] to-blue-700 flex items-center justify-center font-bold text-sm shadow-lg shadow-[#3B82F6]/25">
              V
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight group-hover:text-[#3B82F6] transition-colors">Velnari</h1>
              <p className="text-xs text-[#64748B]">Reporte Ciudadano</p>
            </div>
          </Link>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-xs text-[#64748B]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            En linea
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="relative z-10 flex-1 px-6 py-8">
        <div className="max-w-lg mx-auto">
          {result ? (
            /* Success state */
            <div className="text-center space-y-6 py-8">
              {/* Success glow effect */}
              <div className="relative inline-block">
                <div className="absolute inset-0 w-24 h-24 rounded-full bg-emerald-500/20 blur-xl mx-auto" />
                <div className="relative w-20 h-20 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
                  <svg
                    className="w-10 h-10 text-emerald-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              <div>
                <h2 className="text-2xl font-bold mb-2 tracking-tight">Tu reporte fue recibido</h2>
                <p className="text-[#94A3B8] text-sm leading-relaxed">
                  Un operador del centro de mando revisara tu reporte.<br />
                  Guarda tu folio para dar seguimiento.
                </p>
              </div>
              <div className="bg-white/[0.04] border border-white/[0.08] backdrop-blur-sm rounded-2xl p-6 inline-block">
                <p className="text-xs text-[#64748B] mb-2 uppercase tracking-widest font-medium">Folio de seguimiento</p>
                <p className="text-3xl font-mono font-bold bg-gradient-to-r from-[#3B82F6] to-cyan-400 bg-clip-text text-transparent">{result.folio}</p>
              </div>
              <div className="pt-2">
                <button
                  onClick={reset}
                  className="px-8 py-3 bg-white/[0.05] hover:bg-white/[0.10] border border-white/10 hover:border-white/20 text-sm font-medium rounded-xl transition-all hover:-translate-y-0.5"
                >
                  Reportar otro incidente
                </button>
              </div>
            </div>
          ) : (
            /* Form */
            <div className="bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm rounded-2xl p-6 md:p-8 shadow-2xl shadow-black/20">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="mb-2">
                  <h2 className="text-xl font-bold mb-1 tracking-tight">Reportar un incidente</h2>
                  <p className="text-sm text-[#64748B] leading-relaxed">
                    Completa la informacion para enviar tu reporte al centro de mando.
                  </p>
                </div>

                {/* Type selector */}
                <div>
                  <label className="block text-sm font-medium text-[#94A3B8] mb-2">
                    Tipo de incidente <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/30 focus:border-[#3B82F6]/50 appearance-none transition-all"
                  >
                    <option value="" disabled>
                      Selecciona un tipo
                    </option>
                    {TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-[#94A3B8] mb-2">
                    Descripcion <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe lo que sucedio (minimo 10 caracteres)"
                    rows={4}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-[#F8FAFC] placeholder-[#475569] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/30 focus:border-[#3B82F6]/50 resize-none transition-all"
                  />
                  {description.length > 0 && description.trim().length < 10 && (
                    <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1">
                      <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                      Minimo 10 caracteres
                    </p>
                  )}
                </div>

                {/* Address */}
                <div>
                  <label className="block text-sm font-medium text-[#94A3B8] mb-2">
                    Direccion o referencia
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Calle, colonia, referencia..."
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-[#F8FAFC] placeholder-[#475569] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/30 focus:border-[#3B82F6]/50 transition-all"
                  />
                </div>

                {/* Location button */}
                <div>
                  <button
                    type="button"
                    onClick={getLocation}
                    disabled={loadingGps}
                    className="flex items-center gap-2 px-5 py-2.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/[0.15] rounded-xl text-sm transition-all disabled:opacity-50"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    {loadingGps ? 'Obteniendo ubicacion...' : 'Compartir mi ubicacion'}
                  </button>
                  {coords && (
                    <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                      Ubicacion obtenida ({coords.lat.toFixed(4)}, {coords.lng.toFixed(4)})
                    </p>
                  )}
                </div>

                {/* Error */}
                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 backdrop-blur-sm">
                    <p className="text-sm text-red-400 flex items-center gap-2">
                      <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                      {error}
                    </p>
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={!isValid || submitting}
                  className="w-full py-3.5 bg-gradient-to-r from-[#3B82F6] to-blue-600 hover:from-blue-500 hover:to-blue-700 disabled:from-[#3B82F6]/30 disabled:to-blue-600/30 disabled:cursor-not-allowed text-sm font-semibold rounded-xl transition-all shadow-lg shadow-[#3B82F6]/20 hover:shadow-xl hover:shadow-[#3B82F6]/30 disabled:shadow-none hover:-translate-y-0.5 disabled:hover:translate-y-0"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Enviando...
                    </span>
                  ) : (
                    'Enviar reporte'
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 px-6 py-4">
        <p className="text-center text-xs text-[#475569]">
          Tu reporte sera revisado por un operador del centro de mando.
        </p>
      </footer>
    </div>
  );
}
