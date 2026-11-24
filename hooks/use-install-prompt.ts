'use client';

import { useEffect, useState, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Equipo y navegador, para dar las instrucciones correctas de instalacion.
 * - ios-safari / ios-other: en iPhone solo Safari puede instalar
 * - android / desktop-chromium: Chrome o Edge (ofrecen el aviso de instalar)
 * - desktop-other: Firefox o Safari de Mac (sin instalacion nativa)
 */
export type InstallPlatform = 'ios-safari' | 'ios-other' | 'android' | 'desktop-chromium' | 'desktop-other';

function detectPlatform(): InstallPlatform {
  const ua = window.navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
  if (ios) return /CriOS|FxiOS|EdgiOS|OPiOS|GSA/.test(ua) ? 'ios-other' : 'ios-safari';
  if (/Android/.test(ua)) return 'android';
  if (/Chrome|Chromium|Edg\//.test(ua) && !/OPR\//.test(ua)) return 'desktop-chromium';
  return 'desktop-other';
}

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [platform, setPlatform] = useState<InstallPlatform>('desktop-chromium');
  // El navegador avisa si se puede instalar unos instantes despues de cargar;
  // antes de eso no hay que concluir que "ya esta instalada"
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsInstalled(standalone);
    setPlatform(detectPlatform());

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setChecked(true);
    };
    const onAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    const timer = setTimeout(() => setChecked(true), 2500);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
      clearTimeout(timer);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    return outcome === 'accepted';
  }, [deferredPrompt]);

  return {
    canInstall: !!deferredPrompt,
    isInstalled,
    isIos: platform === 'ios-safari' || platform === 'ios-other',
    platform,
    checked,
    promptInstall,
  };
}
