'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import * as Sentry from '@sentry/nextjs';

// Global crash guard — prevents a single render error from taking down the
// whole Command Center. Operators see a tactical "try again" card instead
// of a white screen during an active shift. Errors are forwarded to Sentry
// if wired (NEXT_PUBLIC_SENTRY_DSN), otherwise logged to console as last resort.

interface Props {
  children: ReactNode;
  /** Optional custom fallback. If omitted, uses the default tactical card. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    try {
      Sentry.captureException(error, {
        contexts: { react: { componentStack: info.componentStack ?? '' } },
      });
    } catch {
      // Sentry not initialized — fall back to console so dev sees it.
      // eslint-disable-next-line no-console
      console.error('[ErrorBoundary]', error, info.componentStack);
    }
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <div className="min-h-screen flex items-center justify-center bg-midnight-command p-6">
        <div className="max-w-md w-full bg-slate-900 border border-slate-700 rounded-lg p-8 shadow-2xl">
          <div className="text-4xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold text-signal-white mb-2">
            Ocurrió un error inesperado
          </h1>
          <p className="text-sm text-slate-400 mb-6">
            La aplicación encontró un problema. Si el problema persiste, reporta con soporte indicando el mensaje de abajo.
          </p>
          <details className="text-xs text-slate-500 mb-6 font-mono">
            <summary className="cursor-pointer mb-2">Detalles técnicos</summary>
            <pre className="whitespace-pre-wrap break-words bg-slate-950 p-3 rounded border border-slate-800">
              {error.message}
            </pre>
          </details>
          <div className="flex gap-3">
            <button
              onClick={this.reset}
              className="flex-1 bg-tactical-blue text-signal-white px-4 py-2 rounded font-semibold hover:bg-tactical-blue/90 transition-colors"
            >
              Reintentar
            </button>
            <button
              onClick={() => {
                if (typeof window !== 'undefined') window.location.href = '/';
              }}
              className="flex-1 bg-slate-700 text-signal-white px-4 py-2 rounded font-semibold hover:bg-slate-600 transition-colors"
            >
              Ir al inicio
            </button>
          </div>
        </div>
      </div>
    );
  }
}
