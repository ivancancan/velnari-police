// apps/web/src/hooks/useInsightsData.ts
import { useState, useEffect, useCallback } from 'react';
import { incidentsApi, unitsApi } from '@/lib/api';
import type { AnalyticsResult, SlaCompliance, UnitStats } from '@/lib/types';

export interface DateRange {
  from: string; // ISO date string YYYY-MM-DD
  to: string;
}

export interface InsightsData {
  current: AnalyticsResult | null;
  previous: AnalyticsResult | null;
  sla: SlaCompliance | null;
  unitStats: UnitStats | null;
  loading: boolean;
  error: string | null;
}

/** Shift a date range backward by the same number of days */
function previousPeriod(range: DateRange): DateRange {
  const from = new Date(range.from);
  const to = new Date(range.to);
  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
  const prevTo = new Date(from);
  prevTo.setDate(prevTo.getDate() - 1);
  const prevFrom = new Date(prevTo);
  prevFrom.setDate(prevFrom.getDate() - (days - 1));
  return {
    from: prevFrom.toISOString().slice(0, 10),
    to: prevTo.toISOString().slice(0, 10),
  };
}

export function useInsightsData(range: DateRange): InsightsData {
  const [current, setCurrent] = useState<AnalyticsResult | null>(null);
  const [previous, setPrevious] = useState<AnalyticsResult | null>(null);
  const [sla, setSla] = useState<SlaCompliance | null>(null);
  const [unitStats, setUnitStats] = useState<UnitStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const prev = previousPeriod(range);
    const toISO = (d: string, eod = false) =>
      `${d}T${eod ? '23:59:59.999' : '00:00:00.000'}Z`;
    try {
      const [curRes, prevRes, statsRes] = await Promise.all([
        incidentsApi.getAnalytics({ from: toISO(range.from), to: toISO(range.to, true) }),
        incidentsApi.getAnalytics({ from: toISO(prev.from), to: toISO(prev.to, true) }),
        unitsApi.getStats(),
      ]);
      setCurrent(curRes.data);
      setPrevious(prevRes.data);
      setUnitStats(statsRes.data);

      // SLA fetch is best-effort — map API shape to our SlaCompliance type
      try {
        const slaRes = await incidentsApi.getSlaCompliance(toISO(range.from), toISO(range.to, true));
        const raw = slaRes.data;
        const mapped: SlaCompliance = {
          overallPct: Math.round((raw.overall.complianceRate ?? 0) * 100),
          byPriority: raw.byPriority.map((r) => ({
            priority: r.priority as never,
            targetMinutes: r.targetMinutes,
            avgMinutes: r.avgResponseMinutes,
            compliantCount: r.withinSla,
            totalCount: r.totalIncidents,
            compliancePct: Math.round((r.complianceRate ?? 0) * 100),
          })),
        };
        setSla(mapped);
      } catch {
        setSla(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  return { current, previous, sla, unitStats, loading, error };
}

/** Compute % change between two numbers. Returns null if baseline is 0. */
export function trendPct(current: number | null, previous: number | null): number | null {
  if (current == null || previous == null || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}
