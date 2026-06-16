import './globals.css';
import Provider from '@/components/SessionProvider';
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister';

export const metadata = {
  title: 'DocSigner - PDF Signing & Stamping',
  description: 'Sign and stamp PDF documents with custom images',
  manifest: '/manifest.json',
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'DocSigner',
  },
  other: {
    'theme-color': '#1a73e8',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#1a73e8" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="apple-touch-icon" href="/logo.png" />
      </head>
      <body>
        <ServiceWorkerRegister />
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
