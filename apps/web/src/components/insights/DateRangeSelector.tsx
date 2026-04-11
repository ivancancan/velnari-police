'use client';

import type { DateRange } from '@/hooks/useInsightsData';

type Preset = 'today' | 'week' | 'month' | 'quarter' | 'custom';

interface Props {
  range: DateRange;
  onChange: (range: DateRange) => void;
  activePreset: Preset;
  onPresetChange: (p: Preset) => void;
  supervisorLocked?: boolean;
}

function toDate(d: Date) { return d.toISOString().slice(0, 10); }

export function presetToRange(preset: Preset): DateRange {
  const today = new Date();
  const todayStr = toDate(today);
  if (preset === 'today') return { from: todayStr, to: todayStr };
  if (preset === 'week') {
    const mon = new Date(today);
    mon.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    return { from: toDate(mon), to: todayStr };
  }
  if (preset === 'month') {
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: toDate(first), to: todayStr };
  }
  if (preset === 'quarter') {
    const q = new Date(today);
    q.setDate(today.getDate() - 89);
    return { from: toDate(q), to: todayStr };
  }
  return { from: todayStr, to: todayStr };
}

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'today',   label: 'Hoy' },
  { key: 'week',    label: 'Esta semana' },
  { key: 'month',   label: 'Este mes' },
  { key: 'quarter', label: 'Último trimestre' },
];

export default function DateRangeSelector({ range, onChange, activePreset, onPresetChange, supervisorLocked }: Props) {
  if (supervisorLocked) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-400 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
          📅 Vista del día — {new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {PRESETS.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => { onPresetChange(key); onChange(presetToRange(key)); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activePreset === key
              ? 'bg-tactical-blue text-white'
              : 'bg-slate-800 text-slate-400 hover:text-signal-white border border-slate-700 hover:border-slate-600'
          }`}
        >
          {label}
        </button>
      ))}

      <span className="text-slate-600 text-xs">|</span>

      <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5">
        <span className="text-[10px] text-slate-500">📅</span>
        <input
          type="date"
          value={range.from}
          max={range.to}
          onChange={(e) => { onPresetChange('custom'); onChange({ ...range, from: e.target.value }); }}
          className="bg-transparent text-signal-white text-xs outline-none w-28"
        />
        <span className="text-slate-600 text-xs">→</span>
        <input
          type="date"
          value={range.to}
          min={range.from}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(e) => { onPresetChange('custom'); onChange({ ...range, to: e.target.value }); }}
          className="bg-transparent text-signal-white text-xs outline-none w-28"
        />
      </div>
    </div>
  );
}
