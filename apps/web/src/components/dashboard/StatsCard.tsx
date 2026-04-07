interface StatsCardProps {
  label: string;
  value: number | string;
  color?: 'blue' | 'amber' | 'green' | 'red' | 'slate';
  sub?: string;
}

const VALUE_COLORS = {
  blue: 'text-tactical-blue',
  amber: 'text-alert-amber',
  green: 'text-green-400',
  red: 'text-red-400',
  slate: 'text-slate-gray',
} as const;

export default function StatsCard({ label, value, color = 'blue', sub }: StatsCardProps) {
  return (
    <div className="bg-slate-800 rounded-lg p-4 flex flex-col gap-1">
      <p className="text-xs text-slate-gray uppercase tracking-widest">{label}</p>
      <p className={`text-3xl font-bold font-mono ${VALUE_COLORS[color]}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </div>
  );
}
