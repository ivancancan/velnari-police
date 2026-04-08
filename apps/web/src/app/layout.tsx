import type { Metadata } from 'next';
import './globals.css';
import Polyfills from '@/components/Polyfills';

export const metadata: Metadata = {
  title: 'Velnari Command',
  description: 'El sistema operativo de la seguridad municipal.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="bg-midnight-command text-signal-white min-h-screen">
        <Polyfills />
        {children}
      </body>
    </html>
  );
}
