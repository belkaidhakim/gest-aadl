import React, { useEffect, useState } from 'react';
import {
  X,
  AlertTriangle,
  Layers,
  Droplet,
  Zap,
  ShieldCheck,
  Wrench,
  DoorClosed,
  Phone,
  Send,
  MessageSquare,
} from 'lucide-react';
import { Apartment, Incident, IncidentCategory, IncidentPriority } from '../../types';
import { ResidentIncidentReportPayload } from '../../services/api';
import { useI18n } from '../../i18n';
import {
  loadSavedResidentIdentity,
  saveResidentIdentity,
} from '../../components/IncidentChatDrawer';

interface ReportIncidentModalProps {
  apartments: Apartment[];
  totalFloors: number;
  syndicPhone: string;
  onClose: () => void;
  onSubmit: (payload: ResidentIncidentReportPayload) => Promise<Incident | null>;
  onIncidentCreated?: (incident: Incident) => void;
}

export const ReportIncidentModal: React.FC<ReportIncidentModalProps> = ({
  apartments,
  totalFloors,
  syndicPhone,
  onClose,
  onSubmit,
  onIncidentCreated,
}) => {
  const { lang, t } = useI18n();
  const savedIdentity = loadSavedResidentIdentity(apartments[0]?.number || '');

  const [category, setCategory] = useState<IncidentCategory>('ascenseur');
  const [priority, setPriority] = useState<IncidentPriority>('normale');
  const [floor, setFloor] = useState<number>(0);
  const [location, setLocation] = useState<string>(
    lang === 'ar' ? 'المصعد الأيسر (رقم 1)' : 'Ascenseur N°1 (Gauche)'
  );
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [apartmentNumber, setApartmentNumber] = useState<string>(savedIdentity.apartmentNumber);
  const [reporterName, setReporterName] = useState<string>(savedIdentity.name);
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const categories: Array<{
    id: IncidentCategory;
    label: string;
    defaultLocation: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 'ascenseur',
      label: lang === 'ar' ? 'المصاعد' : 'Ascenseur',
      defaultLocation: lang === 'ar' ? 'المصعد الأيسر (رقم 1)' : 'Ascenseur N°1 (Gauche)',
      icon: <Layers className="w-4 h-4 text-amber-500" />,
    },
    {
      id: 'surpresseur_eau',
      label: lang === 'ar' ? 'المياه والضغط' : 'Eau & Surpresseur',
      defaultLocation: lang === 'ar' ? 'الطابق السفلي — خزان المياه' : 'Sous-sol — Bâche à eau / Surpresseur',
      icon: <Droplet className="w-4 h-4 text-sky-500" />,
    },
    {
      id: 'electricite_eclairage',
      label: lang === 'ar' ? 'الكهرباء والإنارة' : 'Électricité & Éclairage',
      defaultLocation: lang === 'ar' ? 'إنارة الدرج / الطابق' : 'Éclairage palier / cage escalier',
      icon: <Zap className="w-4 h-4 text-yellow-500" />,
    },
    {
      id: 'porte_interphone',
      label: lang === 'ar' ? 'باب المدخل والإنترفون' : 'Porte & Interphone',
      defaultLocation: lang === 'ar' ? 'بهو المدخل الرئيسي' : "Hall d'entrée principal",
      icon: <DoorClosed className="w-4 h-4 text-emerald-600" />,
    },
    {
      id: 'plomberie_evacuation',
      label: lang === 'ar' ? 'السباكة والسطح' : 'Plomberie / Fuite',
      defaultLocation: lang === 'ar' ? 'العمود المشترك / السطح' : 'Colonne montante / Terrasse',
      icon: <Wrench className="w-4 h-4 text-cyan-600" />,
    },
    {
      id: 'securite_gardiennage',
      label: lang === 'ar' ? 'الأمن والنظافة' : 'Sécurité / Autre',
      defaultLocation: lang === 'ar' ? 'الأجزاء المشتركة' : 'Parties communes',
      icon: <ShieldCheck className="w-4 h-4 text-slate-500" />,
    },
  ];

  const handleSelectCategory = (catId: IncidentCategory, suggestedLoc: string) => {
    setCategory(catId);
    setLocation(suggestedLoc);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 3 || location.trim().length < 2 || submitting) return;

    const cleanName = reporterName.trim();
    const reportedBy = cleanName
      ? `${cleanName}${apartmentNumber ? ` (${apartmentNumber})` : ''}`
      : apartmentNumber
      ? `${lang === 'ar' ? 'ساكن' : 'Résident'} (${apartmentNumber})`
      : lang === 'ar'
      ? 'ساكن بالعمارة'
      : 'Résident du bâtiment';

    setSubmitting(true);
    try {
      saveResidentIdentity(apartmentNumber, cleanName);
      const created = await onSubmit({
        title: title.trim(),
        category,
        location: location.trim(),
        floor,
        priority,
        description: description.trim(),
        reportedBy,
        apartmentNumber: apartmentNumber || undefined,
      });
      if (created) {
        onClose();
        onIncidentCreated?.(created);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4 no-print">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                {lang === 'ar' ? 'الإبلاغ عن عطل في العمارة' : 'Signaler une panne au Syndic'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {lang === 'ar'
                  ? 'سيصل البلاغ مباشرة إلى مكتب السانديك والمسؤول التقني.'
                  : 'Transmis immédiatement au Bureau Syndic et à la cellule technique.'}
              </p>
            </div>
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
          {/* Category 6-tile Picker */}
          <div className="space-y-1.5">
            <label className="block font-bold text-slate-700 dark:text-slate-300">
              {lang === 'ar' ? 'التجهيز أو المجال المعني' : 'Équipement concerné'}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {categories.map((cat) => {
                const selected = category === cat.id;
                return (
                  <button
                    type="button"
                    key={cat.id}
                    onClick={() => handleSelectCategory(cat.id, cat.defaultLocation)}
                    className={`p-2.5 rounded-xl border text-start flex items-center gap-2 transition-all cursor-pointer ${
                      selected
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-900 dark:text-emerald-200 font-bold ring-1 ring-emerald-500/40'
                        : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                    }`}
                  >
                    {cat.icon}
                    <span className="truncate">{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Urgency Pills */}
          <div className="space-y-1.5">
            <label className="block font-bold text-slate-700 dark:text-slate-300">
              {lang === 'ar' ? 'درجة الاستعجال' : "Niveau d'urgence"}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                {
                  id: 'normale' as const,
                  label: lang === 'ar' ? 'عادية' : 'Normale',
                  activeCls: 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border-slate-900',
                },
                {
                  id: 'elevee' as const,
                  label: lang === 'ar' ? 'مرتفعة' : 'Élevée',
                  activeCls: 'bg-amber-500 text-white border-amber-500',
                },
                {
                  id: 'urgente' as const,
                  label: lang === 'ar' ? 'عاجلة جداً' : 'Urgente',
                  activeCls: 'bg-rose-600 text-white border-rose-600',
                },
              ].map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => setPriority(p.id)}
                  className={`py-2 px-3 rounded-xl border font-bold text-center transition-all cursor-pointer ${
                    priority === p.id
                      ? p.activeCls
                      : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {priority === 'urgente' && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px]">
              <span>
                {lang === 'ar'
                  ? 'في حالة خطر فوري (شخص عالق بالمصعد أو تسرب غاز)، اتصل فوراً بالحماية المدنية (14) أو سونلغاز (3303).'
                  : 'Danger immédiat (personne bloquée, fuite de gaz) : appelez aussi le 14, Sonelgaz 3303 ou le Syndic.'}
              </span>
              <a
                href={`tel:${syndicPhone}`}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600 text-white font-bold shrink-0 self-start sm:self-center"
              >
                <Phone className="w-3 h-3" />
                <span dir="ltr">{syndicPhone}</span>
              </a>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              {lang === 'ar' ? 'عنوان العطل *' : 'Intitulé du problème *'}
            </label>
            <input
              type="text"
              required
              minLength={3}
              maxLength={140}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                lang === 'ar'
                  ? 'مثال: المصعد رقم 1 متوقف في الطابق الخامس'
                  : 'Ex : Ascenseur N°1 bloqué au 5ème étage / Fuite palier'
              }
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          {/* Location + Floor */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                {lang === 'ar' ? 'الموقع الدقيق *' : 'Lieu exact *'}
              </label>
              <input
                type="text"
                required
                minLength={2}
                maxLength={120}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                {lang === 'ar' ? 'الطابق' : 'Étage'}
              </label>
              <select
                value={floor}
                onChange={(e) => setFloor(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value={0}>{lang === 'ar' ? 'الطابق الأرضي / السفلي' : 'RDC / Sous-sol'}</option>
                {Array.from({ length: Math.max(9, totalFloors) }, (_, i) => i + 1).map((f) => (
                  <option key={f} value={f}>
                    {lang === 'ar' ? `الطابق ${f}` : `Étage ${f}`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Apartment Number (ONLY apt.number — zero PII) + Optional Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                {lang === 'ar' ? 'رقم الشقة' : "Votre N° d'appartement"}
              </label>
              <select
                value={apartmentNumber}
                onChange={(e) => setApartmentNumber(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold"
              >
                <option value="">{lang === 'ar' ? '-- غير محدد --' : '-- Non précisé --'}</option>
                {apartments.map((apt) => (
                  <option key={apt.id} value={apt.number}>
                    {apt.number}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                {lang === 'ar' ? 'الاسم (اختياري)' : 'Votre nom (optionnel)'}
              </label>
              <input
                type="text"
                maxLength={60}
                value={reporterName}
                onChange={(e) => setReporterName(e.target.value)}
                placeholder={lang === 'ar' ? 'مثال: السيد كريم' : 'Ex : M. Karim'}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Description / First Chat Message */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              {lang === 'ar'
                ? 'تفاصيل العطل / رسالتك الأولى للرئيس'
                : 'Détails & premier message au Président'}
            </label>
            <textarea
              rows={3}
              maxLength={1000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                lang === 'ar'
                  ? 'اشرح ما لاحظته (الوقت، الصوت، التسرب، حالة المصعد...)'
                  : 'Décrivez brièvement ce que vous avez constaté (heure, symptômes, accès...)'
              }
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          {/* Direct Chat Callout */}
          <div className="p-3 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/35 border border-emerald-200 dark:border-emerald-800/70 flex items-start gap-2.5 text-[11px] text-emerald-900 dark:text-emerald-200">
            <MessageSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <span>
              {lang === 'ar'
                ? 'بمجرد إرسال البلاغ، ستُفتح تلقائياً نافذة محادثة مباشرة (Chat) مع رئيس مكتب السانديك لمتابعة الإصلاح لحظة بلحظة.'
                : 'Dès validation, un canal de discussion direct (Chat) avec le Président du Syndic s’ouvrira automatiquement pour suivre l’intervention.'}
            </span>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-500 cursor-pointer">
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting || title.trim().length < 3 || location.trim().length < 2}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold cursor-pointer shadow-xs"
            >
              <Send className="w-3.5 h-3.5" />
              <span>
                {submitting
                  ? lang === 'ar'
                    ? 'جاري الإرسال...'
                    : 'Envoi en cours...'
                  : lang === 'ar'
                  ? 'إرسال وفتح المحادثة'
                  : 'Signaler & Ouvrir le Chat'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
