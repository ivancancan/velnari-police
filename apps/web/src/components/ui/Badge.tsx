type BadgeVariant = 'available' | 'en_route' | 'on_scene' | 'out_of_service' |
  'critical' | 'high' | 'medium' | 'low' |
  'open' | 'assigned' | 'closed';

const variantStyles: Record<BadgeVariant, string> = {
  available: 'bg-green-900 text-green-300 border border-green-700',
  en_route: 'bg-blue-900 text-blue-300 border border-blue-700',
  on_scene: 'bg-amber-900 text-amber-300 border border-amber-700',
  out_of_service: 'bg-slate-800 text-slate-400 border border-slate-700',
  critical: 'bg-red-900 text-red-300 border border-red-700',
  high: 'bg-orange-900 text-orange-300 border border-orange-700',
  medium: 'bg-yellow-900 text-yellow-300 border border-yellow-700',
  low: 'bg-green-900 text-green-300 border border-green-700',
  open: 'bg-blue-900 text-blue-300 border border-blue-700',
  assigned: 'bg-purple-900 text-purple-300 border border-purple-700',
  closed: 'bg-slate-800 text-slate-400 border border-slate-700',
};

const labelMap: Record<BadgeVariant, string> = {
  available: 'Disponible',
  en_route: 'En ruta',
  on_scene: 'En escena',
  out_of_service: 'Fuera de servicio',
  critical: 'Crítico',
  high: 'Alto',
  medium: 'Medio',
  low: 'Bajo',
  open: 'Abierto',
  assigned: 'Asignado',
  closed: 'Cerrado',
};

interface BadgeProps {
  variant: BadgeVariant;
  className?: string;
}

export default function Badge({ variant, className = '' }: BadgeProps) {
  const styles = variantStyles[variant] ?? 'bg-slate-800 text-slate-400';
  const label = labelMap[variant] ?? variant;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles} ${className}`}>
      {label}
    </span>
  );
}
