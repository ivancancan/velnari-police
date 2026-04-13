'use client';

// Replay modal: timelapse of what happened during an incident.
// Shows the anchor pin, the animated GPS tracks of each assigned unit,
// and the event timeline synced to playback.
//
// Demo lens: "Comisario, aquí ve exactamente cómo se desarrolló el incidente
// IC-042. Este tipo de reproducción sirve para revisiones internas y para
// acompañar carpetas de investigación."

import { useEffect, useMemo, useRef, useState } from 'react';
import Map, { Marker, Source, Layer } from 'react-map-gl/maplibre';
import type { LineLayer } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { incidentsApi } from '@/lib/api';
import { reportError } from '@/lib/report-error';
import { Play, Pause, X, RotateCcw } from 'lucide-react';

interface Props {
  incidentId: string;
  onClose: () => void;
}

interface ReplayData {
  incident: { id: string; folio: string; lat: number; lng: number; createdAt: string; assignedAt?: string; closedAt?: string };
  events: { at: string; type: string; description?: string | null }[];
  units: { unitId: string; callSign: string; frames: { at: string; lat: number; lng: number }[] }[];
}

const UNIT_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];

const PLAYBACK_SPEEDS = [1, 2, 4, 8] as const;

const TRAIL_LAYER: Omit<LineLayer, 'source'> = {
  id: 'replay-trail',
  type: 'line',
  paint: {
    'line-color': ['get', 'color'],
    'line-width': 3,
    'line-opacity': 0.85,
  },
};

