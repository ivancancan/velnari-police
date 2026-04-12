'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

const loginSchema = z.object({
  email: z.string().email('Email invalido'),
  password: z.string().min(8, 'Minimo 8 caracteres'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isDemo = searchParams.get('demo') === 'true';
  const setAuth = useAuthStore((s) => s.setAuth);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    setValue,
  } = useForm<LoginFormData>({ resolver: zodResolver(loginSchema) });

  useEffect(() => {
    if (isDemo) {
      setValue('email', 'admin@velnari.mx');
      setValue('password', 'Velnari2024!');
    }
  }, [isDemo, setValue]);

  const onSubmit = async (data: LoginFormData) => {
    try {
      const loginRes = await authApi.login(data.email.trim().toLowerCase(), data.password);
      const { accessToken, refreshToken } = loginRes.data;

      // Store token before /me so the interceptor can attach it
      sessionStorage.setItem('accessToken', accessToken);

      const meRes = await authApi.me();
      setAuth(meRes.data, accessToken, refreshToken);

      router.push('/command');
    } catch {
      setError('root', { message: 'Credenciales incorrectas.' });
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-5 w-full max-w-sm"
      aria-label="Formulario de inicio de sesion"
    >
      {isDemo && (
        <div className="bg-tactical-blue/10 border border-tactical-blue/20 rounded-xl px-4 py-3 text-center backdrop-blur-sm">
          <p className="text-tactical-blue text-xs font-medium">Modo demo — datos de prueba precargados</p>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm text-slate-400 font-medium">
          Email
        </label>
        <input
          id="email"
          type="text"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoComplete="email"
          placeholder="operador@velnari.mx"
          {...register('email')}
          className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-signal-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-tactical-blue/30 focus:border-tactical-blue/50 transition-all"
        />
        {errors.email && (
          <span className="text-red-400 text-xs flex items-center gap-1">
            <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
            {errors.email.message}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm text-slate-400 font-medium">
          Contrasena
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          {...register('password')}
          className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-signal-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-tactical-blue/30 focus:border-tactical-blue/50 transition-all"
        />
        {errors.password && (
          <span className="text-red-400 text-xs flex items-center gap-1">
            <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
            {errors.password.message}
          </span>
        )}
      </div>

      {errors.root && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-center backdrop-blur-sm">
          <p className="text-red-400 text-sm font-medium">{errors.root.message}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="relative bg-gradient-to-r from-tactical-blue to-blue-600 hover:from-blue-500 hover:to-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3.5 px-4 rounded-xl transition-all shadow-lg shadow-tactical-blue/20 hover:shadow-xl hover:shadow-tactical-blue/30 hover:-translate-y-0.5 disabled:hover:translate-y-0 disabled:hover:shadow-lg text-sm"
      >
        {isSubmitting ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Iniciando sesion...
          </span>
        ) : (
          'Iniciar sesion'
        )}
      </button>
    </form>
  );
}
