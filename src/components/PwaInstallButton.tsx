import React, { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { useI18n } from '../i18n';
import { useToast } from './ui/ToastProvider';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const PwaInstallButton: React.FC = () => {
  const { lang } = useI18n();
  const toast = useToast();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIosMobile, setIsIosMobile] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      Boolean((window.navigator as unknown as { standalone?: boolean }).standalone);
    setIsStandalone(standalone);

    const ua = window.navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(ua) && !standalone;
    setIsIosMobile(ios);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (isStandalone || (!deferredPrompt && !isIosMobile)) return null;

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setDeferredPrompt(null);
      }
      return;
    }
    if (isIosMobile) {
      toast.info(
        lang === 'ar'
          ? 'على آيفون: اضغط على زر المشاركة ثم «إضافة إلى الشاشة الرئيسية»'
          : "Sur iPhone/iPad : appuyez sur Partager puis « Sur l'écran d'accueil »"
      );
    }
  };

  return (
    <button
      type="button"
      onClick={handleInstall}
      title={lang === 'ar' ? 'تثبيت التطبيق على الهاتف' : "Installer l'application sur l'écran d'accueil"}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 rounded-xl border border-emerald-200 dark:border-emerald-800 cursor-pointer"
    >
      <Download className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">{lang === 'ar' ? 'تثبيت التطبيق' : 'Installer'}</span>
    </button>
  );
};
