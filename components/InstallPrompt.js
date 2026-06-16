'use client';

import { useEffect, useState } from 'react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(true);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches;
    setIsStandalone(isStandaloneMode);

    if (isStandaloneMode) {
      setShowPrompt(false);
      return;
    }

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    window.addEventListener('appinstalled', () => {
      setShowPrompt(false);
      setDeferredPrompt(null);
    });

    setTimeout(() => {
      setShowPrompt(true);
    }, 3000);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === 'accepted') {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  if (isStandalone) return null;
  if (!showPrompt) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      background: '#1a73e8',
      color: '#fff',
      padding: '16px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      zIndex: 9999,
      boxShadow: '0 -2px 10px rgba(0,0,0,0.2)',
    }}>
      <span>Install DocSigner for the best experience</span>
      <div>
        <button
          onClick={handleInstall}
          style={{
            background: '#fff',
            color: '#1a73e8',
            border: 'none',
            padding: '8px 20px',
            borderRadius: '4px',
            fontWeight: 600,
            cursor: 'pointer',
            marginRight: 8,
          }}
        >
          {deferredPrompt ? 'Install' : 'Open in Chrome/Edge'}
        </button>
        <button
          onClick={() => setShowPrompt(false)}
          style={{
            background: 'transparent',
            color: '#fff',
            border: '1px solid #fff',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
