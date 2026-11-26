import React from 'react';
import { QrCode, Printer, Copy, X, Smartphone, MessageSquare, CreditCard, ShieldCheck } from 'lucide-react';
import { BuildingInfo } from '../types';
import { useI18n } from '../i18n';
import { useToast } from './ui/ToastProvider';

interface HallQrPosterModalProps {
  building: BuildingInfo;
  onClose: () => void;
}

export const HallQrPosterModal: React.FC<HallQrPosterModalProps> = ({ building, onClose }) => {
  const { lang, t } = useI18n();
  const toast = useToast();

  const portalUrl =
    typeof window !== 'undefined' && window.location.origin
      ? window.location.origin
      : 'https://gest-aadl.vercel.app';
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=10&data=${encodeURIComponent(
    portalUrl
  )}`;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(portalUrl);
    toast.success(lang === 'ar' ? 'تم نسخ رابط المنصة' : 'Lien du portail copié');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto print:static print:bg-transparent print:p-0 print:block">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 my-8 print:border-none print:shadow-none print:p-0 print:my-0 print:max-w-none">
        {/* Toolbar */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 no-print">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-emerald-600" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {lang === 'ar' ? 'ملصق رمز QR لبهو العمارة (A4)' : 'Affiche Hall A4 — QR Code Portail Résidents'}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyUrl}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? 'نسخ الرابط' : 'Copier le lien'}</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>{t('printA4')}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable A4 Poster */}
        <div className="p-8 bg-white text-slate-900 border-2 border-slate-900 rounded-2xl print-card print:border-2 print:border-slate-900 space-y-6 text-center font-sans">
          <div className="space-y-1.5 border-b-2 border-emerald-600 pb-4">
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">
              COMITÉ SYNDICAL DES COPROPRIÉTAIRES · مكتب نقابة الملاك
            </p>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
              {building.buildingNumber} — {building.residenceName}
            </h1>
            <p className="text-xs text-slate-600 font-semibold">
              {building.wilaya} · {building.ilot}
            </p>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-1">
            <h2 className="text-lg font-extrabold text-emerald-950">
              📱 PORTAIL NUMÉRIQUE DES RÉSIDENTS
            </h2>
            <p className="text-sm font-bold text-emerald-800" dir="rtl">
              البوابة الرقمية لسكان العمارة — امسح رمز QR بهاتفك
            </p>
          </div>

          {/* QR Code Centerpiece */}
          <div className="flex flex-col items-center justify-center space-y-3 py-2">
            <div className="p-4 bg-white border-4 border-slate-900 rounded-3xl shadow-sm inline-block">
              <img
                src={qrImageUrl}
                alt="QR Code Portail Gest-AADL"
                className="w-52 h-52 sm:w-60 sm:h-60 object-contain"
              />
            </div>
            <div className="px-4 py-1.5 rounded-full bg-slate-100 border border-slate-300 font-mono font-bold text-sm text-slate-900">
              {portalUrl}
            </div>
          </div>

          {/* 4 Features Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-start text-xs">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2.5">
              <MessageSquare className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-slate-900">Signalement Pannes & Chat Direct</strong>
                <span className="text-slate-600">
                  Signalez un arrêt d’ascenseur ou d’eau avec photo et échangez en direct avec le Président.
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2.5">
              <CreditCard className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-slate-900">Paiement BaridiMob / CCP</strong>
                <span className="text-slate-600">
                  Transmettez votre reçu de virement depuis votre téléphone et recevez votre quittance officielle.
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2.5">
              <ShieldCheck className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-slate-900">Espace « Mon Logement » (Code PIN)</strong>
                <span className="text-slate-600">
                  Consultez vos cotisations, imprimez vos reçus et votez aux consultations AG en toute confidentialité.
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2.5">
              <Smartphone className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-slate-900">Installation sur téléphone (PWA)</strong>
                <span className="text-slate-600">
                  Ouvrez le lien puis cliquez sur « Installer l’application » pour un accès en 1 clic.
                </span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
            <span>
              Président du Syndic : <strong>{building.syndicPresident}</strong>
            </span>
            <span className="font-mono font-bold" dir="ltr">
              📞 {building.syndicPhone}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
