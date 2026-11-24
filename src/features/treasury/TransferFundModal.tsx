import React, { useState } from 'react';
import { ArrowLeftRight, AlertTriangle, X, Shield, PiggyBank } from 'lucide-react';
import { Transaction } from '../../types';
import { formatDZD } from '../../utils/helpers';
import { useI18n } from '../../i18n';

interface TransferFundModalProps {
  courantBalance: number;
  reserveBalance: number;
  onClose: () => void;
  onTransfer: (outTx: Transaction, inTx: Transaction) => Promise<void>;
}

export const TransferFundModal: React.FC<TransferFundModalProps> = ({
  courantBalance,
  reserveBalance,
  onClose,
  onTransfer,
}) => {
  const { lang, t } = useI18n();
  const [direction, setDirection] = useState<'courant_to_reserve' | 'reserve_to_courant'>('courant_to_reserve');
  const [amountDZD, setAmountDZD] = useState<number>(20000);
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState<string>(
    lang === 'ar' ? 'تحويل لصندوق الاحتياط للأشغال الكبرى' : 'Dotation mensuelle au Fonds de Réserve Travaux'
  );
  const [submitting, setSubmitting] = useState(false);

  const sourceBalance = direction === 'courant_to_reserve' ? courantBalance : reserveBalance;
  const delta = Number(amountDZD) || 0;
  const nextCourant = direction === 'courant_to_reserve' ? courantBalance - delta : courantBalance + delta;
  const nextReserve = direction === 'courant_to_reserve' ? reserveBalance + delta : reserveBalance - delta;
  const exceedsSource = delta > sourceBalance;

  const handleDirectionChange = (nextDir: 'courant_to_reserve' | 'reserve_to_courant') => {
    setDirection(nextDir);
    setNotes(
      nextDir === 'courant_to_reserve'
        ? lang === 'ar'
          ? 'تحويل لصندوق الاحتياط للأشغال الكبرى'
          : 'Dotation au Fonds de Réserve Travaux'
        : lang === 'ar'
        ? 'صرف مبلغ من صندوق الاحتياط بموافقة الجمعية'
        : 'Déblocage exceptionnel du Fonds de Réserve vers Courant'
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (delta <= 0 || submitting) return;

    setSubmitting(true);
    try {
      const refCode = `VIR-${date.replace(/-/g, '')}-${String(Date.now()).slice(-4)}`;
      const fromFund = direction === 'courant_to_reserve' ? 'courant' : 'reserve';
      const toFund = direction === 'courant_to_reserve' ? 'reserve' : 'courant';

      const outTx: Transaction = {
        id: `tx-vir-out-${Date.now()}`,
        date,
        type: 'depense',
        fund: fromFund,
        category: 'Dotation Fonds de Réserve',
        amountDZD: delta,
        description: notes.trim() || refCode,
        referenceDoc: refCode,
        paymentMethod: 'Autre',
      };

      const inTx: Transaction = {
        id: `tx-vir-in-${Date.now() + 1}`,
        date,
        type: 'recette',
        fund: toFund,
        category: 'Dotation Fonds de Réserve',
        amountDZD: delta,
        description: notes.trim() || refCode,
        referenceDoc: refCode,
        paymentMethod: 'Autre',
      };

      await onTransfer(outTx, inTx);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 no-print">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-sky-600" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {lang === 'ar' ? 'تحويل داخلي بين الصندوقين' : 'Virement interne entre enveloppes'}
            </h3>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Direction Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleDirectionChange('courant_to_reserve')}
              className={`p-3 rounded-xl border text-start cursor-pointer transition-all ${
                direction === 'courant_to_reserve'
                  ? 'bg-sky-50 dark:bg-sky-950/40 border-sky-500 ring-1 ring-sky-500/40'
                  : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
              }`}
            >
              <div className="font-bold text-slate-900 dark:text-white">
                {lang === 'ar' ? 'الجاري ← الاحتياط' : 'Courant → Réserve'}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {lang === 'ar' ? 'تخصيص مدخرات للأشغال الكبرى' : 'Provisionner le fonds de réserve'}
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleDirectionChange('reserve_to_courant')}
              className={`p-3 rounded-xl border text-start cursor-pointer transition-all ${
                direction === 'reserve_to_courant'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 ring-1 ring-emerald-500/40'
                  : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
              }`}
            >
              <div className="font-bold text-slate-900 dark:text-white">
                {lang === 'ar' ? 'الاحتياط ← الجاري' : 'Réserve → Courant'}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {lang === 'ar' ? 'صرف احتياطي بقرار الجمعية' : 'Débloquer vers le budget courant'}
              </div>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                {t('amountDzdLabel')}
              </label>
              <input
                type="number"
                min="1"
                step="500"
                required
                value={amountDZD}
                onChange={(e) => setAmountDZD(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold text-sm"
              />
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                {lang === 'ar' ? 'التاريخ' : 'Date'}
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Live Before -> After Preview */}
          <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
            <div>
              <span className="text-[11px] font-semibold text-slate-500 inline-flex items-center gap-1">
                <Shield className="w-3.5 h-3.5 text-emerald-600" />
                {t('currentFund')}
              </span>
              <div className="text-[11px] font-mono text-slate-400 mt-1">{formatDZD(courantBalance, lang)}</div>
              <div className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                → {formatDZD(nextCourant, lang)}
              </div>
            </div>
            <div>
              <span className="text-[11px] font-semibold text-slate-500 inline-flex items-center gap-1">
                <PiggyBank className="w-3.5 h-3.5 text-sky-600" />
                {t('reserveFund')}
              </span>
              <div className="text-[11px] font-mono text-slate-400 mt-1">{formatDZD(reserveBalance, lang)}</div>
              <div className="font-mono font-bold text-sm text-sky-700 dark:text-sky-300">
                → {formatDZD(nextReserve, lang)}
              </div>
            </div>
          </div>

          {exceedsSource && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                {lang === 'ar'
                  ? 'تنبيه: المبلغ يتجاوز الرصيد المتاح في الصندوق المصدر.'
                  : 'Attention : le montant dépasse le solde disponible dans le fonds source.'}
              </span>
            </div>
          )}

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
              {lang === 'ar' ? 'السبب / الملاحظة' : 'Motif du virement'}
            </label>
            <input
              type="text"
              required
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-500 cursor-pointer">
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting || delta <= 0}
              className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-semibold cursor-pointer shadow-xs"
            >
              {lang === 'ar' ? 'تأكيد التحويل' : 'Exécuter le virement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
