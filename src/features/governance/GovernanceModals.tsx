import React, { useState } from 'react';
import { X, Megaphone, Vote, FileText } from 'lucide-react';
import { Apartment, AssemblyMinutes, AssemblyVote, Notice } from '../../types';
import { useI18n } from '../../i18n';

interface NewNoticeModalProps {
  initialNotice?: Notice | null;
  onClose: () => void;
  onSubmit: (notice: Notice) => Promise<void> | void;
}

export const NewNoticeModal: React.FC<NewNoticeModalProps> = ({ initialNotice, onClose, onSubmit }) => {
  const { lang, t } = useI18n();
  const [form, setForm] = useState<{
    title: string;
    type: Notice['type'];
    message: string;
    targetAudience: string;
    isPinned: boolean;
  }>({
    title: initialNotice?.title || '',
    type: initialNotice?.type || 'info',
    message: initialNotice?.message || '',
    targetAudience:
      initialNotice?.targetAudience || (lang === 'ar' ? 'جميع السكان' : 'Tous les résidents'),
    isPinned: initialNotice ? initialNotice.isPinned : true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.message.trim()) return;
    await onSubmit({
      id: initialNotice?.id || `not-${Date.now()}`,
      title: form.title.trim(),
      type: form.type,
      date: initialNotice?.date || new Date().toISOString().slice(0, 10),
      author: initialNotice?.author || (lang === 'ar' ? 'مكتب نقابة الملاك' : 'Le Bureau du Syndic'),
      message: form.message.trim(),
      isPinned: form.isPinned,
      targetAudience: form.targetAudience.trim(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 no-print">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-emerald-600" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {initialNotice
                ? lang === 'ar'
                  ? 'تعديل الإعلان'
                  : "Modifier l'avis"
                : t('newNoticeBtn')}
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
              {lang === 'ar' ? 'عنوان الإعلان' : "Titre de l'avis"}
            </label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                {lang === 'ar' ? 'نوع الإعلان' : 'Catégorie'}
              </label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as Notice['type'] })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value="info">{lang === 'ar' ? 'معلومات عامة' : 'Information'}</option>
                <option value="urgent">{lang === 'ar' ? 'عاجل' : 'Urgent'}</option>
                <option value="coupure_eau">{lang === 'ar' ? 'انقطاع المياه' : "Coupure d'eau"}</option>
                <option value="assemblee">{lang === 'ar' ? 'استدعاء جمعية عامة' : 'Assemblée Générale'}</option>
                <option value="travaux">{lang === 'ar' ? 'أشغال وصيانة' : 'Travaux'}</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                {lang === 'ar' ? 'الفئة المعنية' : 'Destinataires'}
              </label>
              <input
                type="text"
                value={form.targetAudience}
                onChange={(e) => setForm({ ...form, targetAudience: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
              {lang === 'ar' ? 'نص الإعلان' : 'Message officiel'}
            </label>
            <textarea
              rows={4}
              required
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={form.isPinned}
              onChange={(e) => setForm({ ...form, isPinned: e.target.checked })}
              className="rounded border-slate-300 text-emerald-600"
            />
            <span>{lang === 'ar' ? 'تثبيت الإعلان في أعلى الصفحة' : 'Épingler en tête de tableau'}</span>
          </label>

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

interface NewVoteModalProps {
  eligibleCount: number;
  initialVote?: AssemblyVote | null;
  onClose: () => void;
  onSubmit: (vote: AssemblyVote) => Promise<void> | void;
}

export const NewVoteModal: React.FC<NewVoteModalProps> = ({
  eligibleCount,
  initialVote,
  onClose,
  onSubmit,
}) => {
  const { lang, t } = useI18n();
  const [form, setForm] = useState({
    title: initialVote?.title || '',
    description: initialVote?.description || '',
    endDate:
      initialVote?.endDate || new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    opt1:
      initialVote?.options[0]?.label ||
      (lang === 'ar' ? 'موافق' : 'Pour (Favorable au projet)'),
    opt2:
      initialVote?.options[1]?.label || (lang === 'ar' ? 'معارض' : 'Contre (Défavorable)'),
    opt3:
      initialVote?.options[2]?.label ||
      (lang === 'ar' ? 'ممتنع عن التصويت' : 'Abstention / Besoin de précisions'),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    await onSubmit({
      id: initialVote?.id || `vote-${Date.now()}`,
      title: form.title.trim(),
      description: form.description.trim(),
      dateCreated: initialVote?.dateCreated || new Date().toISOString().slice(0, 10),
      endDate: form.endDate,
      status: initialVote?.status || 'active',
      options: [
        {
          id: initialVote?.options[0]?.id || 'opt-1',
          label: form.opt1.trim() || 'Pour',
          votes: initialVote?.options[0]?.votes ?? 0,
        },
        {
          id: initialVote?.options[1]?.id || 'opt-2',
          label: form.opt2.trim() || 'Contre',
          votes: initialVote?.options[1]?.votes ?? 0,
        },
        {
          id: initialVote?.options[2]?.id || 'opt-3',
          label: form.opt3.trim() || 'Abstention',
          votes: initialVote?.options[2]?.votes ?? 0,
        },
      ],
      totalEligibleApartments: initialVote?.totalEligibleApartments || eligibleCount,
      votedApartments: initialVote?.votedApartments || [],
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 no-print">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Vote className="w-5 h-5 text-emerald-600" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {initialVote
                ? lang === 'ar'
                  ? 'تعديل التصويت'
                  : 'Modifier la consultation'
                : t('newVoteBtn')}
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
              {lang === 'ar' ? 'موضوع التصويت' : 'Question soumise au vote'}
            </label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
              {lang === 'ar' ? 'تفاصيل المقترح والتكلفة' : 'Contexte & budget estimé'}
            </label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
              {lang === 'ar' ? 'تاريخ إغلاق التصويت' : 'Date de clôture'}
            </label>
            <input
              type="date"
              required
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-1 gap-2">
            <input
              type="text"
              value={form.opt1}
              onChange={(e) => setForm({ ...form, opt1: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
            <input
              type="text"
              value={form.opt2}
              onChange={(e) => setForm({ ...form, opt2: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
            <input
              type="text"
              value={form.opt3}
              onChange={(e) => setForm({ ...form, opt3: e.target.value })}
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

interface NewMinutesModalProps {
  buildingNumber: string;
  apartments: Apartment[];
  defaultPresident: string;
  defaultSecretary: string;
  initialMinutes?: AssemblyMinutes | null;
  onClose: () => void;
  onSubmit: (minutes: AssemblyMinutes) => Promise<void> | void;
}

export const NewMinutesModal: React.FC<NewMinutesModalProps> = ({
  buildingNumber,
  apartments,
  defaultPresident,
  defaultSecretary,
  initialMinutes,
  onClose,
  onSubmit,
}) => {
  const { lang, t } = useI18n();
  const [form, setForm] = useState({
    title:
      initialMinutes?.title ||
      (lang === 'ar' ? 'الجمعية العامة العادية' : 'Assemblée Générale Ordinaire'),
    type: (initialMinutes?.type || 'ordinaire') as 'ordinaire' | 'extraordinaire',
    date: initialMinutes?.date || new Date().toISOString().slice(0, 10),
    time: initialMinutes?.time || '18:30',
    location:
      initialMinutes?.location ||
      (lang === 'ar' ? `بهو ${buildingNumber}` : `Hall d'entrée du ${buildingNumber}`),
    agendaText: initialMinutes
      ? initialMinutes.agenda.join('\n')
      : lang === 'ar'
      ? 'الحصيلة المالية السنوية\nالتصويت على الميزانية واشتراكات الملاك\nالنقاط التقنية (المصاعد، خزان المياه، النظافة)'
      : 'Bilan financier annuel\nVote du budget prévisionnel et cotisations\nPoints techniques (ascenseurs, surpresseur, propreté)',
    decisionsText: initialMinutes
      ? initialMinutes.decisions.join('\n')
      : lang === 'ar'
      ? 'المصادقة على الحصيلة المالية بأغلبية الحضور.'
      : 'Validation du bilan financier à la majorité des présents.',
    presentApartmentIds:
      initialMinutes?.presentApartmentIds ||
      apartments
        .filter((a) => a.occupancy !== 'vacant')
        .slice(0, 15)
        .map((a) => a.id),
    presidentName: initialMinutes?.presidentName || defaultPresident,
    secretaryName: initialMinutes?.secretaryName || defaultSecretary,
    notes: initialMinutes?.notes || '',
  });

  const togglePresent = (aptId: string) => {
    setForm((prev) => ({
      ...prev,
      presentApartmentIds: prev.presentApartmentIds.includes(aptId)
        ? prev.presentApartmentIds.filter((id) => id !== aptId)
        : [...prev.presentApartmentIds, aptId],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    await onSubmit({
      id: initialMinutes?.id || `pv-${Date.now()}`,
      title: form.title.trim(),
      type: form.type,
      date: form.date,
      time: form.time,
      location: form.location.trim(),
      agenda: form.agendaText.split('\n').map((s) => s.trim()).filter(Boolean),
      decisions: form.decisionsText.split('\n').map((s) => s.trim()).filter(Boolean),
      presentApartmentIds: form.presentApartmentIds,
      presidentName: form.presidentName.trim(),
      secretaryName: form.secretaryName.trim(),
      notes: form.notes.trim() || undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 no-print">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-600" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {initialMinutes
                ? lang === 'ar'
                  ? 'تعديل محضر الجمعية العامة'
                  : 'Modifier le Procès-Verbal AG'
                : lang === 'ar'
                ? 'محضر جمعية عامة جديد'
                : 'Nouveau Procès-Verbal AG'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                {lang === 'ar' ? 'عنوان المحضر' : 'Intitulé du Procès-Verbal'}
              </label>
              <input
                type="text"
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                {lang === 'ar' ? 'النوع' : 'Type'}
              </label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as 'ordinaire' | 'extraordinaire' })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value="ordinaire">{lang === 'ar' ? 'عادية' : 'Ordinaire'}</option>
                <option value="extraordinaire">{lang === 'ar' ? 'استثنائية' : 'Extraordinaire'}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                {lang === 'ar' ? 'التاريخ' : 'Date'}
              </label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                {lang === 'ar' ? 'الساعة' : 'Heure'}
              </label>
              <input
                type="text"
                value={form.time}
                onChange={(e) => setForm({ ...form, time: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                {lang === 'ar' ? 'المكان' : 'Lieu'}
              </label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                {lang === 'ar' ? 'جدول الأعمال (سطر لكل نقطة)' : 'Ordre du jour (1 ligne / point)'}
              </label>
              <textarea
                rows={4}
                value={form.agendaText}
                onChange={(e) => setForm({ ...form, agendaText: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                {lang === 'ar' ? 'القرارات المتخذة (سطر لكل قرار)' : 'Décisions adoptées (1 ligne / décision)'}
              </label>
              <textarea
                rows={4}
                value={form.decisionsText}
                onChange={(e) => setForm({ ...form, decisionsText: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                {lang === 'ar' ? 'رئيس الجلسة' : 'Président de séance'}
              </label>
              <input
                type="text"
                value={form.presidentName}
                onChange={(e) => setForm({ ...form, presidentName: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                {lang === 'ar' ? 'مقرر / أمين الجلسة' : 'Secrétaire de séance'}
              </label>
              <input
                type="text"
                value={form.secretaryName}
                onChange={(e) => setForm({ ...form, secretaryName: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
              {lang === 'ar'
                ? `قائمة الشقق الحاضرة (${form.presentApartmentIds.length}/${apartments.length})`
                : `Logements présents (${form.presentApartmentIds.length}/${apartments.length})`}
            </label>
            <div className="max-h-36 overflow-y-auto grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
              {apartments.map((apt) => (
                <label
                  key={apt.id}
                  className="flex items-center gap-1.5 px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 cursor-pointer text-[11px]"
                >
                  <input
                    type="checkbox"
                    checked={form.presentApartmentIds.includes(apt.id)}
                    onChange={() => togglePresent(apt.id)}
                    className="rounded border-slate-300 text-emerald-600"
                  />
                  <span className="font-bold">{apt.number}</span>
                </label>
              ))}
            </div>
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
