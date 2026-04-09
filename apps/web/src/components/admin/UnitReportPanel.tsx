'use client';
import type { UnitReport } from '@/lib/types';
import { exportToPdf } from '@/lib/pdf-export';

interface Props {
  report: UnitReport;
}

export default function UnitReportPanel({ report }: Props) {
  const downloadCSV = () => {
    const rows = [
      ['Folio', 'Tipo', 'Prioridad', 'Estado', 'Dirección', 'Asignado', 'Llegada', 'T. Respuesta (min)'],
      ...report.incidents.map(i => {
        const responseMin =
          i.assignedAt && i.arrivedAt
            ? Math.round((new Date(i.arrivedAt).getTime() - new Date(i.assignedAt).getTime()) / 60000)
            : '';
        return [
          i.folio,
          i.type,
          i.priority,
          i.status,
          i.address ?? '',
          i.assignedAt ? new Date(i.assignedAt).toLocaleString('es-MX') : '',
          i.arrivedAt ? new Date(i.arrivedAt).toLocaleString('es-MX') : '',
          String(responseMin),
        ];
      }),
    ];
    const csv = rows
      .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte-${report.unit.callSign}-${new Date(report.period.from).toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPDF = () => {
    const fromDate = new Date(report.period.from).toLocaleDateString('es-MX', { dateStyle: 'long' });
    const toDate = new Date(report.period.to).toLocaleDateString('es-MX', { dateStyle: 'long' });

    const incidentRows = report.incidents.map(i => {
      const responseMin =
        i.assignedAt && i.arrivedAt
          ? Math.round((new Date(i.arrivedAt).getTime() - new Date(i.assignedAt).getTime()) / 60000)
          : null;
      return `<tr>
        <td>${i.folio}</td>
        <td style="text-transform:capitalize">${i.type.replace('_', ' ')}</td>
        <td>${i.priority}</td>
        <td style="text-transform:capitalize">${i.status.replace('_', ' ')}</td>
        <td>${i.address ?? '—'}</td>
        <td>${responseMin != null ? `${responseMin} min` : '—'}</td>
      </tr>`;
    }).join('');

    const content = `
      <div class="stat-grid">
        <div class="stat-card"><div class="stat-value">${report.stats.totalIncidents}</div><div class="stat-label">Incidentes atendidos</div></div>
        <div class="stat-card"><div class="stat-value">${report.stats.closedIncidents}</div><div class="stat-label">Incidentes cerrados</div></div>
        <div class="stat-card"><div class="stat-value">${report.stats.avgResponseMinutes != null ? `${report.stats.avgResponseMinutes} min` : '—'}</div><div class="stat-label">T. respuesta promedio</div></div>
        <div class="stat-card"><div class="stat-value">${report.stats.gpsPointsRecorded}</div><div class="stat-label">Puntos GPS</div></div>
      </div>

      <h2>Incidentes del periodo (${report.incidents.length})</h2>
      <table>
        <tr><th>Folio</th><th>Tipo</th><th>Prioridad</th><th>Estado</th><th>Direccion</th><th>T. Respuesta</th></tr>
        ${incidentRows}
        ${report.incidents.length === 0 ? '<tr><td colspan="6" style="text-align:center;color:#94a3b8">Sin incidentes en este periodo</td></tr>' : ''}
      </table>
    `;

    exportToPdf(
      `Reporte Unidad ${report.unit.callSign} — ${fromDate} a ${toDate}`,
      content,
    );
  };

  const statCards = [
    { label: 'Incidentes atendidos', value: report.stats.totalIncidents, color: 'text-gray-900' },
    { label: 'Incidentes cerrados', value: report.stats.closedIncidents, color: 'text-green-400' },
    {
      label: 'T. respuesta promedio',
      value: report.stats.avgResponseMinutes != null ? `${report.stats.avgResponseMinutes} min` : '—',
      color: report.stats.avgResponseMinutes != null && report.stats.avgResponseMinutes < 5
        ? 'text-green-400'
        : 'text-amber-400',
    },
    { label: 'Puntos GPS registrados', value: report.stats.gpsPointsRecorded, color: 'text-blue-400' },
  ];

  return (
    <div className="space-y-6">
      {/* Unidad + período */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-gray-900 font-bold text-xl">
            Unidad {report.unit.callSign}
          </h2>
          <p className="text-gray-500 text-xs mt-0.5">
            {new Date(report.period.from).toLocaleDateString('es-MX', { dateStyle: 'long' })}
            {' '}—{' '}
            {new Date(report.period.to).toLocaleDateString('es-MX', { dateStyle: 'long' })}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={downloadPDF}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-lg text-sm transition-colors border border-slate-600"
          >
            Exportar PDF
          </button>
          <button
            onClick={downloadCSV}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-lg text-sm transition-colors border border-slate-600"
          >
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map(stat => (
          <div key={stat.label} className="bg-white rounded-xl p-4 border border-gray-200">
            <p className="text-gray-500 text-xs">{stat.label}</p>
            <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Tabla de incidentes */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-200">
          <h3 className="text-gray-900 font-medium text-sm">
            Incidentes del período ({report.incidents.length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-xs border-b border-gray-200 bg-white/80">
                <th className="px-4 py-3 text-left">Folio</th>
                <th className="px-4 py-3 text-left">Tipo</th>
                <th className="px-4 py-3 text-left">Prioridad</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3 text-left">Dirección</th>
                <th className="px-4 py-3 text-left">T. Respuesta</th>
              </tr>
            </thead>
            <tbody>
              {report.incidents.map(inc => {
                const responseMin =
                  inc.assignedAt && inc.arrivedAt
                    ? Math.round((new Date(inc.arrivedAt).getTime() - new Date(inc.assignedAt).getTime()) / 60000)
                    : null;
                const priorityStyle =
                  inc.priority === 'critical' ? 'bg-red-500/20 text-red-400' :
                  inc.priority === 'high' ? 'bg-orange-500/20 text-orange-400' :
                  inc.priority === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                  'bg-gray-100 text-gray-500';

                return (
                  <tr key={inc.id} className="border-b border-gray-200/50 hover:bg-gray-100/30 transition-colors">
                    <td className="px-4 py-3 text-gray-700 font-mono text-xs">{inc.folio}</td>
                    <td className="px-4 py-3 text-gray-700 capitalize">{inc.type.replace('_', ' ')}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${priorityStyle}`}>
                        {inc.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 capitalize">{inc.status.replace('_', ' ')}</td>
                    <td className="px-4 py-3 text-gray-500 truncate max-w-xs">{inc.address ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {responseMin != null ? `${responseMin} min` : '—'}
                    </td>
                  </tr>
                );
              })}
              {report.incidents.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                    Sin incidentes en este período
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
