import React, { useEffect, useState } from 'react';
import { PlusCircle, X, AlertTriangle } from 'lucide-react';
import { Apartment, AppData, PaymentMethod, PaymentRecord } from '../../types';
import { formatDZD, formatMonthName, getCurrentMonthStr } from '../../utils/helpers';
import { useI18n } from '../../i18n';

interface RecordPaymentModalProps {
  data: AppData;
  defaultApt?: Apartment | null;
  onClose: () => void;
  onSavePayment: (payment: PaymentRecord, openReceiptImmediately: boolean) => void;
}

export const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
  data,
  defaultApt,
  onClose,
  onSavePayment,
}) => {
  const { lang, t } = useI18n();
  const currentMonth = getCurrentMonthStr();
  const initialAptId = defaultApt ? defaultApt.id : data.apartments[0]?.id || '';
  const [selectedAptId, setSelectedAptId] = useState<string>(initialAptId);
  const [month, setMonth] = useState<string>(currentMonth);
  const [amount, setAmount] = useState<number>(() => {
    const alreadyPaid = data.payments
      .filter((p) => p.apartmentId === initialAptId && p.month === currentMonth)
      .reduce((sum, p) => sum + p.amountDZD, 0);
    const remaining = data.building.standardMonthlyFeeDZD - alreadyPaid;
    return remaining > 0 ? remaining : data.building.standardMonthlyFeeDZD;
  });
  const [method, setMethod] = useState<PaymentMethod>('Espèces');
  const [collectedBy, setCollectedBy] = useState<string>(data.building.syndicPresident);
  const [notes, setNotes] = useState<string>('Règlement cotisation en espèces');
  const [printDirectly, setPrintDirectly] = useState<boolean>(true);

  const selectedApt = data.apartments.find((a) => a.id === selectedAptId);
  const existingPaymentsForPeriod = data.payments.filter(
    (p) => p.apartmentId === selectedAptId && p.month === month
  );
  const existingTotalForPeriod = existingPaymentsForPeriod.reduce((sum, p) => sum + p.amountDZD, 0);

  useEffect(() => {
    const alreadyPaid = data.payments
      .filter((p) => p.apartmentId === selectedAptId && p.month === month)
      .reduce((sum, p) => sum + p.amountDZD, 0);
    const remaining = data.building.standardMonthlyFeeDZD - alreadyPaid;
    setAmount(remaining > 0 ? remaining : data.building.standardMonthlyFeeDZD);
  }, [selectedAptId, month, data.payments, data.building.standardMonthlyFeeDZD]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApt || amount <= 0) return;

    const prefix = `REC-${month}-`;
    const maxSeq = data.payments.reduce((max, p) => {
      if (p.receiptNumber.startsWith(prefix)) {
        const parsedSeq = parseInt(p.receiptNumber.slice(prefix.length), 10);
        if (!isNaN(parsedSeq) && parsedSeq > max) return parsedSeq;
      }
      return max;
    }, 0);
    const seq = String(maxSeq + 1).padStart(3, '0');
    const receiptNumber = `${prefix}${seq}`;

    const newPayment: PaymentRecord = {
      id: `pay-${month}-${Date.now()}`,
      receiptNumber,
      apartmentId: selectedApt.id,
      apartmentNumber: selectedApt.number,
      residentName: selectedApt.resident.name,
      month,
      amountDZD: Number(amount),
      paymentDate: new Date().toISOString(),
      paymentMethod: method,
      collectedBy,
      notes,
    };

    onSavePayment(newPayment, printDirectly);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 no-print">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-emerald-600" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {t('recordPaymentTitle')}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
              {t('aptResidentLabel')}
            </label>
            <select
              value={selectedAptId}
              onChange={(e) => setSelectedAptId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold"
              required
            >
              {data.apartments.map((apt) => (
                <option key={apt.id} value={apt.id}>
                  {apt.number} ({apt.floor === 0 ? t('rdcShort') : `${t('floor')} ${apt.floor}`}) — {apt.resident.name}
                </option>
              ))}
            </select>
          </div>

          {selectedApt && (
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-[11px]">
              <div>
                <span className="text-slate-400">{t('aadlFolder')} : </span>
                <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                  {selectedApt.resident.aadlFolderNumber || t('notProvided')}
                </span>
              </div>
              <div>
                <span className="text-slate-400">{t('phoneShort')} : </span>
                <span className="font-mono text-slate-700 dark:text-slate-300" dir="ltr">
                  {selectedApt.resident.phone}
                </span>
              </div>
            </div>
          )}

          {existingPaymentsForPeriod.length > 0 && (
            <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-start gap-2 text-[11px] text-amber-800 dark:text-amber-300">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <div>
                <strong>{t('duplicateWarningTitle')}</strong> {existingPaymentsForPeriod.length} ·{' '}
                <strong>{formatMonthName(month, lang)}</strong> ({formatDZD(existingTotalForPeriod, lang)} —{' '}
                {existingPaymentsForPeriod.map((p) => p.receiptNumber).join(', ')}).
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                {t('periodLabel')}
              </label>
              <select
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value="2026">{formatMonthName('2026', lang)}</option>
                <option value="2025">{formatMonthName('2025', lang)}</option>
                <option value="2027">{formatMonthName('2027', lang)}</option>
                <option value="2026-11">{formatMonthName('2026-11', lang)}</option>
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-700 dark:text-slate-300 font-medium">
                  {t('amountDzdLabel')}
                </label>
              </div>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold"
                required
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {[1000, 2000, 3000, 4000, 5000].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setAmount(preset)}
                className={`px-2 py-1 rounded text-[11px] font-mono cursor-pointer transition-colors ${
                  amount === preset
                    ? 'bg-emerald-600 text-white font-bold'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                }`}
              >
                {formatDZD(preset, lang)}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                {t('methodLabel')}
              </label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value="Espèces">Espèces / نقداً</option>
                <option value="BaridiMob">BaridiMob</option>
                <option value="Virement CCP">Virement CCP</option>
                <option value="Chèque">Chèque / صك</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                {t('collectedByLabel')}
              </label>
              <input
                type="text"
                value={collectedBy}
                onChange={(e) => setCollectedBy(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
              {t('notesRefLabel')}
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="printNow"
              checked={printDirectly}
              onChange={(e) => setPrintDirectly(e.target.checked)}
              className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
            />
            <label htmlFor="printNow" className="text-slate-700 dark:text-slate-300 font-medium cursor-pointer">
              {t('printAfterSave')}
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 dark:text-slate-400 cursor-pointer"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm cursor-pointer"
            >
              {t('validatePayment')} ({formatDZD(amount, lang)})
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
