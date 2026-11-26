import React, { useState } from 'react';
import {
  X,
  Paperclip,
  Wallet,
  ArrowDownRight,
  ArrowUpRight,
  Shield,
  PiggyBank,
  AlertTriangle,
  Trash2,
} from 'lucide-react';
import {
  PaymentMethod,
  Transaction,
  TransactionCategory,
  TransactionFund,
  TransactionType,
} from '../../types';
import { formatDZD } from '../../utils/helpers';
import { useI18n } from '../../i18n';
import { useAppStore } from '../../stores/AppStore';
import { useToast } from '../../components/ui/ToastProvider';
import {
  ALL_PAYMENT_METHODS,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  getCategoryLabel,
  getPaymentMethodLabel,
} from './treasuryHelpers';

interface TransactionModalProps {
  courantBalance: number;
  reserveBalance: number;
  defaultType?: TransactionType;
  initialTransaction?: Transaction | null;
  initialPreset?: Partial<Transaction> | null;
  onClose: () => void;
  onSubmit: (tx: Transaction) => Promise<void> | void;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  courantBalance,
  reserveBalance,
  defaultType = 'depense',
  initialTransaction = null,
  initialPreset = null,
  onClose,
  onSubmit,
}) => {
  const { lang, t } = useI18n();
  const { uploadAttachment } = useAppStore();
  const toast = useToast();
  const isEditing = Boolean(initialTransaction);

  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<{
    type: TransactionType;
    fund: TransactionFund;
    category: TransactionCategory;
    amountDZD: number;
    description: string;
    referenceDoc: string;
    paymentMethod: PaymentMethod;
    date: string;
    attachmentName?: string;
    attachmentDataUrl?: string;
  }>(() => {
    if (initialTransaction) {
      return {
        type: initialTransaction.type,
        fund: initialTransaction.fund || 'courant',
        category: initialTransaction.category,
        amountDZD: initialTransaction.amountDZD,
        description: initialTransaction.description,
        referenceDoc: initialTransaction.referenceDoc || '',
        paymentMethod: initialTransaction.paymentMethod,
        date: (initialTransaction.date || new Date().toISOString()).slice(0, 10),
        attachmentName: initialTransaction.attachmentName,
        attachmentDataUrl: initialTransaction.attachmentDataUrl,
      };
    }
    if (initialPreset) {
      const pType = initialPreset.type || defaultType;
      return {
        type: pType,
        fund: initialPreset.fund || 'courant',
        category:
          initialPreset.category ||
          (pType === 'recette' ? 'Cotisations Copropriétaires' : 'Facture Électricité Sonelgaz'),
        amountDZD: initialPreset.amountDZD || 10000,
        description: initialPreset.description || '',
        referenceDoc: initialPreset.referenceDoc || '',
        paymentMethod: initialPreset.paymentMethod || 'Espèces',
        date: (initialPreset.date || new Date().toISOString()).slice(0, 10),
      };
    }
    return {
      type: defaultType,
      fund: 'courant',
      category: defaultType === 'recette' ? 'Cotisations Copropriétaires' : 'Facture Électricité Sonelgaz',
      amountDZD: 10000,
      description: '',
      referenceDoc: '',
      paymentMethod: 'Espèces',
      date: new Date().toISOString().slice(0, 10),
    };
  });

  const baseFundBalance = form.fund === 'reserve' ? reserveBalance : courantBalance;
  const selectedFundBalance =
    initialTransaction && (initialTransaction.fund || 'courant') === form.fund
      ? baseFundBalance +
        (initialTransaction.type === 'depense' ? initialTransaction.amountDZD : -initialTransaction.amountDZD)
      : baseFundBalance;
  const exceedsBalance = form.type === 'depense' && Number(form.amountDZD) > selectedFundBalance;

  const isImageUrl = (url?: string) =>
    Boolean(url && (url.startsWith('data:image/') || /\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(url)));

  const handleTypeChange = (type: TransactionType) => {
    setForm((prev) => ({
      ...prev,
      type,
      category:
        type === 'recette'
          ? prev.fund === 'reserve'
            ? 'Dotation Fonds de Réserve'
            : 'Cotisations Copropriétaires'
          : prev.fund === 'reserve'
          ? 'Gros Travaux & Équipements'
          : 'Facture Électricité Sonelgaz',
    }));
  };

  const handleFundChange = (fund: TransactionFund) => {
    setForm((prev) => ({
      ...prev,
      fund,
      category:
        fund === 'reserve'
          ? prev.type === 'recette'
            ? 'Dotation Fonds de Réserve'
            : 'Gros Travaux & Équipements'
          : prev.type === 'recette'
          ? 'Cotisations Copropriétaires'
          : prev.category,
    }));
  };

  const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1.5 * 1024 * 1024) {
      toast.error(
        lang === 'ar'
          ? 'حجم الملف المرفق يجب أن لا يتجاوز 1.5 ميغابايت.'
          : 'Le fichier justificatif ne doit pas dépasser 1,5 Mo.'
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result || '');
      setUploading(true);
      try {
        const uploaded = await uploadAttachment(file.name, dataUrl);
        setForm((prev) => ({
          ...prev,
          attachmentName: uploaded.name,
          attachmentDataUrl: uploaded.url,
        }));
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.description.trim() || form.amountDZD <= 0 || uploading || submitting) return;

    setSubmitting(true);
    try {
      await onSubmit({
        id: initialTransaction ? initialTransaction.id : `tx-${Date.now()}`,
        date: form.date,
        type: form.type,
        fund: form.fund,
        category: form.category,
        amountDZD: Number(form.amountDZD),
        description: form.description.trim(),
        referenceDoc: form.referenceDoc.trim() || undefined,
        paymentMethod: form.paymentMethod,
        attachmentName: form.attachmentName,
        attachmentDataUrl: form.attachmentDataUrl,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const baseCategories = form.type === 'depense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  const categoryOptions = baseCategories.includes(form.category)
    ? baseCategories
    : [form.category, ...baseCategories];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 no-print">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-emerald-600" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {isEditing
                ? lang === 'ar'
                  ? 'تعديل العملية المالية'
                  : 'Modifier l’opération de caisse'
                : lang === 'ar'
                ? 'تسجيل عملية مالية في الصندوق'
                : 'Nouvelle opération de caisse'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Type Switch */}
          <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => handleTypeChange('depense')}
              className={`py-2 px-3 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                form.type === 'depense'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              <ArrowDownRight className="w-4 h-4" />
              <span>{lang === 'ar' ? 'مصروف (خروج)' : 'Dépense (Sortie)'}</span>
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('recette')}
              className={`py-2 px-3 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                form.type === 'recette'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>{lang === 'ar' ? 'مدخول (دخول)' : 'Recette (Entrée)'}</span>
            </button>
          </div>

          {/* Fund Selector Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => handleFundChange('courant')}
              className={`text-start p-3 rounded-xl border transition-all cursor-pointer ${
                form.fund === 'courant'
                  ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-500 ring-1 ring-emerald-500/40'
                  : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 dark:text-slate-200 inline-flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-emerald-600" />
                  {t('currentFund')}
                </span>
              </div>
              <div className="font-mono font-extrabold text-sm text-slate-900 dark:text-white mt-1">
                {formatDZD(courantBalance, lang)}
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleFundChange('reserve')}
              className={`text-start p-3 rounded-xl border transition-all cursor-pointer ${
                form.fund === 'reserve'
                  ? 'bg-sky-50/70 dark:bg-sky-950/30 border-sky-500 ring-1 ring-sky-500/40'
                  : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 dark:text-slate-200 inline-flex items-center gap-1.5">
                  <PiggyBank className="w-3.5 h-3.5 text-sky-600" />
                  {t('reserveFund')}
                </span>
              </div>
              <div className="font-mono font-extrabold text-sm text-sky-700 dark:text-sky-300 mt-1">
                {formatDZD(reserveBalance, lang)}
              </div>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                {lang === 'ar' ? 'البند / الفئة' : 'Catégorie / Poste budgétaire'}
              </label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as TransactionCategory })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                {categoryOptions.map((cat) => (
                  <option key={cat} value={cat}>
                    {getCategoryLabel(cat, lang)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                {lang === 'ar' ? 'التاريخ' : 'Date'}
              </label>
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                {t('amountDzdLabel')}
              </label>
              <input
                type="number"
                min="1"
                step="50"
                required
                value={form.amountDZD}
                onChange={(e) => setForm({ ...form, amountDZD: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold text-sm"
              />
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                {t('paymentMethodLabel')}
              </label>
              <select
                value={form.paymentMethod}
                onChange={(e) => setForm({ ...form, paymentMethod: e.target.value as PaymentMethod })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                {ALL_PAYMENT_METHODS.map((pm) => (
                  <option key={pm} value={pm}>
                    {getPaymentMethodLabel(pm, lang)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {exceedsBalance && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                {lang === 'ar'
                  ? `تنبيه: المبلغ يتجاوز الرصيد المتاح في هذا الصندوق (${formatDZD(selectedFundBalance, lang)}).`
                  : `Attention : ce montant dépasse le solde disponible de cette enveloppe (${formatDZD(selectedFundBalance, lang)}).`}
              </span>
            </div>
          )}

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
              {lang === 'ar' ? 'الوصف والتفاصيل' : 'Libellé de l’opération'}
            </label>
            <input
              type="text"
              required
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder={
                lang === 'ar'
                  ? 'مثال: دفع فاتورة كهرباء الدرج - الثلاثي الثاني'
                  : 'Ex : Paiement facture Sonelgaz cage escalier T2'
              }
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                {lang === 'ar' ? 'رقم المرجع / الفاتورة' : 'Référence facture / Bon'}
              </label>
              <input
                type="text"
                value={form.referenceDoc}
                onChange={(e) => setForm({ ...form, referenceDoc: e.target.value })}
                placeholder="FAC-2026-041"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                {lang === 'ar' ? 'مستند إثبات (صورة أو PDF)' : 'Justificatif (Image / PDF, max 1,5 Mo)'}
              </label>
              {form.attachmentDataUrl ? (
                <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30">
                  <div className="flex items-center gap-2 min-w-0">
                    {isImageUrl(form.attachmentDataUrl) ? (
                      <img
                        src={form.attachmentDataUrl}
                        alt={form.attachmentName}
                        className="w-6 h-6 rounded object-cover shrink-0"
                      />
                    ) : (
                      <Paperclip className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    )}
                    <span className="truncate font-semibold text-emerald-800 dark:text-emerald-300">
                      {form.attachmentName}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        attachmentName: undefined,
                        attachmentDataUrl: undefined,
                      }))
                    }
                    className="text-slate-400 hover:text-rose-600 cursor-pointer shrink-0"
                    title={lang === 'ar' ? 'إزالة' : 'Retirer'}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:border-emerald-500 cursor-pointer truncate">
                  <Paperclip className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="truncate text-slate-600 dark:text-slate-300">
                    {uploading
                      ? lang === 'ar'
                        ? 'جاري الرفع...'
                        : 'Téléversement...'
                      : lang === 'ar'
                      ? 'إرفاق وصل أو فاتورة'
                      : 'Joindre facture / reçu'}
                  </span>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={handleAttachmentChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-500 cursor-pointer">
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={uploading || submitting}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold cursor-pointer shadow-xs"
            >
              {t('save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
