interface MiniBarChartProps {
  title: string;
  data: Record<string, number>;
  colorMap?: Record<string, string>;
  labelMap?: Record<string, string>;
}

export default function MiniBarChart({ title, data, colorMap = {}, labelMap = {} }: MiniBarChartProps) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(...entries.map(([, v]) => v), 1);

  return (
    <div className="bg-slate-800 rounded-lg p-4">
      <p className="text-xs text-slate-gray uppercase tracking-widest mb-3">{title}</p>
      {entries.length === 0 && (
        <p className="text-xs text-slate-500 py-2">Sin datos</p>
      )}
      <div className="flex flex-col gap-2">
        {entries.map(([key, value]) => (
          <div key={key} className="flex items-center gap-2">
            <span className="text-xs text-slate-400 w-24 shrink-0 truncate">
              {labelMap[key] ?? key}
            </span>
            <div className="flex-1 bg-slate-700 rounded-full h-2 overflow-hidden">
              <div
                className="h-2 rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${Math.round((value / max) * 100)}%`,
                  backgroundColor: colorMap[key] ?? '#3B82F6',
                }}
              />
            </div>
            <span className="text-xs text-signal-white font-mono w-5 text-right">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
