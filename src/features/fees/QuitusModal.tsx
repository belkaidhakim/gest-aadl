import React from 'react';
import { Award, CheckCircle2, AlertTriangle, Printer, Share2, X } from 'lucide-react';
import { Apartment, BuildingInfo, PaymentRecord } from '../../types';
import {
  buildWhatsAppUrl,
  formatDZD,
  formatDateFr,
  formatMonthName,
  getDynamicYears,
} from '../../utils/helpers';
import { useI18n } from '../../i18n';
import { useToast } from '../../components/ui/ToastProvider';

interface QuitusModalProps {
  apartment: Apartment | null;
  building: BuildingInfo;
  payments: PaymentRecord[];
  onClose: () => void;
}

export const QuitusModal: React.FC<QuitusModalProps> = ({
  apartment,
  building,
  payments,
  onClose,
}) => {
  const { lang, t } = useI18n();
  const toast = useToast();

  if (!apartment) return null;

  const aptPayments = payments.filter((p) => p.apartmentId === apartment.id);
  const activeYears = getDynamicYears(payments).filter(
    (y) => Number(y) >= 2025 && Number(y) <= new Date().getFullYear()
  );
  const standardFee = building.standardMonthlyFeeDZD;

  const yearBalances = activeYears.map((yr) => {
    const paid = aptPayments
      .filter((p) => p.month === yr || p.month.startsWith(`${yr}-`))
      .reduce((s, p) => s + p.amountDZD, 0);
    const remaining = apartment.occupancy === 'vacant' ? 0 : Math.max(0, standardFee - paid);
    return { year: yr, paid, remaining };
  });

  const totalRemaining = yearBalances.reduce((s, b) => s + b.remaining, 0);
  const totalPaidAllTime = aptPayments.reduce((s, p) => s + p.amountDZD, 0);
  const isClear = totalRemaining === 0;
  const todayIso = new Date().toISOString().slice(0, 10);
  const docNumber = `QTS-${new Date().getFullYear()}-${apartment.number}`;

  const handleShareWhatsApp = () => {
    const text = [
      `🏅 *ATTESTATION DE QUITUS SYNDIC — ${building.buildingNumber}* (${building.residenceName})`,
      `📄 Réf : *${docNumber}* · Date : ${formatDateFr(todayIso, lang)}`,
      `🏠 Logement : *${apartment.number}* (${apartment.type} — Étage ${apartment.floor})`,
      `👤 Copropriétaire : *${apartment.resident.name}*`,
      isClear
        ? `✅ Situation : *LIBRE DE TOUTE DETTE DE COPROPRIÉTÉ (0 DZD restant)*`
        : `⚠️ Solde restant à apurer : *${formatDZD(totalRemaining, lang)}*`,
      `💰 Total cotisations réglées : ${formatDZD(totalPaidAllTime, lang)}`,
      '',
      `Délivré par le Président du Syndic — ${building.syndicPresident}`,
    ].join('\n');

    navigator.clipboard.writeText(text).catch(() => {});
    const direct = buildWhatsAppUrl(apartment.resident.phone, text);
    toast.success('Attestation copiée et prête pour WhatsApp');
    window.open(direct || `https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto print:static print:bg-transparent print:p-0 print:block">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 my-8 print:border-none print:shadow-none print:p-0 print:my-0 print:max-w-none">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 no-print">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-emerald-600" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {lang === 'ar' ? 'شهادة براءة الذمة (Quitus A4)' : 'Attestation de Quitus Syndic (A4)'}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleShareWhatsApp}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 rounded-lg border border-emerald-200 dark:border-emerald-800 cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>{t('printA4')}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-8 bg-white text-slate-900 border border-slate-300 rounded-xl print-card print:border-none print:p-0 space-y-6 text-xs sm:text-sm font-sans">
          {/* Official Header */}
          <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-start gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                {t('republicHeader')}
              </p>
              <h2 className="text-lg font-black tracking-tight text-slate-900 mt-1">
                {t('syndicOfficialHeader')}
              </h2>
              <p className="text-xs text-slate-600 font-medium">
                {building.residenceName} — {building.buildingNumber} ({building.wilaya})
              </p>
            </div>
            <div className="text-end">
              <span className="inline-block px-3 py-1 bg-slate-100 text-slate-900 font-mono font-bold text-xs rounded border border-slate-300">
                {docNumber}
              </span>
              <p className="text-[11px] text-slate-500 mt-1">
                Délivré le <strong>{formatDateFr(todayIso, lang)}</strong>
              </p>
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl text-center">
            <h3 className="text-sm sm:text-base font-black uppercase tracking-widest text-emerald-950">
              {isClear
                ? 'ATTESTATION DE QUITUS DE CHARGES DE COPROPRIÉTÉ'
                : 'RELEVÉ DE SITUATION DE CHARGES DE COPROPRIÉTÉ'}
            </h3>
            <p className="text-[11px] text-emerald-800 mt-0.5">
              Document officiel valable pour dossier de vente, location ou régularisation AADL / Gest-Immo
            </p>
          </div>

          <div className="space-y-3 leading-relaxed text-slate-800">
            <p>
              Je soussigné, <strong>{building.syndicPresident}</strong>, agissant en qualité de Président du Comité
              Syndical des Copropriétaires du bâtiment <strong>{building.buildingNumber}</strong> ({building.residenceName},{' '}
              {building.wilaya}), atteste par la présente que le logement désigné ci-dessous :
            </p>

            <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <div>
                <span className="text-slate-500 block">Logement :</span>
                <strong className="text-sm text-slate-900">
                  Porte {apartment.number} ({apartment.type} · {apartment.surfaceM2} m² ·{' '}
                  {apartment.floor === 0 ? 'RDC' : `Étage ${apartment.floor}`})
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block">Copropriétaire titulaire :</span>
                <strong className="text-sm text-slate-900">{apartment.resident.name}</strong>
                {apartment.resident.aadlFolderNumber && (
                  <span className="block font-mono text-[11px] text-slate-600">
                    Dossier AADL : {apartment.resident.aadlFolderNumber}
                  </span>
                )}
              </div>
            </div>

            {isClear ? (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 flex items-center gap-2.5 text-emerald-950 font-semibold">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>
                  Est entièrement <strong>À JOUR (LIBRE DE TOUTE DETTE)</strong> vis-à-vis de la trésorerie du Syndic
                  à la date du {formatDateFr(todayIso, lang)}.
                </span>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 flex items-center gap-2.5 text-amber-950 font-semibold">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <span>
                  Présente un solde restant à régulariser de <strong>{formatDZD(totalRemaining, lang)}</strong> sur les
                  exercices en cours.
                </span>
              </div>
            )}
          </div>

          {/* Summary Table */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Détail des exercices & quittances enregistrées ({aptPayments.length})
            </h4>
            <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="py-2 px-3 text-start">Période / Quittance</th>
                  <th className="py-2 px-3 text-start">Date & Mode</th>
                  <th className="py-2 px-3 text-end">Montant réglé</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {aptPayments.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-3 px-3 text-center text-slate-400">
                      Aucun versement enregistré
                    </td>
                  </tr>
                ) : (
                  aptPayments.slice(0, 8).map((p) => (
                    <tr key={p.id}>
                      <td className="py-1.5 px-3 font-medium">
                        {formatMonthName(p.month, lang)} · <span className="font-mono">{p.receiptNumber}</span>
                      </td>
                      <td className="py-1.5 px-3 text-slate-600">
                        {formatDateFr(p.paymentDate.slice(0, 10), lang)} ({p.paymentMethod})
                      </td>
                      <td className="py-1.5 px-3 text-end font-mono font-bold">{formatDZD(p.amountDZD, lang)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="pt-6 grid grid-cols-2 gap-8 items-end text-xs">
            <div>
              <p className="text-slate-600 text-[11px]">
                La présente attestation est délivrée à l’intéressé(e) pour servir et valoir ce que de droit.
              </p>
              <p className="text-[10px] text-slate-400 mt-2 font-mono">
                Réf : {docNumber} · Généré via Gest-AADL
              </p>
            </div>

            <div className="text-center border border-dashed border-slate-300 rounded p-4 h-32 flex flex-col justify-between">
              <span className="text-[11px] font-bold uppercase text-slate-500">{t('stampAndSignature')}</span>
              <div className="text-xs font-semibold text-slate-800">
                {building.syndicPresident}
                <br />
                <span className="text-[10px] text-slate-500">{t('syndicPresidentRole')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
