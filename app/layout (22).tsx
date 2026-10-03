import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Tild@ · Costa Norte Mayorista',
  description: 'Pedidos de helados y productos al por mayor y menor',
  icons: {
    icon: '/brand/tilda-favicon-32.png',
    apple: '/brand/tilda-apple-touch-icon.png',
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Tild@',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <meta name="theme-color" content="#092868" />
      </head>
      <body className="font-body">{children}</body>
    </html>
  );
}
