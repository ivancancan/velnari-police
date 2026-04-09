'use client';

import { useEffect, useState } from 'react';
import { unitsApi } from '@/lib/api';
import type { UnitScore } from '@/lib/types';
import { Trophy } from 'lucide-react';

function rankLabel(index: number): { text: string; isTop3: boolean } {
  if (index === 0) return { text: '\uD83E\uDD47', isTop3: true };
  if (index === 1) return { text: '\uD83E\uDD48', isTop3: true };
  if (index === 2) return { text: '\uD83E\uDD49', isTop3: true };
  return { text: `#${index + 1}`, isTop3: false };
}

function scoreGradient(score: number): string {
  if (score >= 70) return 'bg-gradient-to-r from-blue-500 to-green-500';
  if (score >= 40) return 'bg-gradient-to-r from-blue-500 to-yellow-500';
  return 'bg-gradient-to-r from-red-500 to-orange-500';
}

export default function ScoreboardPage() {
  const [scores, setScores] = useState<UnitScore[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    unitsApi
      .getScoreboard()
      .then((r) => setScores(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Trophy size={22} className="text-yellow-500" />
        <h1 className="text-xl font-bold text-gray-900">Scoreboard de Unidades</h1>
        <span className="text-sm text-gray-400 ml-2">Mes actual</span>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Cargando...</div>
      ) : scores.length === 0 ? (
        <div className="text-center py-16 text-gray-400">Sin datos para este mes</div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50/80 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-200">
                <th className="px-4 py-3 text-left w-16">Pos.</th>
                <th className="px-4 py-3 text-left">Unidad</th>
                <th className="px-4 py-3 text-left w-48">Puntuación</th>
                <th className="px-4 py-3 text-center">Incidentes</th>
                <th className="px-4 py-3 text-center">Resp. Promedio</th>
                <th className="px-4 py-3 text-center">Puntos GPS</th>
                <th className="px-4 py-3 text-center">Horas servicio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {scores.map((s, i) => {
                const rank = rankLabel(i);
                return (
                <tr key={s.unitId} className={`transition-all duration-150 hover:bg-blue-50/40 ${i % 2 === 1 ? 'bg-gray-50/50' : 'bg-white'}`}>
                  <td className="px-4 py-3 text-center text-lg">
                    <span className={rank.isTop3 ? 'drop-shadow-[0_0_6px_rgba(250,204,21,0.5)]' : ''}>{rank.text}</span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-900">{s.callSign}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ease-out ${scoreGradient(s.score)}`}
                          style={{ width: `${Math.min(s.score, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono font-semibold text-gray-700 w-8 text-right">
                        {s.score}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center font-mono text-gray-700">{s.totalIncidents}</td>
                  <td className="px-4 py-3 text-center font-mono text-gray-700">
                    {s.avgResponseMinutes !== null ? `${s.avgResponseMinutes} min` : '--'}
                  </td>
                  <td className="px-4 py-3 text-center font-mono text-gray-700">{s.totalGpsPoints}</td>
                  <td className="px-4 py-3 text-center font-mono text-gray-700">{s.hoursOnDuty}h</td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
