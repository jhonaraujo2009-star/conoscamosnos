import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';

if (typeof window !== 'undefined') {
  const CURRENT_BUILD_ID = String(import.meta.env.VITE_APP_BUILD_ID || '').trim();
  const hasServiceWorker = 'serviceWorker' in navigator;
  let refreshing = false;
  let lastVersionCheckAt = 0;

  const purgeLegacyHtmlCaches = async () => {
    if (!('caches' in window)) return;
    try {
      const keys = await window.caches.keys();
      await Promise.all(
        keys
          .filter((key) => key === 'conoscamosnos-pages' || key.startsWith('conoscamosnos-pages'))
          .map((key) => window.caches.delete(key))
      );
    } catch {
      // Ignorar si Cache Storage no está disponible
    }
  };

  const purgeAllAppCaches = async () => {
    if (!('caches' in window)) return;
    try {
      const keys = await window.caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== 'cloudinary-images')
          .map((key) => window.caches.delete(key))
      );
    } catch {
      // Ignorar si Cache Storage no está disponible
    }
  };

  const safeReloadOnce = (versionKey = '') => {
    if (refreshing) return;
    try {
      if (versionKey) {
        const lastVersion = sessionStorage.getItem('conoscamosnos_reloaded_version') || '';
        if (lastVersion === versionKey) return;
      }
      const now = Date.now();
      const lastAt = Number(sessionStorage.getItem('conoscamosnos_sw_reloaded_at') || 0);
      if (lastAt && now - lastAt < 10000) return;
      if (versionKey) {
        sessionStorage.setItem('conoscamosnos_reloaded_version', versionKey);
      }
      sessionStorage.setItem('conoscamosnos_sw_reloaded_at', String(now));
    } catch {
      // Continuar aunque sessionStorage esté restringido
    }
    refreshing = true;
    window.location.reload();
  };

  const cleanupStrayRootServiceWorkers = async () => {
    if (!hasServiceWorker) return;
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      const rootScope = `${window.location.origin}/`;
      await Promise.all(
        registrations.map((reg) => {
          if (reg.scope !== rootScope) return null;
          const scriptUrl =
            reg.active?.scriptURL || reg.waiting?.scriptURL || reg.installing?.scriptURL || '';
          if (scriptUrl && !scriptUrl.endsWith('/pwa-sw.js')) {
            return reg.unregister();
          }
          return null;
        })
      );
    } catch {
      // Ignorar si getRegistrations no está disponible
    }
  };

  const checkForSwUpdate = () => {
    if (!hasServiceWorker) return;
    navigator.serviceWorker
      .getRegistration('/')
      .then((reg) => reg?.update?.())
      .catch(() => {});
  };

  const checkRemoteVersion = async (force = false) => {
    if (!import.meta.env.PROD || !CURRENT_BUILD_ID || refreshing) return;
    const now = Date.now();
    if (!force && now - lastVersionCheckAt < 30000) return;
    lastVersionCheckAt = now;

    try {
      const res = await fetch(`/version.json?t=${now}`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      const remoteBuildId = String(data?.buildId || '').trim();
      if (remoteBuildId && remoteBuildId !== CURRENT_BUILD_ID) {
        await purgeAllAppCaches();
        checkForSwUpdate();
        safeReloadOnce(remoteBuildId);
      }
    } catch {
      // Sin conexión o error temporal de red; mantener sesión actual
    }
  };

  purgeLegacyHtmlCaches();

  if (hasServiceWorker) {
    const hadController = Boolean(navigator.serviceWorker.controller);

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || refreshing) return;
      safeReloadOnce('sw-controller');
    });

    cleanupStrayRootServiceWorkers().finally(() => {
      navigator.serviceWorker
        .register('/pwa-sw.js', { scope: '/', updateViaCache: 'none' })
        .then((reg) => reg?.update?.())
        .catch(() => {});
    });

    window.addEventListener('load', checkForSwUpdate, { once: true });
  }

  checkRemoteVersion(true);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkForSwUpdate();
      checkRemoteVersion(false);
    }
  });

  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      checkForSwUpdate();
      checkRemoteVersion(true);
    }
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
