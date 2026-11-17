import { useCallback, useEffect, useState } from 'react';

let deferredInstallPrompt = null;
const listeners = new Set();

function notifyListeners() {
  listeners.forEach((cb) => cb(deferredInstallPrompt));
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    notifyListeners();
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    notifyListeners();
  });
}

function checkIsStandalone() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator?.standalone === true
  );
}

export function usePwaInstall() {
  const [deferred, setDeferred] = useState(deferredInstallPrompt);
  const [isInstalled, setIsInstalled] = useState(checkIsStandalone);

  useEffect(() => {
    const sync = (evt) => {
      setDeferred(evt);
      setIsInstalled(checkIsStandalone());
    };
    listeners.add(sync);

    const onInstalled = () => {
      setIsInstalled(true);
      setDeferred(null);
    };
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      listeners.delete(sync);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);

  const promptInstall = useCallback(async () => {
    if (!deferredInstallPrompt) {
      return { status: 'unavailable' };
    }
    try {
      await deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice;
      if (choice?.outcome === 'accepted') {
        deferredInstallPrompt = null;
        notifyListeners();
        setIsInstalled(true);
        return { status: 'accepted' };
      }
      return { status: 'dismissed' };
    } catch {
      return { status: 'error' };
    }
  }, []);

  return {
    isInstalled,
    canInstallNative: Boolean(deferred),
    isAndroid,
    isIOS,
    promptInstall,
  };
}
