import React, { useState } from 'react';
import { CreditCard, Camera, Trash2, Send, X, CheckCircle2 } from 'lucide-react';
import { PaymentMethod } from '../../types';
import {
  compressImageToDataUrl,
  formatDZD,
  formatMonthName,
  getAvailableFeePeriods,
  getCurrentMonthStr,
} from '../../utils/helpers';
import { useAppStore } from '../../stores/AppStore';
import { useI18n } from '../../i18n';
import { loadSavedResidentIdentity, saveResidentIdentity } from '../../components/IncidentChatDrawer';

interface DeclarePaymentModalProps {
  defaultApartmentId?: string;
  onClose: () => void;
}

export const DeclarePaymentModal: React.FC<DeclarePaymentModalProps> = ({
  defaultApartmentId,
  onClose,
}) => {
  const { lang, t } = useI18n();
  const { data, submitPaymentDeclaration } = useAppStore();
  const savedId = loadSavedResidentIdentity(data.apartments[0]?.number || '');

  const initialApt =
    data.apartments.find((a) => a.id === defaultApartmentId) ||
    data.apartments.find((a) => a.number === savedId.apartmentNumber) ||
    data.apartments[0];

  const activeSpecialCalls = (data.specialCalls || []).filter((c) => c.status === 'active');
  const availablePeriods = getAvailableFeePeriods(
    data.building.feeFrequency || 'annuel',
    data.payments,
    data.transactions
  );

  const [apartmentId, setApartmentId] = useState<string>(initialApt?.id || '');
  const [residentName, setResidentName] = useState<string>(savedId.name || '');
  const [targetType, setTargetType] = useState<'regular_fee' | 'special_call'>('regular_fee');
  const [period, setPeriod] = useState<string>(getCurrentMonthStr());
  const [specialCallId, setSpecialCallId] = useState<string>(activeSpecialCalls[0]?.id || '');
  const [amountDZD, setAmountDZD] = useState<number>(data.building.standardMonthlyFeeDZD);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('BaridiMob');
  const [reference, setReference] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [proofUrl, setProofUrl] = useState<string>('');
  const [compressing, setCompressing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const selectedApt = data.apartments.find((a) => a.id === apartmentId);

  const handleProofChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCompressing(true);
    try {
      const compressed = await compressImageToDataUrl(file, 960, 0.75);
      setProofUrl(compressed);
    } finally {
      setCompressing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApt || amountDZD <= 0 || submitting) return;
    setSubmitting(true);
    try {
      if (residentName.trim()) {
        saveResidentIdentity(selectedApt.number, residentName.trim());
      }
      const selectedCall = activeSpecialCalls.find((c) => c.id === specialCallId);
      const ok = await submitPaymentDeclaration({
        apartmentId: selectedApt.id,
        apartmentNumber: selectedApt.number,
        residentName: residentName.trim() || `Résident ${selectedApt.number}`,
        month: targetType === 'regular_fee' ? period : String(new Date().getFullYear()),
        specialCallId: targetType === 'special_call' ? specialCallId : undefined,
        specialCallTitle: targetType === 'special_call' ? selectedCall?.title : undefined,
        amountDZD: Number(amountDZD),
        paymentMethod,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
        proofDataUrl: proofUrl || undefined,
      });
      if (ok) onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 no-print">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 flex items-center justify-center shrink-0">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                {lang === 'ar'
                  ? 'إرسال إثبات دفع (بريدي موب / CCP)'
                  : 'Déclarer un virement BaridiMob / CCP'}
              </h3>
              <p className="text-[11px] text-slate-500">
                {lang === 'ar'
                  ? 'يتم التحقق منه من طرف الرئيس وإصدار الوصل الرسمي تلقائياً.'
                  : 'Validation en 1 clic par le Président et génération de votre quittance.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                {lang === 'ar' ? 'رقم الشقة *' : 'Votre logement *'}
              </label>
              <select
                value={apartmentId}
                onChange={(e) => setApartmentId(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
              >
                {data.apartments.map((apt) => (
                  <option key={apt.id} value={apt.id}>
                    {apt.number} ({apt.floor === 0 ? 'RDC' : `Étage ${apt.floor}`})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                {lang === 'ar' ? 'الاسم واللقب *' : 'Votre nom & prénom *'}
              </label>
              <input
                type="text"
                required
                value={residentName}
                onChange={(e) => setResidentName(e.target.value)}
                placeholder="Ex : M. Benali"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {activeSpecialCalls.length > 0 && (
            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => {
                  setTargetType('regular_fee');
                  setAmountDZD(data.building.standardMonthlyFeeDZD);
                }}
                className={`py-1.5 px-2.5 rounded-lg font-bold cursor-pointer ${
                  targetType === 'regular_fee'
                    ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-2xs'
                    : 'text-slate-500'
                }`}
              >
                {lang === 'ar' ? 'اشتراك عادي' : 'Cotisation Syndic'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setTargetType('special_call');
                  const first = activeSpecialCalls[0];
                  if (first) {
                    setSpecialCallId(first.id);
                    setAmountDZD(first.amountPerApartmentDZD);
                  }
                }}
                className={`py-1.5 px-2.5 rounded-lg font-bold cursor-pointer ${
                  targetType === 'special_call'
                    ? 'bg-white dark:bg-slate-900 text-sky-700 dark:text-sky-300 shadow-2xs'
                    : 'text-slate-500'
                }`}
              >
                {lang === 'ar' ? 'مساهمة مشروع خاص' : 'Appel Spécial AG'}
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {targetType === 'regular_fee' ? (
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('periodLabel')}
                </label>
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  {availablePeriods.map((p) => (
                    <option key={p} value={p}>
                      {formatMonthName(p, lang)}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {lang === 'ar' ? 'المشروع / النداء الاستثنائي' : 'Projet voté en AG'}
                </label>
                <select
                  value={specialCallId}
                  onChange={(e) => {
                    setSpecialCallId(e.target.value);
                    const found = activeSpecialCalls.find((c) => c.id === e.target.value);
                    if (found) setAmountDZD(found.amountPerApartmentDZD);
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  {activeSpecialCalls.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title} ({formatDZD(c.amountPerApartmentDZD, lang)})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                {t('amountDzdLabel')}
              </label>
              <input
                type="number"
                required
                min={100}
                value={amountDZD}
                onChange={(e) => setAmountDZD(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                {t('paymentMethodLabel')}
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value="BaridiMob">BaridiMob</option>
                <option value="Virement CCP">Virement CCP</option>
                <option value="Chèque">Chèque</option>
                <option value="Espèces">Espèces (Remis au Bureau)</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                {lang === 'ar' ? 'رقم معاملة بريدي موب / المرجع' : 'Réf. transaction BaridiMob / CCP'}
              </label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Ex : 0079999900..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
              />
            </div>
          </div>

          {/* Screenshot / Proof upload */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              {lang === 'ar'
                ? 'صورة وصل الدفع أو لقطة شاشة بريدي موب'
                : 'Capture d’écran BaridiMob ou photo du reçu CCP'}
            </label>
            {proofUrl ? (
              <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30">
                <div className="flex items-center gap-2.5">
                  <img src={proofUrl} alt="Reçu" className="w-12 h-12 rounded-lg object-cover border border-emerald-200" />
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-800 dark:text-emerald-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    {lang === 'ar' ? 'تم إرفاق وصل الدفع' : 'Justificatif joint'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setProofUrl('')}
                  className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 px-3 py-3 rounded-xl border border-dashed border-sky-300 dark:border-sky-800 bg-sky-50/40 dark:bg-sky-950/20 hover:border-sky-500 text-sky-800 dark:text-sky-200 font-semibold cursor-pointer">
                <Camera className="w-4 h-4 text-sky-600" />
                <span>
                  {compressing
                    ? 'Compression...'
                    : lang === 'ar'
                    ? 'إرفاق لقطة شاشة بريدي موب / وصل CCP'
                    : 'Joindre capture BaridiMob / reçu CCP'}
                </span>
                <input type="file" accept="image/*" onChange={handleProofChange} className="hidden" />
              </label>
            )}
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              {lang === 'ar' ? 'ملاحظة (اختياري)' : 'Observation (optionnel)'}
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={lang === 'ar' ? 'مثال: تسديد القسط الأول...' : 'Ex : Règlement 1ère tranche...'}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-500 cursor-pointer">
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting || compressing || amountDZD <= 0}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold cursor-pointer shadow-xs"
            >
              <Send className="w-3.5 h-3.5" />
              <span>
                {submitting
                  ? 'Envoi...'
                  : `${lang === 'ar' ? 'إرسال للرئيس' : 'Transmettre'} (${formatDZD(amountDZD, lang)})`}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