export default function IncidentReplay({ incidentId, onClose }: Props) {
  const [data, setData] = useState<ReplayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof PLAYBACK_SPEEDS)[number]>(2);
  /** Playback cursor in milliseconds since incident.createdAt. */
  const [cursorMs, setCursorMs] = useState(0);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);

  useEffect(() => {
    setLoading(true);
    incidentsApi
      .getReplay(incidentId)
      .then((res) => {
        setData(res.data);
        setCursorMs(0);
      })
      .catch((err) => reportError(err, { tag: 'incident.replay.load' }))
      .finally(() => setLoading(false));
  }, [incidentId]);

  const totalMs = useMemo(() => {
    if (!data) return 0;
    const endRef = data.incident.closedAt ?? new Date().toISOString();
    return Math.max(
      1,
      new Date(endRef).getTime() - new Date(data.incident.createdAt).getTime(),
    );
  }, [data]);

  // Animation loop — advances cursorMs using requestAnimationFrame for smoothness.
  useEffect(() => {
    if (!playing) return;
    const step = (now: number): void => {
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;
      setCursorMs((prev) => {
        const next = prev + delta * speed;
        if (next >= totalMs) {
          setPlaying(false);
          return totalMs;
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(step);
    };
    lastTickRef.current = performance.now();
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, speed, totalMs]);

  // Compute each unit's current position + trail up to cursor.
  const unitStates = useMemo(() => {
    if (!data) return [];
    const createdMs = new Date(data.incident.createdAt).getTime();
    const cursorAbs = createdMs + cursorMs;
    return data.units.map((u, idx) => {
      const color = UNIT_COLORS[idx % UNIT_COLORS.length] ?? '#3b82f6';
      const visibleFrames = u.frames.filter((f) => new Date(f.at).getTime() <= cursorAbs);
      const last = visibleFrames[visibleFrames.length - 1];
      return {
        unitId: u.unitId,
        callSign: u.callSign,
        color,
        currentFrame: last ?? null,
        trail: visibleFrames,
      };
    });
  }, [data, cursorMs]);

  const visibleEvents = useMemo(() => {
    if (!data) return [];
    const createdMs = new Date(data.incident.createdAt).getTime();
    const cursorAbs = createdMs + cursorMs;
    return data.events.filter((e) => new Date(e.at).getTime() <= cursorAbs);
  }, [data, cursorMs]);

  const geojson = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: unitStates
        .filter((u) => u.trail.length >= 2)
        .map((u) => ({
          type: 'Feature' as const,
          properties: { color: u.color },
          geometry: {
            type: 'LineString' as const,
            coordinates: u.trail.map((f) => [f.lng, f.lat]),
          },
        })),
    }),
    [unitStates],
  );

  const humanCursor = formatClock(cursorMs);
  const humanTotal = formatClock(totalMs);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 shrink-0">
          <div>
            <h2 className="text-signal-white font-semibold text-sm">Replay del incidente</h2>
            {data && (
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                {data.incident.folio} · {new Date(data.incident.createdAt).toLocaleString('es-MX')}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-slate-gray hover:text-signal-white transition-colors"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body: map + event timeline */}
        <div className="flex-1 flex min-h-0">
          {/* Map */}
          <div className="flex-1 relative">
            {loading ? (
              <div className="w-full h-full flex items-center justify-center">
                <p className="text-slate-gray text-sm">Cargando…</p>
              </div>
            ) : data ? (
              <Map
                initialViewState={{
                  longitude: data.incident.lng,
                  latitude: data.incident.lat,
                  zoom: 14,
                }}
                mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
              >
                {/* Incident anchor */}
                <Marker longitude={data.incident.lng} latitude={data.incident.lat}>
                  <div
                    className="w-8 h-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-sm"
                    style={{ background: '#ef4444' }}
                  >
                    📍
                  </div>
                </Marker>

                {/* Unit trails */}
                <Source id="replay-trails" type="geojson" data={geojson}>
                  <Layer {...TRAIL_LAYER} />
                </Source>

                {/* Unit current positions */}
                {unitStates.map(
                  (u) =>
                    u.currentFrame && (
                      <Marker
                        key={u.unitId}
                        longitude={u.currentFrame.lng}
                        latitude={u.currentFrame.lat}
                      >
                        <div
                          className="px-2 py-1 rounded-full text-xs font-bold text-white shadow-lg border-2 border-white"
                          style={{ background: u.color }}
                        >
                          {u.callSign}
                        </div>
                      </Marker>
                    ),
                )}
              </Map>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-gray text-sm">
                No se pudo cargar el replay
              </div>
            )}
          </div>

          {/* Event timeline sidebar */}
          <div className="w-64 border-l border-slate-800 overflow-y-auto shrink-0">
            <div className="px-4 py-3 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
              <h3 className="text-xs uppercase tracking-widest text-slate-400 font-semibold">
                Eventos ({visibleEvents.length})
              </h3>
            </div>
            <ul className="p-2 space-y-1">
              {visibleEvents.map((ev, i) => (
                <li
                  key={i}
                  className="px-2 py-2 rounded bg-slate-950 border border-slate-800 text-xs"
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-mono text-[10px] text-slate-500">
                      {new Date(ev.at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                    <span className="text-[9px] uppercase text-tactical-blue font-semibold">
                      {ev.type}
                    </span>
                  </div>
                  {ev.description && (
                    <p className="text-slate-300 leading-snug">{ev.description}</p>
                  )}
                </li>
              ))}
              {visibleEvents.length === 0 && !loading && (
                <p className="text-xs text-slate-500 p-3 text-center">
                  Sin eventos hasta este punto…
                </p>
              )}
            </ul>
          </div>
        </div>

        {/* Player controls */}
        <div className="px-5 py-3 border-t border-slate-800 shrink-0 space-y-2">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (cursorMs >= totalMs) setCursorMs(0);
                setPlaying((p) => !p);
              }}
              disabled={loading}
              className="w-9 h-9 rounded-full bg-tactical-blue text-white flex items-center justify-center hover:bg-blue-600 transition-colors disabled:opacity-50"
              aria-label={playing ? 'Pausa' : 'Reproducir'}
            >
              {playing ? <Pause size={16} /> : <Play size={16} />}
            </button>
            <button
              onClick={() => {
                setPlaying(false);
                setCursorMs(0);
              }}
              className="text-slate-gray hover:text-signal-white transition-colors"
              aria-label="Reiniciar"
            >
              <RotateCcw size={16} />
            </button>
            <span className="font-mono text-xs text-slate-400 tabular-nums">
              {humanCursor} / {humanTotal}
            </span>
            <div className="ml-auto flex items-center gap-1 text-xs">
              {PLAYBACK_SPEEDS.map((s) => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  className={`px-2 py-0.5 rounded font-mono ${
                    speed === s
                      ? 'bg-tactical-blue text-white'
                      : 'text-slate-gray hover:text-signal-white'
                  }`}
                >
                  {s}×
                </button>
              ))}
            </div>
          </div>
          <input
            type="range"
            min={0}
            max={totalMs}
            step={1000}
            value={cursorMs}
            onChange={(e) => {
              setPlaying(false);
              setCursorMs(Number(e.target.value));
            }}
            className="w-full accent-tactical-blue cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
}

function formatClock(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
