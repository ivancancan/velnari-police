import type { Metadata } from 'next';
import './globals.css';

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
        {children}
      </body>
    </html>
  );
}
