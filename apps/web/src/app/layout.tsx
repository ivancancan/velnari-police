import type { Metadata } from 'next';
import './globals.css';
import Polyfills from '@/components/Polyfills';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export const metadata: Metadata = {
  title: 'Velnari Command',
  description: 'El sistema operativo de la seguridad municipal.',
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="bg-midnight-command text-signal-white min-h-screen">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-tactical-blue focus:text-white focus:px-4 focus:py-2 focus:rounded">
          Ir al contenido principal
        </a>
        <Polyfills />
        <ErrorBoundary>{children}</ErrorBoundary>
      </body>
    </html>
  );
}
