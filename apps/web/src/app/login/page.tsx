import LoginForm from '@/components/auth/LoginForm';

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-midnight-command flex flex-col items-center justify-center gap-8">
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-3xl font-bold text-signal-white tracking-tight">
          Velnari Command
        </h1>
        <p className="text-slate-gray text-sm">
          El sistema operativo de la seguridad municipal.
        </p>
      </div>
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-8 w-full max-w-sm shadow-xl">
        <LoginForm />
      </div>
    </main>
  );
}
