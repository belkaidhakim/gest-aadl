import React, { useState } from 'react';
import { CalendarClock, CheckCircle2, X } from 'lucide-react';
import {
  IncidentCategory,
  PreventiveFrequency,
  PreventiveTask,
  Vendor,
} from '../../types';
import { computeNextDueDate } from '../../utils/helpers';
import { useI18n } from '../../i18n';

interface NewPreventiveModalProps {
  vendors: Vendor[];
  onClose: () => void;
  onSubmit: (task: PreventiveTask) => Promise<void> | void;
}

export const NewPreventiveModal: React.FC<NewPreventiveModalProps> = ({
  vendors,
  onClose,
  onSubmit,
}) => {
  const { lang, t } = useI18n();
  const [form, setForm] = useState({
    title: '',
    equipment: 'ascenseur' as IncidentCategory,
    frequency: 'mensuel' as PreventiveFrequency,
    lastDoneDate: new Date().toISOString().slice(0, 10),
    assignedVendor: vendors[0]?.name || '',
    estimatedCostDZD: 5000,
    notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    await onSubmit({
      id: `prev-${Date.now()}`,
      title: form.title.trim(),
      equipment: form.equipment,
      frequency: form.frequency,
      lastDoneDate: form.lastDoneDate,
      nextDueDate: computeNextDueDate(form.lastDoneDate, form.frequency),
      assignedVendor: form.assignedVendor.trim() || undefined,
      estimatedCostDZD: Number(form.estimatedCostDZD) || 0,
      notes: form.notes.trim() || undefined,
      history: [],
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 no-print">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-emerald-600" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {lang === 'ar' ? 'برمجة صيانة دورية' : 'Planifier une maintenance préventive'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
              {lang === 'ar' ? 'عنوان المهمة الدورية' : 'Intitulé de la maintenance'}
            </label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder={lang === 'ar' ? 'مثال: تنظيف وتطهير خزان المياه' : 'Ex : Nettoyage & désinfection bâche à eau'}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                {lang === 'ar' ? 'التجهيز المعني' : 'Équipement'}
              </label>
              <select
                value={form.equipment}
                onChange={(e) => setForm({ ...form, equipment: e.target.value as IncidentCategory })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value="ascenseur">{lang === 'ar' ? 'المصاعد' : 'Ascenseurs'}</option>
                <option value="surpresseur_eau">{lang === 'ar' ? 'خزان المياه ومجموعة الضغط' : 'Bâche à eau & Surpresseur'}</option>
                <option value="electricite_eclairage">{lang === 'ar' ? 'الكهرباء والإنارة' : 'Électricité & Éclairage'}</option>
                <option value="securite_gardiennage">{lang === 'ar' ? 'الأمن ومطفآت الحريق' : 'Sécurité & Extincteurs'}</option>
                <option value="plomberie_evacuation">{lang === 'ar' ? 'السطح ومجاري الصرف' : 'Toiture & Évacuation'}</option>
                <option value="nettoyage_ordures">{lang === 'ar' ? 'التنظيف والتعقيم' : 'Nettoyage & Dératisation'}</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                {lang === 'ar' ? 'الدورية / التكرار' : 'Fréquence'}
              </label>
              <select
                value={form.frequency}
                onChange={(e) => setForm({ ...form, frequency: e.target.value as PreventiveFrequency })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value="hebdomadaire">{lang === 'ar' ? 'أسبوعية' : 'Hebdomadaire'}</option>
                <option value="mensuel">{lang === 'ar' ? 'شهرية' : 'Mensuelle'}</option>
                <option value="trimestriel">{lang === 'ar' ? 'فصلية (3 أشهر)' : 'Trimestrielle (3 mois)'}</option>
                <option value="semestriel">{lang === 'ar' ? 'نصف سنوية (6 أشهر)' : 'Semestrielle (6 mois)'}</option>
                <option value="annuel">{lang === 'ar' ? 'سنوية' : 'Annuelle'}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                {lang === 'ar' ? 'تاريخ آخر فحص' : 'Dernière exécution'}
              </label>
              <input
                type="date"
                required
                value={form.lastDoneDate}
                onChange={(e) => setForm({ ...form, lastDoneDate: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                {lang === 'ar' ? 'المقاول المكلف' : 'Prestataire'}
              </label>
              <input
                type="text"
                list="vendors-prev-datalist"
                value={form.assignedVendor}
                onChange={(e) => setForm({ ...form, assignedVendor: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
              <datalist id="vendors-prev-datalist">
                {vendors.map((v) => (
                  <option key={v.id} value={v.name} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                {lang === 'ar' ? 'التكلفة التقديرية (دج)' : 'Coût estimé (DZD)'}
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
              {lang === 'ar' ? 'تعليمات وملاحظات' : 'Consignes & observations'}
            </label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
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
              {t('save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface CompletePreventiveModalProps {
  task: PreventiveTask;
  defaultPerformer: string;
  onClose: () => void;
  onSubmit: (performedDate: string, performedBy: string, costDZD: number, notes: string) => Promise<void> | void;
}

export const CompletePreventiveModal: React.FC<CompletePreventiveModalProps> = ({
  task,
  defaultPerformer,
  onClose,
  onSubmit,
}) => {
  const { lang, t } = useI18n();
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    performedBy: task.assignedVendor || defaultPerformer,
    costDZD: task.estimatedCostDZD || 0,
    notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(
      form.date,
      form.performedBy.trim() || defaultPerformer,
      Number(form.costDZD) || 0,
      form.notes.trim()
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 no-print">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {lang === 'ar' ? 'تسجيل تنفيذ الصيانة' : 'Marquer effectuée'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{task.title}</p>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                {lang === 'ar' ? 'تاريخ التنفيذ' : "Date d'exécution"}
              </label>
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                {lang === 'ar' ? 'التكلفة المدفوعة (دج)' : 'Coût payé (DZD)'}
              </label>
              <input
                type="number"
                min="0"
                step="100"
                value={form.costDZD}
                onChange={(e) => setForm({ ...form, costDZD: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
              {lang === 'ar' ? 'المنفذ / المقاول' : 'Exécuté par (Prestataire / Syndic)'}
            </label>
            <input
              type="text"
              required
              value={form.performedBy}
              onChange={(e) => setForm({ ...form, performedBy: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
              {lang === 'ar' ? 'تقرير وتفاصيل المراقبة' : 'Compte-rendu'}
            </label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
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
              {t('save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
