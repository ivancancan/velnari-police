'use client';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen bg-midnight-command flex items-center justify-center p-4">
      <div className="text-center">
        <p className="text-4xl mb-4">&#x26A0;&#xFE0F;</p>
        <h1 className="text-xl font-semibold text-signal-white mb-2">Algo salio mal</h1>
        <p className="text-slate-gray mb-6 max-w-sm">{error.message || 'Error inesperado. Intenta recargar la pagina.'}</p>
        <button onClick={reset} className="px-6 py-2 bg-tactical-blue hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors">
          Reintentar
        </button>
      </div>
    </div>
  );
}
