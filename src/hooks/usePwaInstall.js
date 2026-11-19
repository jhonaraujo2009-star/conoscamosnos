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

const IN_APP_BROWSER_RE =
  /FBAN|FBAV|Instagram|Line\/|MicroMessenger|Snapchat|Twitter|TikTok|BytedanceWebview|WhatsApp|Telegram|; wv\)/i;

const DEFAULT_ANDROID_APK_URL = '/downloads/Conoscamosnos.apk';
const directDownloadUrl = String(
  import.meta.env.VITE_ANDROID_APK_URL || DEFAULT_ANDROID_APK_URL
).trim();

export function usePwaInstall() {
  const [deferred, setDeferred] = useState(() => {
    if (typeof window !== 'undefined' && !deferredInstallPrompt && window.__conoscamosnosInstallPrompt) {
      deferredInstallPrompt = window.__conoscamosnosInstallPrompt;
    }
    return deferredInstallPrompt;
  });
  const [isInstalled, setIsInstalled] = useState(checkIsStandalone);
  const [isRelatedAppInstalled, setIsRelatedAppInstalled] = useState(false);

  useEffect(() => {
    let active = true;
    if (typeof window !== 'undefined' && !deferredInstallPrompt && window.__conoscamosnosInstallPrompt) {
      deferredInstallPrompt = window.__conoscamosnosInstallPrompt;
      setDeferred(deferredInstallPrompt);
    }

    const sync = (evt) => {
      setDeferred(evt);
      setIsInstalled(checkIsStandalone());
    };
    listeners.add(sync);

    const onInstallReady = () => {
      if (typeof window !== 'undefined' && window.__conoscamosnosInstallPrompt) {
        deferredInstallPrompt = window.__conoscamosnosInstallPrompt;
        notifyListeners();
      }
    };

    const onInstalled = () => {
      setIsInstalled(true);
      deferredInstallPrompt = null;
      if (typeof window !== 'undefined') {
        window.__conoscamosnosInstallPrompt = null;
      }
      setDeferred(null);
    };
    window.addEventListener('appinstalled', onInstalled);
    window.addEventListener('conoscamosnos:install-ready', onInstallReady);
    window.addEventListener('conoscamosnos:app-installed', onInstalled);

    if (typeof navigator !== 'undefined' && typeof navigator.getInstalledRelatedApps === 'function') {
      navigator
        .getInstalledRelatedApps()
        .then((apps) => {
          if (active && Array.isArray(apps) && apps.length > 0) {
            setIsRelatedAppInstalled(true);
          }
        })
        .catch(() => {});
    }

    return () => {
      active = false;
      listeners.delete(sync);
      window.removeEventListener('appinstalled', onInstalled);
      window.removeEventListener('conoscamosnos:install-ready', onInstallReady);
      window.removeEventListener('conoscamosnos:app-installed', onInstalled);
    };
  }, []);

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isInAppBrowser = IN_APP_BROWSER_RE.test(ua);

  const openInAndroidChrome = useCallback(() => {
    if (typeof window === 'undefined') return false;
    const target = `${window.location.host}${window.location.pathname}${window.location.search}`;
    window.location.href = `intent://${target}#Intent;scheme=https;package=com.android.chrome;end`;
    return true;
  }, []);

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
      const cleanApkUrl = isAndroid ? String(customApkUrl || directDownloadUrl || '').trim() : '';
      if (cleanApkUrl && typeof document !== 'undefined') {
        const link = document.createElement('a');
        link.href = cleanApkUrl;
        link.download = 'Conoscamosnos.apk';
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

      if (isInstalled || isRelatedAppInstalled) {
        return { status: 'already_installed' };
      }

      if (isAndroid && isInAppBrowser) {
        openInAndroidChrome();
        return { status: 'opening_chrome' };
      }

      return { status: 'manual_required' };
    },
    [isAndroid, isInAppBrowser, isInstalled, isRelatedAppInstalled, openInAndroidChrome, promptInstall]
  );

  return {
    isInstalled: isInstalled || isRelatedAppInstalled,
    canInstallNative: Boolean(deferred),
    isAndroid,
    isIOS,
    isInAppBrowser,
    directDownloadUrl,
    promptInstall,
    downloadOrInstallApp,
    openInAndroidChrome,
  };
}
