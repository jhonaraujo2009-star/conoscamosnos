import { useCallback, useEffect, useState } from 'react';

let deferredInstallPrompt =
  typeof window !== 'undefined' ? window.__conoscamosnosInstallPrompt || null : null;
const listeners = new Set();

function notifyListeners() {
  listeners.forEach((cb) => cb(deferredInstallPrompt));
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    window.__conoscamosnosInstallPrompt = e;
    notifyListeners();
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    window.__conoscamosnosInstallPrompt = null;
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

const directDownloadUrl = String(import.meta.env.VITE_ANDROID_APK_URL || '').trim();

export function usePwaInstall() {
  const [deferred, setDeferred] = useState(() => {
    if (typeof window !== 'undefined' && !deferredInstallPrompt && window.__conoscamosnosInstallPrompt) {
      deferredInstallPrompt = window.__conoscamosnosInstallPrompt;
    }
    return deferredInstallPrompt;
  });
  const [isInstalled, setIsInstalled] = useState(checkIsStandalone);

  useEffect(() => {
    if (typeof window !== 'undefined' && !deferredInstallPrompt && window.__conoscamosnosInstallPrompt) {
      deferredInstallPrompt = window.__conoscamosnosInstallPrompt;
      setDeferred(deferredInstallPrompt);
    }

    const sync = (evt) => {
      setDeferred(evt);
      setIsInstalled(checkIsStandalone());
    };
    listeners.add(sync);

    const onInstalled = () => {
      setIsInstalled(true);
      deferredInstallPrompt = null;
      if (typeof window !== 'undefined') {
        window.__conoscamosnosInstallPrompt = null;
      }
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
    const promptEvt =
      deferredInstallPrompt ||
      (typeof window !== 'undefined' ? window.__conoscamosnosInstallPrompt : null);
    if (!promptEvt) {
      return { status: 'unavailable' };
    }
    try {
      await promptEvt.prompt();
      const choice = await promptEvt.userChoice;
      if (choice?.outcome === 'accepted') {
        deferredInstallPrompt = null;
        if (typeof window !== 'undefined') {
          window.__conoscamosnosInstallPrompt = null;
        }
        notifyListeners();
        setIsInstalled(true);
        return { status: 'accepted' };
      }
      return { status: 'dismissed' };
    } catch {
      return { status: 'error' };
    }
  }, []);

  const downloadOrInstallApp = useCallback(
    async ({ customApkUrl = '' } = {}) => {
      const cleanApkUrl = String(customApkUrl || directDownloadUrl || '').trim();
      if (cleanApkUrl && typeof document !== 'undefined') {
        const link = document.createElement('a');
        link.href = cleanApkUrl;
        link.download = '';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        link.remove();
        return { status: 'downloading_apk' };
      }

      const promptEvt =
        deferredInstallPrompt ||
        (typeof window !== 'undefined' ? window.__conoscamosnosInstallPrompt : null);
      if (promptEvt) {
        deferredInstallPrompt = promptEvt;
        return promptInstall();
      }

      return { status: 'manual_required' };
    },
    [promptInstall]
  );

  return {
    isInstalled,
    canInstallNative: Boolean(deferred),
    isAndroid,
    isIOS,
    directDownloadUrl,
    promptInstall,
    downloadOrInstallApp,
  };
}
