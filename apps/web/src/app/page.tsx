'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

function AnimatedCounter({ end, suffix = '', prefix = '', duration = 2000 }: {
  end: number; suffix?: string; prefix?: string; duration?: number;
}) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !started) {
          setStarted(true);
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [started]);

  useEffect(() => {
    if (!started) return;
    const startTime = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * end));
      if (progress >= 1) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [started, end, duration]);

  return <span ref={ref}>{prefix}{count}{suffix}</span>;
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-midnight-command overflow-hidden">
      {/* Aurora gradient blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-tactical-blue/20 blur-[128px]" />
        <div className="absolute -top-20 left-1/2 w-[500px] h-[500px] rounded-full bg-purple-600/15 blur-[128px]" />
        <div className="absolute top-40 -right-40 w-[400px] h-[400px] rounded-full bg-cyan-500/10 blur-[128px]" />
      </div>

      {/* Nav */}
      <header className="relative z-10 flex items-center justify-between px-8 py-4 border-b border-white/5 backdrop-blur-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-gradient-to-br from-tactical-blue to-blue-700 rounded-lg flex items-center justify-center shadow-lg shadow-tactical-blue/25">
            <span className="text-white font-bold text-sm">V</span>
          </div>
          <span className="text-signal-white font-bold text-lg tracking-tight">Velnari</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/ayuda" className="text-sm text-slate-400 hover:text-white transition-colors">
            Manual de uso
          </Link>
          <Link
            href="/login"
            className="px-6 py-2.5 bg-white/5 hover:bg-white/10 text-signal-white text-sm font-medium rounded-lg transition-all border border-white/10 hover:border-white/20"
          >
            Acceder
          </Link>
        </div>
      </header>

      <main className="relative z-10 max-w-5xl mx-auto px-8 py-24">
        {/* Hero */}
        <div className="text-center mb-20">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-tactical-blue/30 bg-tactical-blue/10 text-tactical-blue text-xs font-medium mb-6 backdrop-blur-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-tactical-blue animate-pulse" />
            Public Safety Tech para municipios de Mexico
          </div>
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-signal-white leading-[1.1] mb-6 tracking-tight">
            El sistema operativo de la<br/>
            <span className="bg-gradient-to-r from-tactical-blue via-cyan-400 to-blue-400 bg-clip-text text-transparent">seguridad municipal</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Claridad en el despliegue, precision en la respuesta. Monitoreo en tiempo real,
            despacho inteligente y trazabilidad completa de incidentes en una sola plataforma.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link
              href="/login"
              className="group px-10 py-4 bg-gradient-to-r from-tactical-blue to-blue-600 hover:from-blue-500 hover:to-blue-700 text-white font-semibold rounded-xl transition-all text-sm shadow-lg shadow-tactical-blue/25 hover:shadow-xl hover:shadow-tactical-blue/30 hover:-translate-y-0.5"
            >
              Iniciar sesion
            </Link>
            <Link
              href="/login?demo=true"
              className="group px-10 py-4 border border-white/10 hover:border-white/25 bg-white/5 hover:bg-white/10 text-signal-white font-medium rounded-xl transition-all text-sm hover:-translate-y-0.5 backdrop-blur-sm"
            >
              Ver demo
              <span className="inline-block ml-1 transition-transform group-hover:translate-x-1">&rarr;</span>
            </Link>
          </div>
        </div>

        {/* Features grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-20">
          {[
            { icon: '🗺️', title: 'Mapa en tiempo real', desc: 'Visualiza todas las unidades y su posicion GPS en vivo. Trails, cobertura y sectores.' },
            { icon: '🚨', title: 'Despacho inteligente', desc: 'Sugiere la mejor unidad por distancia y carga de trabajo. Despacho en menos de 30 segundos.' },
            { icon: '📊', title: 'Insights operativos', desc: 'KPIs en vivo, scorecard de unidades, y resumen automatico de cada turno.' },
            { icon: '📱', title: 'App de campo', desc: 'GPS, estados, fotos, notas y boton de panico. Todo desde el celular del policia.' },
            { icon: '🔒', title: 'Auditoria total', desc: 'Cada accion queda registrada. Roles, permisos y trazabilidad end-to-end.' },
            { icon: '💬', title: 'Chat operativo', desc: 'Comunicacion en tiempo real entre operadores y unidades. Historial completo.' },
          ].map((f) => (
            <div
              key={f.title}
              className="group bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 hover:border-tactical-blue/30 hover:bg-white/[0.05] transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-tactical-blue/5 cursor-default"
            >
              <span className="text-3xl block mb-4">{f.icon}</span>
              <h3 className="text-signal-white font-semibold text-base mb-2">{f.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Metrics */}
        <div className="relative bg-white/[0.03] border border-white/[0.06] rounded-2xl p-10 mb-20 overflow-hidden">
          {/* Subtle inner glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-tactical-blue/5 via-transparent to-purple-600/5 pointer-events-none" />
          <h2 className="relative text-signal-white font-semibold text-lg mb-8 text-center tracking-tight">
            Metricas del piloto
          </h2>
          <div className="relative grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { value: <AnimatedCounter prefix="< " end={2} suffix=" min" />, label: 'Tiempo de despacho' },
              { value: <AnimatedCounter end={85} suffix="%+" />, label: 'Incidentes trazados' },
              { value: <AnimatedCounter end={90} suffix="%+" />, label: 'Unidades conectadas' },
              { value: '24/7', label: 'Monitoreo continuo' },
            ].map((m) => (
              <div key={m.label} className="text-center">
                <p className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-tactical-blue to-cyan-400 bg-clip-text text-transparent tracking-tight">
                  {m.value}
                </p>
                <p className="text-slate-500 text-xs mt-2 uppercase tracking-widest font-medium">{m.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-signal-white mb-3 tracking-tight">
            Listo para transformar tu municipio?
          </h2>
          <p className="text-slate-400 mb-8 text-base">
            Agenda una demo personalizada con nuestro equipo.
          </p>
          <Link
            href="/login"
            className="inline-flex px-12 py-4 bg-gradient-to-r from-tactical-blue to-blue-600 hover:from-blue-500 hover:to-blue-700 text-white font-semibold rounded-xl transition-all text-sm shadow-lg shadow-tactical-blue/25 hover:shadow-xl hover:shadow-tactical-blue/30 hover:-translate-y-0.5"
          >
            Comenzar ahora
          </Link>
        </div>
      </main>

      <footer className="relative z-10 border-t border-white/5 px-8 py-8">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-gradient-to-br from-tactical-blue to-blue-700 rounded-md flex items-center justify-center">
              <span className="text-white font-bold text-xs">V</span>
            </div>
            <span className="text-slate-500 text-sm font-medium">Velnari</span>
          </div>
          <p className="text-slate-600 text-xs">
            &copy; 2026 Velnari &middot; Public Safety Tech &middot; Mexico
          </p>
          <div className="flex items-center gap-5">
            {/* Social links placeholder */}
            <a href="#" className="text-slate-600 hover:text-slate-400 transition-colors text-xs">LinkedIn</a>
            <a href="#" className="text-slate-600 hover:text-slate-400 transition-colors text-xs">X / Twitter</a>
            <a href="#" className="text-slate-600 hover:text-slate-400 transition-colors text-xs">Contacto</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
