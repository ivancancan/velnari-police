import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-midnight-command flex items-center justify-center p-4">
      <div className="text-center">
        <p className="text-6xl font-bold text-tactical-blue mb-4">404</p>
        <h1 className="text-xl font-semibold text-signal-white mb-2">Pagina no encontrada</h1>
        <p className="text-slate-gray mb-6">La pagina que buscas no existe o fue movida.</p>
        <Link href="/command" className="px-6 py-2 bg-tactical-blue hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors">
          Ir al centro de mando
        </Link>
      </div>
    </div>
  );
}
