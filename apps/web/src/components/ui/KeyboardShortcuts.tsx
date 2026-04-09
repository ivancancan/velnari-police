'use client';
import { useState } from 'react';

const SHORTCUTS = [
  { key: '1', desc: 'Tab Incidentes' },
  { key: '2', desc: 'Tab Patrullajes' },
  { key: '3', desc: 'Tab Chat' },
  { key: 'Esc', desc: 'Deseleccionar unidad/incidente' },
  { key: 'H', desc: 'Abrir ayuda' },
];

export default function KeyboardShortcuts() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(v => !v)}
        className="text-xs text-slate-gray hover:text-signal-white w-6 h-6 flex items-center justify-center rounded border border-slate-700 hover:border-slate-500 transition-colors"
        title="Atajos de teclado"
        aria-label="Atajos de teclado"
      >
        ?
      </button>
      {open && (
        <div className="absolute top-12 right-4 bg-slate-900 border border-slate-700 rounded-lg p-4 shadow-xl z-50 w-56">
          <p className="text-xs font-semibold text-signal-white mb-2">Atajos de teclado</p>
          {SHORTCUTS.map(s => (
            <div key={s.key} className="flex justify-between py-1">
              <kbd className="text-xs bg-slate-800 text-tactical-blue px-1.5 py-0.5 rounded font-mono">{s.key}</kbd>
              <span className="text-xs text-slate-400">{s.desc}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
