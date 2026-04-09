'use client';
import { useState, useEffect } from 'react';

const STEPS = [
  {
    title: 'Bienvenido a Velnari Command',
    description: 'Este es tu centro de mando. Aquí verás todas las unidades y los incidentes en tiempo real.',
    icon: '🗺️',
    tip: 'El mapa muestra la posición GPS de cada unidad en vivo.',
  },
  {
    title: 'Panel de incidentes',
    description: 'En el panel derecho verás la lista de incidentes activos. Puedes filtrar por estado, buscar por folio y crear nuevos.',
    icon: '🚨',
    tip: 'Usa las teclas 1, 2, 3 para cambiar entre tabs.',
  },
  {
    title: 'Crear y despachar',
    description: 'Click "+ Nuevo" para crear un incidente. Selecciona la ubicación en el mapa, elige tipo y prioridad. El sistema sugerirá la mejor unidad automáticamente.',
    icon: '⚡',
    tip: 'El auto-dispatch analiza distancia y carga de trabajo.',
  },
  {
    title: 'Alertas en tiempo real',
    description: 'Recibirás alertas con sonido cuando: un incidente crítico se crea, una unidad sale de su zona, o una unidad deja de moverse por más de 5 minutos.',
    icon: '🔔',
    tip: 'La campana guarda el historial de todas las alertas.',
  },
  {
    title: 'Herramientas avanzadas',
    description: 'Usa "Mapa de calor" para ver zonas con más incidentes, "Cobertura" para ver huecos, y "Modo crisis" para emergencias masivas.',
    icon: '🛡️',
    tip: 'Presiona ? para ver todos los atajos de teclado.',
  },
];

const STORAGE_KEY = 'velnari_onboarding_done';

export default function OnboardingTour() {
  const [step, setStep] = useState(0);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const done = localStorage.getItem(STORAGE_KEY);
    if (!done) setShow(true);
  }, []);

  function handleFinish() {
    localStorage.setItem(STORAGE_KEY, 'true');
    setShow(false);
  }

  function handleNext() {
    if (step < STEPS.length - 1) setStep(s => s + 1);
    else handleFinish();
  }

  function handleSkip() {
    handleFinish();
  }

  if (!show) return null;

  const current = STEPS[step]!;

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Progress bar */}
        <div className="h-1 bg-slate-800">
          <div
            className="h-full bg-tactical-blue transition-all duration-300"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        <div className="p-8 text-center">
          <span className="text-5xl mb-4 block">{current.icon}</span>
          <h2 className="text-xl font-bold text-signal-white mb-3">{current.title}</h2>
          <p className="text-slate-400 text-sm leading-relaxed mb-4">{current.description}</p>
          <div className="bg-tactical-blue/10 border border-tactical-blue/20 rounded-lg px-4 py-2.5 mb-6">
            <p className="text-tactical-blue text-xs font-medium">💡 {current.tip}</p>
          </div>
        </div>

        <div className="px-8 pb-6 flex items-center justify-between">
          <button
            onClick={handleSkip}
            className="text-xs text-slate-gray hover:text-signal-white transition-colors"
          >
            Omitir tour
          </button>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-gray">
              {step + 1} / {STEPS.length}
            </span>
            <button
              onClick={handleNext}
              className="px-6 py-2 bg-tactical-blue hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {step < STEPS.length - 1 ? 'Siguiente' : 'Comenzar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
