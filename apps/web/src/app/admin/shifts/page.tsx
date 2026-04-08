'use client';
import { useEffect, useState } from 'react';
import { unitsApi, usersApi } from '@/lib/api';
import type { Unit, User } from '@/lib/types';
import { Clock, Truck, Users } from 'lucide-react';

const SHIFTS = ['Matutino', 'Vespertino', 'Nocturno', '24x24'] as const;

const SHIFT_COLORS: Record<string, string> = {
  Matutino: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  Vespertino: 'bg-orange-50 border-orange-200 text-orange-800',
  Nocturno: 'bg-indigo-50 border-indigo-200 text-indigo-800',
  '24x24': 'bg-purple-50 border-purple-200 text-purple-800',
};

const SHIFT_BADGE: Record<string, string> = {
  Matutino: 'bg-yellow-100 text-yellow-700',
  Vespertino: 'bg-orange-100 text-orange-700',
  Nocturno: 'bg-indigo-100 text-indigo-700',
  '24x24': 'bg-purple-100 text-purple-700',
};

export default function ShiftsPage() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([unitsApi.getAll({}), usersApi.getAll()])
      .then(([uRes, usRes]) => {
        setUnits(uRes.data);
        setUsers(usRes.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-8">
        <div className="py-16 text-center text-gray-400 text-sm">Cargando turnos…</div>
      </div>
    );
  }

  // Group by shift
  const unitsByShift: Record<string, Unit[]> = {};
  const usersByShift: Record<string, User[]> = {};

  for (const shift of SHIFTS) {
    unitsByShift[shift] = units.filter(u => u.shift === shift);
    usersByShift[shift] = users.filter(u => u.shift === shift);
  }

  const unassignedUnits = units.filter(u => !u.shift);
  const unassignedUsers = users.filter(u => !u.shift);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Gestión de Turnos</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Vista de cobertura de unidades y usuarios por turno
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {SHIFTS.map(shift => {
          const unitCount = unitsByShift[shift]?.length ?? 0;
          const userCount = usersByShift[shift]?.length ?? 0;
          return (
            <div key={shift} className={`border rounded-xl p-4 ${SHIFT_COLORS[shift] ?? 'bg-gray-50 border-gray-200'}`}>
              <div className="flex items-center gap-2 mb-3">
                <Clock size={14} />
                <span className="font-semibold text-sm">{shift}</span>
              </div>
              <div className="flex gap-4">
                <div className="flex items-center gap-1.5 text-xs">
                  <Truck size={12} />
                  <span className="font-bold text-base">{unitCount}</span>
                  <span className="opacity-70">unidades</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <Users size={12} />
                  <span className="font-bold text-base">{userCount}</span>
                  <span className="opacity-70">usuarios</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail grid */}
      <div className="grid grid-cols-2 gap-6">
        {SHIFTS.map(shift => {
          const shiftUnits = unitsByShift[shift] ?? [];
          const shiftUsers = usersByShift[shift] ?? [];
          if (shiftUnits.length === 0 && shiftUsers.length === 0) return null;

          return (
            <div key={shift} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${SHIFT_BADGE[shift] ?? 'bg-gray-100 text-gray-600'}`}>
                  <Clock size={10} />
                  {shift}
                </span>
              </div>

              <div className="p-4 space-y-4">
                {/* Units */}
                {shiftUnits.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                      <Truck size={11} /> Unidades ({shiftUnits.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {shiftUnits.map(u => (
                        <span key={u.id} className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-700 rounded-md text-xs font-medium">
                          {u.callSign}
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            u.status === 'available' ? 'bg-green-500' :
                            u.status === 'en_route' ? 'bg-blue-500' :
                            u.status === 'on_scene' ? 'bg-amber-500' : 'bg-gray-400'
                          }`} />
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Users */}
                {shiftUsers.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                      <Users size={11} /> Usuarios ({shiftUsers.length})
                    </p>
                    <div className="space-y-1.5">
                      {shiftUsers.map(u => (
                        <div key={u.id} className="flex items-center justify-between">
                          <span className="text-sm text-gray-700">{u.name}</span>
                          <span className="text-xs text-gray-400 capitalize">{u.role}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Unassigned */}
      {(unassignedUnits.length > 0 || unassignedUsers.length > 0) && (
        <div className="mt-6 bg-gray-50 border border-dashed border-gray-300 rounded-xl p-5">
          <p className="text-sm font-medium text-gray-600 mb-3">Sin turno asignado</p>
          <div className="flex gap-6">
            {unassignedUnits.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-1.5 flex items-center gap-1"><Truck size={11} /> {unassignedUnits.length} unidades</p>
                <div className="flex flex-wrap gap-1.5">
                  {unassignedUnits.map(u => (
                    <span key={u.id} className="text-xs bg-white border border-gray-200 text-gray-600 px-2 py-0.5 rounded">{u.callSign}</span>
                  ))}
                </div>
              </div>
            )}
            {unassignedUsers.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-1.5 flex items-center gap-1"><Users size={11} /> {unassignedUsers.length} usuarios</p>
                <div className="flex flex-wrap gap-1.5">
                  {unassignedUsers.map(u => (
                    <span key={u.id} className="text-xs bg-white border border-gray-200 text-gray-600 px-2 py-0.5 rounded">{u.name}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-3">Asigna turnos desde la sección Usuarios o Unidades</p>
        </div>
      )}
    </div>
  );
}
