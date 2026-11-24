import React from 'react';
import { Printer, Pencil, Trash2, X, CheckCircle2 } from 'lucide-react';
import { BuildingInfo, PaymentRecord } from '../../types';
import { formatDZD, formatDateFr, formatMonthName, numberToFrenchWords } from '../../utils/helpers';
import { useI18n } from '../../i18n';

interface ReceiptModalProps {
  payment: PaymentRecord | null;
  building: BuildingInfo;
  onEdit?: (payment: PaymentRecord) => void;
  onDelete?: (payment: PaymentRecord) => void;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  payment,
  building,
  onEdit,
  onDelete,
  onClose,
}) => {
  const { lang, t } = useI18n();
  if (!payment) return null;

  const handlePrint = () => {
    window.print();
  };

  const includedItems =
    lang === 'ar'
      ? [
          '1. عقد الصيانة الوقائية للمصعدين',
          '2. فاتورة كهرباء سونلغاز (إنارة السلالم والمضخات)',
          '3. صيانة وتنظيف خزان المياه ومجموعة الضغط (الطابق السفلي)',
          '4. عامل النظافة وتنظيف الطوابق ومدخل العمارة',
        ]
      : [
          '1. Contrat de maintenance préventive des 2 ascenseurs (OTIS/Sigma)',
          "2. Facture électricité Sonelgaz (éclairage cages d'escalier et pompes)",
          "3. Entretien du groupe de surpression d'eau & bâche à eau (sous-sol)",
          "4. Agent d'entretien et nettoyage régulier des paliers et hall d'entrée",
        ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto print:static print:bg-transparent print:p-0 print:block">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-6 my-8 print:border-none print:shadow-none print:p-0 print:my-0 print:max-w-none">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 no-print">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {t('receiptModalTitle')}
            </h3>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {onEdit && (
              <button
                onClick={() => onEdit(payment)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 rounded-lg border border-amber-200 dark:border-amber-800 cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>{t('edit')}</span>
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(payment)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 rounded-lg border border-rose-200 dark:border-rose-800 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'حذف' : 'Supprimer'}</span>
              </button>
            )}
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>{t('printReceiptBtn')}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-8 bg-white text-slate-900 border border-slate-300 rounded-xl print-card print:border-none print:p-0 space-y-6 text-xs sm:text-sm font-sans">
          <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-start gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                {t('republicHeader')}
              </p>
              <h2 className="text-lg font-black tracking-tight text-slate-900 mt-1">
                {t('syndicOfficialHeader')}
              </h2>
              <p className="text-xs text-slate-600 font-medium">
                {building.residenceName} — {building.buildingNumber}
              </p>
              <p className="text-[11px] text-slate-500">
                {building.wilaya} · {building.gestImmoAgency}
              </p>
            </div>

            <div className="text-end">
              <span className="inline-block px-3 py-1 bg-slate-100 text-slate-900 font-mono font-bold text-xs rounded border border-slate-300">
                {payment.receiptNumber}
              </span>
              <p className="text-[11px] text-slate-500 mt-1">
                {t('collectionDate')} <br />
                <strong>{formatDateFr(payment.paymentDate, lang)}</strong>
              </p>
            </div>
          </div>

          <div className="bg-slate-100 p-3 rounded text-center border border-slate-200">
            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-900">
              {t('receiptDocTitle')}
            </h3>
            <p className="text-xs text-slate-600 font-medium mt-0.5">
              {t('period')} <strong>{formatMonthName(payment.month, lang)}</strong>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 py-2 border-b border-slate-200">
            <div className="space-y-1">
              <span className="text-[11px] text-slate-500 uppercase tracking-wider block">
                {t('residentCol')} :
              </span>
              <p className="font-bold text-sm text-slate-900">{payment.residentName}</p>
              <p className="text-xs text-slate-600">
                <strong>{payment.apartmentNumber}</strong>
              </p>
            </div>

            <div className="space-y-1 text-end">
              <span className="text-[11px] text-slate-500 uppercase tracking-wider block">
                {t('paymentMethodLabel')}
              </span>
              <p className="font-bold text-slate-900 flex items-center justify-end gap-1.5">
                <span>{payment.paymentMethod}</span>
                {payment.paymentMethod === 'Espèces' && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300">
                    {t('inCashLabel')}
                  </span>
                )}
              </p>
              <p className="text-xs text-slate-600">
                {t('collectedByLabel')} <strong>{payment.collectedBy}</strong>
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {includedItems.map((line, i) => (
              <div key={i} className="flex justify-between items-center py-1 text-xs">
                <span className="text-slate-600">{line}</span>
                <span className="font-mono text-slate-900">{lang === 'ar' ? 'مدرج' : 'Inclus'}</span>
              </div>
            ))}

            <div className="pt-3 border-t-2 border-slate-900 flex justify-between items-baseline">
              <span className="text-sm font-bold uppercase tracking-wider text-slate-900">
                {t('amountReceivedLabel')} {payment.paymentMethod === 'Espèces' ? t('inCashLabel') : ''} :
              </span>
              <span className="text-xl font-black font-mono tracking-tight text-slate-900">
                {formatDZD(payment.amountDZD, lang)}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded border border-slate-200 text-xs italic text-slate-700">
              {t('stoppedAtAmount')}{' '}
              <strong>
                {lang === 'ar'
                  ? `${formatDZD(payment.amountDZD, 'ar')} (${numberToFrenchWords(payment.amountDZD)})`
                  : numberToFrenchWords(payment.amountDZD)}
              </strong>
              .
            </div>
          </div>

          <div className="pt-6 grid grid-cols-2 gap-8 items-end text-xs">
            <div>
              <p className="text-slate-500 text-[11px]">{t('receiptLegalNote')}</p>
              <p className="text-[10px] text-slate-400 mt-2 font-mono">
                ID : {payment.id} · Gest-AADL
              </p>
            </div>

            <div className="text-center border border-dashed border-slate-300 rounded p-4 h-32 flex flex-col justify-between">
              <span className="text-[11px] font-bold uppercase text-slate-500">
                {t('stampAndSignature')}
              </span>
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
