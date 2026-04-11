'use client';

import Sparkline from './Sparkline';

interface Props {
  id: string;
  emoji: string;
  label: string;
  value: string | number;
  valueColor: string;
  subtitle?: string;
  trend?: number | null;
  trendInvert?: boolean;
  sparklineValues?: number[];
  sparklineColor?: string;
  isExpanded: boolean;
  onToggle: (id: string) => void;
  children?: React.ReactNode;
}

export default function KpiCard({
  id, emoji, label, value, valueColor, subtitle, trend, trendInvert,
  sparklineValues, sparklineColor, isExpanded, onToggle, children,
}: Props) {
  const trendPositive = trend == null ? null : (trendInvert ? trend < 0 : trend > 0);
  const trendColor = trendPositive == null ? 'text-slate-500'
    : trendPositive ? 'text-green-400' : 'text-red-400';
  const trendArrow = trend == null ? '' : trend > 0 ? '▲' : '▼';

  return (
    <div
      className={`relative rounded-xl border transition-all duration-200 cursor-pointer ${
        isExpanded
          ? 'col-span-4 bg-slate-800/80 border-tactical-blue shadow-lg shadow-tactical-blue/10'
          : 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600 hover:bg-slate-800 hover:-translate-y-0.5 hover:shadow-md'
      }`}
      onClick={() => onToggle(id)}
    >
      <div className="p-4">
        <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
          <span>{emoji}</span> {label}
        </p>

        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-bold font-mono" style={{ color: valueColor }}>
            {value}
          </span>
          {trend != null && (
            <span className={`text-xs font-medium ${trendColor}`}>
              {trendArrow} {Math.abs(trend)}% vs período anterior
            </span>
          )}
        </div>

        {subtitle && <p className="text-[11px] text-slate-500 mt-1">{subtitle}</p>}

        {!isExpanded && sparklineValues && sparklineValues.length > 0 && (
          <div className="mt-3">
            <Sparkline values={sparklineValues} color={sparklineColor ?? valueColor} />
          </div>
        )}

        {!isExpanded && (
          <span className="absolute top-3 right-3 text-[9px] text-slate-600">↗</span>
        )}
      </div>

      {isExpanded && children && (
        <div
          className="px-4 pb-4 border-t border-slate-700/50 pt-4"
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      )}
    </div>
  );
}
