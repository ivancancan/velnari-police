'use client';

export default function AdminError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen bg-midnight-command flex items-center justify-center p-8">
      <div className="text-center max-w-sm">
        <p className="text-3xl mb-4">⚙️</p>
        <h2 className="text-lg font-semibold text-signal-white mb-2">Error en administración</h2>
        <p className="text-slate-400 text-sm mb-6">
          {error.message || 'Ocurrió un error inesperado en el panel de administración.'}
        </p>
        <button
          onClick={reset}
          className="px-5 py-2 bg-tactical-blue hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}
