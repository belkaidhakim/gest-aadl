import React, { useState } from 'react';
import {
  KeyRound,
  CheckCircle2,
  Clock,
  FileCheck,
  CreditCard,
  Lock,
  LogOut,
  X,
  ShieldCheck,
} from 'lucide-react';
import { PaymentRecord } from '../../types';
import { MyApartmentPrivateSummary } from '../../services/api';
import { formatDZD, formatDateFr, formatMonthName, getCurrentMonthStr } from '../../utils/helpers';
import { useAppStore } from '../../stores/AppStore';
import { useI18n } from '../../i18n';

interface MyApartmentModalProps {
  onClose: () => void;
  onViewReceipt?: (payment: PaymentRecord) => void;
  onOpenDeclarePayment: (apartmentId: string) => void;
}

export const MyApartmentModal: React.FC<MyApartmentModalProps> = ({
  onClose,
  onViewReceipt,
  onOpenDeclarePayment,
}) => {
  const { lang, t } = useI18n();
  const { data, fetchMyApartmentByPin } = useAppStore();

  const [apartmentId, setApartmentId] = useState<string>(data.apartments[0]?.id || '');
  const [pin, setPin] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<MyApartmentPrivateSummary | null>(null);

  const currentPeriod = getCurrentMonthStr();
  const standardFee = data.building.standardMonthlyFeeDZD;

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apartmentId || pin.trim().length < 4 || loading) return;
    setLoading(true);
    try {
      const res = await fetchMyApartmentByPin(apartmentId, pin.trim());
      if (res) {
        setSummary(res);
      }
    } finally {
      setLoading(false);
    }
  };

  const paidCurrentPeriod = summary
    ? summary.payments
        .filter((p) => p.month === currentPeriod)
        .reduce((s, p) => s + p.amountDZD, 0)
    : 0;
  const remainingCurrentPeriod = Math.max(0, standardFee - paidCurrentPeriod);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 no-print">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center shrink-0">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                {lang === 'ar' ? 'فضاء شقتي الخاص (بواسطة الرمز السري)' : 'Mon Logement — Espace Privé'}
              </h3>
              <p className="text-[11px] text-slate-500">
                {lang === 'ar'
                  ? 'اطلع بسرية على وصولات الدفع ووضعية شقتك فقط.'
                  : 'Consultez confidentiellement vos cotisations et téléchargez vos quittances.'}
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

        {!summary ? (
          <form onSubmit={handleUnlock} className="space-y-4 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-start gap-2.5 text-slate-600 dark:text-slate-300">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                {lang === 'ar'
                  ? 'أدخل رقم شقتك والرمز السري المكون من 4 أرقام المسلّم لك من طرف رئيس السانديك.'
                  : 'Sélectionnez votre porte et saisissez le Code PIN à 4 chiffres remis par le Président du Syndic.'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {lang === 'ar' ? 'الشقة' : 'Porte / Appartement'}
                </label>
                <select
                  value={apartmentId}
                  onChange={(e) => setApartmentId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
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
                  {lang === 'ar' ? 'الرمز السري (4 أرقام)' : 'Code PIN (4 chiffres)'}
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  required
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="••••"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-center text-base tracking-[0.5em]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="px-4 py-2 text-slate-500 cursor-pointer">
                {t('cancel')}
              </button>
              <button
                type="submit"
                disabled={loading || pin.length < 4}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold cursor-pointer shadow-xs"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>{loading ? 'Vérification...' : lang === 'ar' ? 'فتح فضاء شقتي' : 'Accéder à mon dossier'}</span>
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4 text-xs">
            {/* Apartment Banner */}
            <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-bold uppercase text-emerald-700 dark:text-emerald-300">
                  Porte {summary.apartment.number} · {summary.apartment.type} (
                  {summary.apartment.floor === 0 ? 'RDC' : `Étage ${summary.apartment.floor}`})
                </div>
                <div className="text-base font-extrabold text-slate-900 dark:text-white">
                  {summary.apartment.residentName}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {remainingCurrentPeriod === 0 ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-600 text-white font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    À jour ({formatMonthName(currentPeriod, lang)})
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border border-amber-300 font-bold">
                    <Clock className="w-3.5 h-3.5" />
                    Reste {formatDZD(remainingCurrentPeriod, lang)} ({formatMonthName(currentPeriod, lang)})
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setSummary(null);
                    setPin('');
                  }}
                  title="Verrouiller"
                  className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-600 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Declare Payment CTA */}
            <button
              type="button"
              onClick={() => {
                const aptId = summary.apartment.id;
                onClose();
                onOpenDeclarePayment(aptId);
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              <CreditCard className="w-4 h-4" />
              <span>
                {lang === 'ar'
                  ? 'إرسال وصل دفع جديد (بريدي موب / CCP)'
                  : 'Déclarer un virement BaridiMob / CCP'}
              </span>
            </button>

            {/* Pending declarations */}
            {summary.pendingDeclarations.length > 0 && (
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-1.5">
                <div className="font-bold text-amber-800 dark:text-amber-300">
                  ⏳ {summary.pendingDeclarations.length} déclaration(s) en attente de validation du Président
                </div>
                {summary.pendingDeclarations.map((d) => (
                  <div key={d.id} className="flex justify-between text-[11px] text-amber-900 dark:text-amber-200">
                    <span>
                      {d.paymentMethod} · {d.specialCallTitle || formatMonthName(d.month, lang)}
                    </span>
                    <span className="font-mono font-bold">{formatDZD(d.amountDZD, lang)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Special Calls status */}
            {summary.specialCalls.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-bold text-slate-700 dark:text-slate-300">
                  {lang === 'ar' ? 'المشاريع الاستثنائية المصوت عليها' : 'Appels de fonds exceptionnels (Projets AG)'}
                </h4>
                {summary.specialCalls.map((sc) => {
                  const rem = Math.max(0, sc.amountPerApartmentDZD - sc.paidDZD);
                  return (
                    <div
                      key={sc.id}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2"
                    >
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">{sc.title}</div>
                        <div className="text-[11px] text-slate-500">
                          Quote-part : {formatDZD(sc.amountPerApartmentDZD, lang)} · Échéance {sc.dueDate}
                        </div>
                      </div>
                      <span
                        className={`font-mono font-bold px-2.5 py-1 rounded-lg ${
                          rem === 0
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        }`}
                      >
                        {rem === 0 ? 'Soldé' : `Reste ${formatDZD(rem, lang)}`}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Receipts list */}
            <div className="space-y-2">
              <h4 className="font-bold text-slate-700 dark:text-slate-300">
                {lang === 'ar'
                  ? `وصولات الدفع المسجلة (${summary.payments.length})`
                  : `Mes quittances officielles (${summary.payments.length})`}
              </h4>
              {summary.payments.length === 0 ? (
                <p className="text-slate-400 italic py-2">Aucune quittance enregistrée pour le moment.</p>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {summary.payments.map((p) => (
                    <div
                      key={p.id}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2"
                    >
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">
                          {formatMonthName(p.month, lang)} ·{' '}
                          <span className="font-mono text-emerald-600">{p.receiptNumber}</span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {formatDateFr(p.paymentDate.slice(0, 10), lang)} · {p.paymentMethod}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                          {formatDZD(p.amountDZD, lang)}
                        </span>
                        {onViewReceipt && (
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onViewReceipt(p);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer"
                          >
                            <FileCheck className="w-3.5 h-3.5" />
                            <span>Quittance</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
