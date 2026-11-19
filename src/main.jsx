import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  const hadController = Boolean(navigator.serviceWorker.controller);
  let refreshing = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || refreshing) return;
    try {
      const now = Date.now();
      const last = Number(sessionStorage.getItem('conoscamosnos_sw_reloaded_at') || 0);
      if (last && now - last < 10000) return;
      sessionStorage.setItem('conoscamosnos_sw_reloaded_at', String(now));
    } catch {
      // Continuar aunque sessionStorage esté restringido
    }
    refreshing = true;
    window.location.reload();
  });

  const checkForSwUpdate = () => {
    navigator.serviceWorker
      .getRegistration('/')
      .then((reg) => reg?.update?.())
      .catch(() => {});
  };

  navigator.serviceWorker
    .register('/pwa-sw.js', { scope: '/' })
    .then((reg) => reg?.update?.())
    .catch(() => {});

  window.addEventListener('load', checkForSwUpdate, { once: true });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkForSwUpdate();
    }
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
