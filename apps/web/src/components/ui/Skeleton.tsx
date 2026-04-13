'use client';

// Tailwind-only skeleton primitives. Use instead of a bare spinner when the
// shape of the incoming content is predictable (list item, KPI card, row).
// Reserves layout space so the page doesn't jump when data lands.

interface Props {
  className?: string;
  /** ARIA-friendly label for screen readers. */
  label?: string;
}

export function Skeleton({ className = '', label }: Props): JSX.Element {
  return (
    <div
      role="status"
      aria-label={label ?? 'Cargando'}
      aria-busy="true"
      className={`animate-pulse bg-slate-800 rounded ${className}`}
    />
  );
}

export function SkeletonLine({ className = '' }: Props): JSX.Element {
  return <Skeleton className={`h-3 ${className}`} />;
}

/** Use for a card/KPI placeholder. */
export function SkeletonCard(): JSX.Element {
  return (
    <div className="p-4 bg-slate-900 border border-slate-800 rounded-lg space-y-3">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-2 w-16" />
    </div>
  );
}

/** Use for a list of incidents/units. */
export function SkeletonList({ count = 4 }: { count?: number }): JSX.Element {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Cargando lista">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="p-3 bg-slate-900 border border-slate-800 rounded-md flex gap-3"
        >
          <Skeleton className="h-10 w-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-2 min-w-0">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-2 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
