'use client';

import { useState } from 'react';
import type { DateRange } from '@/hooks/useInsightsData';

interface Props {
  range: DateRange;
}

export default function ExportBar({ range }: Props) {
  const csvUrl = `/api/incidents/analytics?from=${range.from}T00:00:00.000Z&to=${range.to}T23:59:59.999Z&format=csv`;
  const sesnspUrl = `/api/incidents/sesnsp-export?from=${range.from}T00:00:00.000Z&to=${range.to}T23:59:59.999Z`;

  const [pdfLoading, setPdfLoading] = useState(false);

  async function handlePdf() {
    setPdfLoading(true);
    try {
      const { default: html2canvas } = await import('html2canvas');
      const { default: jsPDF } = await import('jspdf');

      // Target the main content div (parent of ExportBar = the overflow-y-auto div)
      const el = document.querySelector('[data-pdf-target]') as HTMLElement;
      if (!el) return;

      const canvas = await html2canvas(el, {
        backgroundColor: '#0F172A', // midnight-command
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [canvas.width / 2, canvas.height / 2],
      });
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / 2, canvas.height / 2);
      pdf.save(`velnari-insights-${range.from}-${range.to}.pdf`);
    } finally {
      setPdfLoading(false);
    }
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
        disabled={pdfLoading}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 hover:text-signal-white border border-slate-700 rounded-lg text-xs font-medium transition-all"
      >
        {pdfLoading ? '⏳ Generando…' : '📄 Exportar PDF'}
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
