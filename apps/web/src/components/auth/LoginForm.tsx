'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginForm() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<LoginFormData>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginFormData) => {
    try {
      const loginRes = await authApi.login(data.email, data.password);
      const { accessToken, refreshToken } = loginRes.data;

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
      className="flex flex-col gap-4 w-full max-w-sm"
      aria-label="Formulario de inicio de sesión"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm text-slate-gray">
          Email
        </label>
        <input
          id="email"
          type="text"
          inputMode="email"
          autoComplete="email"
          placeholder="operador@velnari.mx"
          {...register('email')}
          className="bg-slate-800 border border-slate-700 rounded px-3 py-2 text-signal-white focus:outline-none focus:border-tactical-blue"
        />
        {errors.email && (
          <span className="text-red-400 text-xs">{errors.email.message}</span>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm text-slate-gray">
          Contraseña
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          {...register('password')}
          className="bg-slate-800 border border-slate-700 rounded px-3 py-2 text-signal-white focus:outline-none focus:border-tactical-blue"
        />
        {errors.password && (
          <span className="text-red-400 text-xs">{errors.password.message}</span>
        )}
      </div>

      {errors.root && (
        <p className="text-red-400 text-sm text-center">{errors.root.message}</p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="bg-tactical-blue hover:bg-blue-600 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded transition-colors"
      >
        {isSubmitting ? 'Iniciando sesión...' : 'Iniciar sesión'}
      </button>
    </form>
  );
}
