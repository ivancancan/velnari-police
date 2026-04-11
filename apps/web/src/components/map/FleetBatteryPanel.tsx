// apps/web/src/components/map/FleetBatteryPanel.tsx
'use client';

import { useState } from 'react';
import type { Unit, UnitPosition } from '@/lib/types';

const STATUS_EMOJI: Record<string, string> = {
  available:      '🟢',
  en_route:       '🔵',
  on_scene:       '🟡',
  out_of_service: '⛔',
};

interface Props {
  units: Unit[];
  positions: Record<string, UnitPosition>;
}

export default function FleetBatteryPanel({ units, positions }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  // Only show units that have a known position with battery info
  const rows = units
    .map((u) => ({ unit: u, pos: positions[u.id] }))
    .filter((r) => r.pos != null)
    .sort((a, b) => {
      const ba = a.pos?.batteryLevel ?? 1;
      const bb = b.pos?.batteryLevel ?? 1;
      return ba - bb; // lowest battery first
    });

  const lowCount = rows.filter((r) => (r.pos?.batteryLevel ?? 1) < 0.2).length;

  return (
    <div className="absolute top-4 right-4 z-10 w-52 rounded-xl bg-slate-900/90 border border-slate-700/60 backdrop-blur-md shadow-2xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-800/60 transition-colors"
      >
        <span className="text-xs font-semibold text-signal-white flex items-center gap-1.5">
          🔋 Batería de flota
          {lowCount > 0 && (
            <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
              {lowCount} baja{lowCount > 1 ? 's' : ''}
            </span>
          )}
        </span>
        <span className="text-slate-400 text-xs">{collapsed ? '▼' : '▲'}</span>
      </button>

      {/* Rows */}
      {!collapsed && (
        <div className="flex flex-col divide-y divide-slate-800/60">
          {rows.length === 0 && (
            <p className="text-slate-500 text-[11px] px-3 py-2">Sin datos de posición aún…</p>
          )}
          {rows.map(({ unit, pos }) => {
            const pct = pos?.batteryLevel != null ? Math.round(pos.batteryLevel * 100) : null;
            const barColor =
              pct == null       ? '#475569' :
              pct > 50          ? '#22C55E' :
              pct > 20          ? '#F59E0B' :
                                  '#EF4444';
            const isLow = pct != null && pct <= 20;

            return (
              <div key={unit.id} className="flex items-center gap-2 px-3 py-1.5">
                {/* Status + callsign */}
                <span className="text-[11px] leading-none">{STATUS_EMOJI[unit.status] ?? '⚪'}</span>
                <span className="text-signal-white text-[11px] font-mono font-semibold w-10 shrink-0">
                  {unit.callSign}
                </span>

                {/* Battery bar */}
                <div className="flex-1 h-2 rounded-full bg-slate-700 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: pct != null ? `${pct}%` : '0%', backgroundColor: barColor }}
                  />
                </div>

                {/* Percentage */}
                <span
                  className={`text-[10px] font-mono w-8 text-right shrink-0 ${isLow ? 'text-red-400 font-bold' : 'text-slate-400'}`}
                >
                  {pct != null ? `${pct}%` : '—'}
                </span>

                {isLow && <span className="text-[10px] animate-pulse">⚡</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
