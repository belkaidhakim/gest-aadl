import React, { useState } from 'react';
import { X, Scale, CheckCircle2, AlertTriangle } from 'lucide-react';
import {
  Incident,
  IncidentCategory,
  IncidentPriority,
  Vendor,
  VendorQuote,
} from '../../types';
import { formatDZD } from '../../utils/helpers';
import { useI18n } from '../../i18n';

interface NewIncidentModalProps {
  defaultReporter: string;
  vendors: Vendor[];
  totalFloors: number;
  onClose: () => void;
  onSubmit: (incident: Incident) => Promise<void> | void;
}

export const NewIncidentModal: React.FC<NewIncidentModalProps> = ({
  defaultReporter,
  vendors,
  totalFloors,
  onClose,
  onSubmit,
}) => {
  const { lang, t } = useI18n();
  const [form, setForm] = useState({
    title: '',
    category: 'ascenseur' as IncidentCategory,
    location: lang === 'ar' ? 'المصعد الأيسر (رقم 1)' : 'Ascenseur Gauche (N°1)',
    floor: 0,
    priority: 'normale' as IncidentPriority,
    description: '',
    reportedBy: defaultReporter,
    assignedVendor: vendors[0]?.name || '',
    estimatedCostDZD: 5000,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    await onSubmit({
      id: `inc-${Date.now()}`,
      title: form.title.trim(),
      category: form.category,
      location: form.location.trim(),
      floor: Number(form.floor) || 0,
      priority: form.priority,
      status: 'signale',
      description: form.description.trim(),
      reportedBy: form.reportedBy.trim() || defaultReporter,
      reportedDate: new Date().toISOString(),
      assignedVendor: form.assignedVendor.trim() || undefined,
      estimatedCostDZD: Number(form.estimatedCostDZD) || 0,
      quotes: [],
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 no-print">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {lang === 'ar' ? 'الإبلاغ عن عطل أو تدخل تقني' : 'Signaler un incident technique'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
              {t('modalProblemTitleLabel')}
            </label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder={lang === 'ar' ? 'مثال: عطل في المصعد رقم 2 - الطابق 4' : 'Ex : Panne Ascenseur N°2 au 4ème étage'}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                {lang === 'ar' ? 'الفئة / التجهيز' : 'Catégorie / Équipement'}
              </label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as IncidentCategory })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value="ascenseur">{lang === 'ar' ? 'المصاعد' : 'Ascenseurs'}</option>
                <option value="surpresseur_eau">{lang === 'ar' ? 'خزان المياه ومجموعة الضغط' : 'Bâche à eau & Surpresseur'}</option>
                <option value="electricite_eclairage">{lang === 'ar' ? 'الكهرباء والإنارة' : 'Électricité & Éclairage'}</option>
                <option value="porte_interphone">{lang === 'ar' ? 'باب المدخل والإنترفون' : "Porte d'accès & Interphone"}</option>
                <option value="plomberie_evacuation">{lang === 'ar' ? 'السباكة والسطح' : 'Plomberie & Toiture'}</option>
                <option value="nettoyage_ordures">{lang === 'ar' ? 'النظافة والصحة' : 'Propreté & Hygiène'}</option>
                <option value="securite_gardiennage">{lang === 'ar' ? 'الأمن والحماية من الحرائق' : 'Sécurité & Incendie'}</option>
                <option value="autre">{lang === 'ar' ? 'عطل آخر' : 'Autre incident'}</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                {t('modalPriorityLabel')}
              </label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value as IncidentPriority })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value="normale">{lang === 'ar' ? 'عادية' : 'Normale'}</option>
                <option value="urgente">{lang === 'ar' ? 'عاجلة' : 'Urgente'}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                {t('modalLocationLabel')}
              </label>
              <input
                type="text"
                required
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                {lang === 'ar' ? 'الطابق' : 'Étage'}
              </label>
              <select
                value={form.floor}
                onChange={(e) => setForm({ ...form, floor: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value={0}>{lang === 'ar' ? 'الطابق الأرضي' : 'RDC'}</option>
                {Array.from({ length: Math.max(9, totalFloors) }, (_, i) => i + 1).map((f) => (
                  <option key={f} value={f}>
                    {lang === 'ar' ? `الطابق ${f}` : `Étage ${f}`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                {lang === 'ar' ? 'المقاول المعين' : 'Prestataire assigné'}
              </label>
              <select
                value={form.assignedVendor}
                onChange={(e) => setForm({ ...form, assignedVendor: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value="">{lang === 'ar' ? '-- غير معين --' : '-- Non assigné --'}</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.name}>
                    {v.name} ({v.specialty})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                {t('modalEstimatedCostLabel')}
              </label>
              <input
                type="number"
                min="0"
                step="500"
                value={form.estimatedCostDZD}
                onChange={(e) => setForm({ ...form, estimatedCostDZD: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
              {t('modalReportedByLabel')}
            </label>
            <input
              type="text"
              value={form.reportedBy}
              onChange={(e) => setForm({ ...form, reportedBy: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
              {lang === 'ar' ? 'الوصف والتفاصيل' : 'Description détaillée'}
            </label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder={lang === 'ar' ? 'تفاصيل العطل والملاحظات التقنية...' : "Précisions sur la panne, symptômes observés..."}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer shadow-xs"
            >
              {lang === 'ar' ? 'تسجيل العطل' : 'Signaler la panne'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface AddQuoteModalProps {
  incident: Incident;
  vendors: Vendor[];
  onClose: () => void;
  onSubmit: (quote: VendorQuote) => Promise<void> | void;
}

export const AddQuoteModal: React.FC<AddQuoteModalProps> = ({
  incident,
  vendors,
  onClose,
  onSubmit,
}) => {
  const { lang, t } = useI18n();
  const [vendorName, setVendorName] = useState(vendors[0]?.name || '');
  const [amountDZD, setAmountDZD] = useState<number>(incident.estimatedCostDZD || 15000);
  const [notes, setNotes] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorName.trim() || amountDZD <= 0) return;
    await onSubmit({
      id: `qt-${Date.now()}`,
      vendorName: vendorName.trim(),
      amountDZD: Number(amountDZD),
      date: new Date().toISOString().slice(0, 10),
      notes: notes.trim() || undefined,
      selected: false,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 no-print">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-sky-600" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {lang === 'ar' ? 'إضافة عرض سعر لمقاول' : 'Ajouter un Devis Prestataire'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400">
          <strong className="text-slate-800 dark:text-slate-200">{incident.title}</strong>
        </p>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
              {lang === 'ar' ? 'اسم المقاول أو الشركة' : 'Prestataire / Entreprise'}
            </label>
            <input
              type="text"
              list="vendors-datalist-quote"
              required
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
            <datalist id="vendors-datalist-quote">
              {vendors.map((v) => (
                <option key={v.id} value={v.name} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
              {lang === 'ar' ? 'مبلغ العرض (دج)' : 'Montant du devis (DZD)'}
            </label>
            <input
              type="number"
              min="1"
              step="500"
              required
              value={amountDZD}
              onChange={(e) => setAmountDZD(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold"
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
              {lang === 'ar' ? 'تفاصيل العرض والضمان' : 'Détails, pièces & garantie'}
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={lang === 'ar' ? 'مثال: يشمل قطع الغيار والضمان 6 أشهر' : 'Ex : Pièces incluses + garantie 6 mois'}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-500 cursor-pointer">
              {t('cancel')}
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-semibold cursor-pointer"
            >
              {t('save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface ResolveIncidentModalProps {
  incident: Incident;
  onClose: () => void;
  onSubmit: (actualCost: number, notes: string) => Promise<void> | void;
}

export const ResolveIncidentModal: React.FC<ResolveIncidentModalProps> = ({
  incident,
  onClose,
  onSubmit,
}) => {
  const { lang, t } = useI18n();
  const selectedQuote = incident.quotes?.find((q) => q.selected);
  const [actualCost, setActualCost] = useState<number>(
    selectedQuote?.amountDZD || incident.estimatedCostDZD || 0
  );
  const [notes, setNotes] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(Number(actualCost) || 0, notes.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 no-print">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {lang === 'ar' ? 'إغلاق وتسوية العطل' : "Clôturer l'incident"}
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 text-xs">
          <div className="font-bold text-slate-900 dark:text-white">{incident.title}</div>
          <div className="text-slate-500 mt-0.5">
            {incident.location} · {lang === 'ar' ? 'التقدير:' : 'Estimé :'}{' '}
            <span className="font-mono">{formatDZD(incident.estimatedCostDZD || 0, lang)}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
              {lang === 'ar' ? 'التكلفة الفعلية النهائية (دج)' : 'Coût final réel de réparation (DZD)'}
            </label>
            <input
              type="number"
              min="0"
              step="100"
              value={actualCost}
              onChange={(e) => setActualCost(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold"
            />
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1">
              {lang === 'ar'
                ? 'سيتم تسجيل المبلغ تلقائياً كمصروف في الخزينة إذا كان أكبر من 0 دج.'
                : 'Enregistré automatiquement en dépense caisse si > 0 DZD.'}
            </p>
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
              {lang === 'ar' ? 'تقرير الإصلاح والقطع المستبدلة' : "Notes d'intervention & pièces changées"}
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={lang === 'ar' ? 'تم الإصلاح وتجريب التجهيز بنجاح...' : 'Ex : Remplacement du relais effectué, essai concluant.'}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-500 cursor-pointer">
              {t('cancel')}
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer"
            >
              {lang === 'ar' ? 'تأكيد الحل والإغلاق' : 'Clôturer comme résolu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
