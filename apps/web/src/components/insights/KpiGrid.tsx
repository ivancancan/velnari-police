'use client';

import { useState } from 'react';
import KpiCard from './KpiCard';
import type { InsightsData } from '@/hooks/useInsightsData';
import { trendPct } from '@/hooks/useInsightsData';
import DispatchTimeDrilldown from './drilldown/DispatchTimeDrilldown';
import IncidentsTotalDrilldown from './drilldown/IncidentsTotalDrilldown';
import ArrivalTimeDrilldown from './drilldown/ArrivalTimeDrilldown';
import SlaDrilldown from './drilldown/SlaDrilldown';
import UnitsActiveDrilldown from './drilldown/UnitsActiveDrilldown';
import CriticalsDrilldown from './drilldown/CriticalsDrilldown';
import ClosureRateDrilldown from './drilldown/ClosureRateDrilldown';
import BestUnitDrilldown from './drilldown/BestUnitDrilldown';
import HotspotDrilldown from './drilldown/HotspotDrilldown';
import PatrolCoverageDrilldown from './drilldown/PatrolCoverageDrilldown';

interface Props {
  data: InsightsData;
}

export default function KpiGrid({ data }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const toggle = (id: string) => setExpandedId((cur) => (cur === id ? null : id));

  const cur = data.current;
  const prev = data.previous;

  const closureRate = cur
    ? cur.summary.totalIncidents > 0
      ? Math.round((cur.summary.closedIncidents / cur.summary.totalIncidents) * 100)
      : 0
    : null;
  const prevClosureRate = prev && prev.summary.totalIncidents > 0
    ? Math.round((prev.summary.closedIncidents / prev.summary.totalIncidents) * 100)
    : null;

  const bestUnit = cur?.byUnit?.slice().sort((a, b) => {
    const scoreA = a.count * 10 - (a.avgResponseMin ?? 99);
    const scoreB = b.count * 10 - (b.avgResponseMin ?? 99);
    return scoreB - scoreA;
  })[0] ?? null;

  const hotSector = cur?.bySector?.slice().sort((a, b) => b.count - a.count)[0] ?? null;

  const cards: {
    id: string; emoji: string; label: string; value: string | number;
    valueColor: string; subtitle?: string; trend?: number | null;
    trendInvert?: boolean; sparkline?: number[]; prevValue?: string | number;
    drilldown: React.ReactNode;
  }[] = [
    {
      id: 'incidents',
      emoji: '📋', label: 'Total incidentes',
      value: cur?.summary.totalIncidents ?? '—',
      valueColor: '#3b82f6',
      subtitle: cur ? `Abiertos: ${cur.summary.openIncidents} · Cerrados: ${cur.summary.closedIncidents}` : undefined,
      trend: trendPct(cur?.summary.totalIncidents ?? null, prev?.summary.totalIncidents ?? null),
      prevValue: prev?.summary.totalIncidents ?? undefined,
      sparkline: cur?.byDay.map((d) => d.count),
      drilldown: cur ? <IncidentsTotalDrilldown data={cur} prevData={prev ?? null} /> : null,
    },
    {
      id: 'dispatch',
      emoji: '⏱', label: 'Tiempo de despacho promedio',
      value: cur?.summary.avgResponseMinutes != null ? `${cur.summary.avgResponseMinutes.toFixed(1)} min` : '—',
      valueColor: '#22c55e',
      subtitle: 'Meta piloto: < 2 min',
      trend: trendPct(cur?.summary.avgResponseMinutes ?? null, prev?.summary.avgResponseMinutes ?? null),
      prevValue: prev?.summary.avgResponseMinutes != null ? `${prev.summary.avgResponseMinutes.toFixed(1)} min` : undefined,
      trendInvert: true,
      sparkline: cur?.byDay.map((d) => d.count), // volume trend — no per-day response time in API
      drilldown: cur ? <DispatchTimeDrilldown data={cur} prevData={prev ?? null} /> : null,
    },
    {
      id: 'arrival',
      emoji: '🚔', label: 'Tiempo de arribo promedio',
      value: cur?.summary.avgCloseMinutes != null ? `${cur.summary.avgCloseMinutes.toFixed(1)} min` : '—',
      valueColor: '#3b82f6',
      subtitle: 'Desde asignación hasta escena',
      trend: trendPct(cur?.summary.avgCloseMinutes ?? null, prev?.summary.avgCloseMinutes ?? null),
      prevValue: prev?.summary.avgCloseMinutes != null ? `${prev.summary.avgCloseMinutes.toFixed(1)} min` : undefined,
      trendInvert: true,
      drilldown: cur ? <ArrivalTimeDrilldown data={cur} prevData={prev ?? null} /> : null,
    },
    {
      id: 'sla',
      emoji: '✅', label: 'Cumplimiento SLA',
      value: data.sla ? `${data.sla.overallPct}%` : '—',
      valueColor: '#a78bfa',
      subtitle: 'Meta: 85%',
      drilldown: data.sla ? <SlaDrilldown sla={data.sla} /> : null,
    },
    {
      id: 'units',
      emoji: '🟢', label: 'Unidades activas',
      value: data.unitStats ? `${data.unitStats.available + data.unitStats.enRoute + data.unitStats.onScene}/${data.unitStats.total}` : '—',
      valueColor: '#22c55e',
      subtitle: data.unitStats
        ? `${Math.round(((data.unitStats.available + data.unitStats.enRoute + data.unitStats.onScene) / data.unitStats.total) * 100)}% de la flota`
        : undefined,
      drilldown: data.unitStats ? <UnitsActiveDrilldown stats={data.unitStats} /> : null,
    },
    {
      id: 'criticals',
      emoji: '🚨', label: 'Incidentes críticos',
      value: cur?.byPriority['critical'] ?? 0,
      valueColor: '#ef4444',
      trend: trendPct(cur?.byPriority['critical'] ?? null, prev?.byPriority['critical'] ?? null),
      prevValue: prev?.byPriority['critical'] ?? undefined,
      trendInvert: true,
      drilldown: cur ? <CriticalsDrilldown data={cur} /> : null,
    },
    {
      id: 'closure',
      emoji: '📊', label: 'Tasa de cierre',
      value: closureRate != null ? `${closureRate}%` : '—',
      valueColor: '#f59e0b',
      subtitle: cur ? `${cur.summary.closedIncidents} cerrados / ${cur.summary.totalIncidents} total` : undefined,
      trend: trendPct(closureRate, prevClosureRate),
      prevValue: prevClosureRate != null ? `${prevClosureRate}%` : undefined,
      drilldown: cur ? <ClosureRateDrilldown data={cur} prevData={prev ?? null} /> : null,
    },
    {
      id: 'best-unit',
      emoji: '🏆', label: 'Mejor unidad',
      value: bestUnit?.callSign ?? '—',
      valueColor: '#f59e0b',
      subtitle: bestUnit ? `${bestUnit.count} incidentes · ${bestUnit.avgResponseMin?.toFixed(1) ?? '—'} min despacho` : undefined,
      drilldown: cur ? <BestUnitDrilldown data={cur} /> : null,
    },
    {
      id: 'hotspot',
      emoji: '🗺', label: 'Zona más activa',
      value: hotSector?.sectorName ?? '—',
      valueColor: '#f59e0b',
      subtitle: hotSector ? `${hotSector.count} incidentes` : undefined,
      drilldown: cur ? <HotspotDrilldown data={cur} /> : null,
    },
    {
      id: 'patrol',
      emoji: '📍', label: 'Cobertura patrullaje',
      value: '—',
      valueColor: '#22c55e',
      subtitle: 'Datos de patrullaje',
      drilldown: <PatrolCoverageDrilldown />,
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-3 p-6 auto-rows-auto">
      {cards.map((c) => (
        <KpiCard
          key={c.id}
          id={c.id}
          emoji={c.emoji}
          label={c.label}
          value={c.value}
          valueColor={c.valueColor}
          subtitle={c.subtitle}
          trend={c.trend}
          trendInvert={c.trendInvert}
          prevValue={c.prevValue}
          sparklineValues={c.sparkline}
          sparklineColor={c.valueColor}
          isExpanded={expandedId === c.id}
          onToggle={toggle}
        >
          {c.drilldown}
        </KpiCard>
      ))}
    </div>
  );
}
