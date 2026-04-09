import { Suspense } from 'react';
import LoginForm from '@/components/auth/LoginForm';

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-midnight-command flex flex-col items-center justify-center gap-8 relative overflow-hidden">
      {/* Background aurora blobs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-tactical-blue/15 blur-[120px]" />
        <div className="absolute -bottom-32 -right-32 w-[400px] h-[400px] rounded-full bg-purple-600/10 blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full bg-cyan-500/5 blur-[100px]" />
      </div>

      {/* Subtle grid pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'radial-gradient(circle, #F8FAFC 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      <div className="relative z-10 flex flex-col items-center gap-2">
        <div className="w-12 h-12 bg-gradient-to-br from-tactical-blue to-blue-700 rounded-xl flex items-center justify-center shadow-lg shadow-tactical-blue/25 mb-2">
          <span className="text-white font-bold text-lg">V</span>
        </div>
        <h1 className="text-3xl font-bold text-signal-white tracking-tight">
          Velnari Command
        </h1>
        <p className="text-slate-500 text-sm">
          El sistema operativo de la seguridad municipal.
        </p>
      </div>

      <div className="relative z-10 bg-white/[0.04] border border-white/[0.08] backdrop-blur-xl rounded-2xl p-8 w-full max-w-sm shadow-2xl shadow-black/20">
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>

      <p className="relative z-10 text-slate-600 text-xs">
        &copy; 2026 Velnari &middot; Public Safety Tech
      </p>
    </main>
  );
}
