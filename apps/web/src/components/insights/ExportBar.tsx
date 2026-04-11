'use client';

import type { DateRange } from '@/hooks/useInsightsData';

interface Props {
  range: DateRange;
}

export default function ExportBar({ range }: Props) {
  const csvUrl = `/api/incidents/analytics?from=${range.from}T00:00:00.000Z&to=${range.to}T23:59:59.999Z&format=csv`;
  const sesnspUrl = `/api/incidents/sesnsp-export?from=${range.from}T00:00:00.000Z&to=${range.to}T23:59:59.999Z`;

  function handlePdf() {
    window.print();
  }

  return (
    <div className="flex items-center gap-2 px-6 py-4 border-t border-slate-800">
      <a
        href={csvUrl}
        download={`velnari-${range.from}-${range.to}.csv`}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-signal-white border border-slate-700 rounded-lg text-xs font-medium transition-all"
      >
        ⬇ Exportar CSV
      </a>
      <button
        onClick={handlePdf}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-signal-white border border-slate-700 rounded-lg text-xs font-medium transition-all"
      >
        📄 Exportar PDF
      </button>
      <a
        href={sesnspUrl}
        download={`sesnsp-${range.from}-${range.to}.csv`}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-tactical-blue hover:bg-blue-600 text-white rounded-lg text-xs font-medium transition-all"
      >
        📤 Reporte SESNSP
      </a>
    </div>
  );
}
