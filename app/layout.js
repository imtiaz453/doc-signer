import './globals.css';
import Provider from '@/components/SessionProvider';

export const metadata = {
  title: 'DocSigner - PDF Signing & Stamping',
  description: 'Sign and stamp PDF documents with custom images',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
