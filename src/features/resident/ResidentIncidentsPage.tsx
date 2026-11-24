import React, { useMemo, useState } from 'react';
import {
  Wrench,
  Layers,
  Droplet,
  Zap,
  ShieldCheck,
  Search,
  CalendarClock,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Phone,
  ChevronRight,
  Siren,
  Plus,
} from 'lucide-react';
import {
  Incident,
  IncidentCategory,
  PreventiveFrequency,
} from '../../types';
import { formatDZD, formatDateFr, formatShortDate, getDueStatus } from '../../utils/helpers';
import { useI18n } from '../../i18n';
import { useAppStore } from '../../stores/AppStore';
import { EmptyState } from '../../components/ui/EmptyState';
import { SlideOverDrawer } from '../../components/ui/SlideOverDrawer';
import { AppTab } from '../../app/useRoute';
import { ReportIncidentModal } from './ReportIncidentModal';

interface ResidentIncidentsPageProps {
  onNavigateTab: (tab: AppTab) => void;
}

export const ResidentIncidentsPage: React.FC<ResidentIncidentsPageProps> = ({ onNavigateTab }) => {
  const { lang, isRtl, t } = useI18n();
  const { data, reportResidentIncident } = useAppStore();

  const [subTab, setSubTab] = useState<'incidents' | 'preventive'>('incidents');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'resolu'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  const openIncidents = data.incidents.filter((i) => i.status !== 'resolu');
  const preventiveTasks = data.preventiveTasks || [];
  const okPrevCount = preventiveTasks.filter((task) => getDueStatus(task.nextDueDate) === 'ok').length;

  const healthTiles: Array<{
    key: string;
    match: IncidentCategory[];
    label: string;
    icon: React.ReactNode;
  }> = [
    {
      key: 'ascenseur',
      match: ['ascenseur'],
      label: lang === 'ar' ? 'المصاعد' : 'Ascenseurs',
      icon: <Layers className="w-4 h-4 text-amber-500" />,
    },
    {
      key: 'surpresseur_eau',
      match: ['surpresseur_eau', 'plomberie_evacuation'],
      label: lang === 'ar' ? 'المياه والضغط' : 'Eau & Surpresseur',
      icon: <Droplet className="w-4 h-4 text-sky-500" />,
    },
    {
      key: 'electricite_eclairage',
      match: ['electricite_eclairage'],
      label: lang === 'ar' ? 'الكهرباء والإنارة' : 'Électricité & Éclairage',
      icon: <Zap className="w-4 h-4 text-yellow-500" />,
    },
    {
      key: 'securite_gardiennage',
      match: ['securite_gardiennage', 'porte_interphone'],
      label: lang === 'ar' ? 'الأمن والمدخل' : 'Sécurité & Accès',
      icon: <ShieldCheck className="w-4 h-4 text-emerald-500" />,
    },
  ];

  const getCategoryIcon = (category: IncidentCategory) => {
    switch (category) {
      case 'ascenseur':
        return <Layers className="w-4 h-4 text-amber-500" />;
      case 'surpresseur_eau':
      case 'plomberie_evacuation':
        return <Droplet className="w-4 h-4 text-sky-500" />;
      case 'electricite_eclairage':
        return <Zap className="w-4 h-4 text-yellow-500" />;
      case 'securite_gardiennage':
        return <ShieldCheck className="w-4 h-4 text-emerald-500" />;
      default:
        return <Wrench className="w-4 h-4 text-slate-500" />;
    }
  };

  const getCategoryLabel = (category: IncidentCategory) => {
    if (lang === 'ar') {
      switch (category) {
        case 'ascenseur': return 'المصاعد';
        case 'surpresseur_eau': return 'خزان المياه ومجموعة الضغط';
        case 'electricite_eclairage': return 'الكهرباء والإنارة';
        case 'porte_interphone': return 'باب المدخل والإنترفون';
        case 'plomberie_evacuation': return 'السباكة والسطح';
        case 'nettoyage_ordures': return 'النظافة والصحة';
        case 'securite_gardiennage': return 'الأمن والحماية';
        default: return 'تدخل تقني';
      }
    }
    switch (category) {
      case 'ascenseur': return 'Ascenseurs';
      case 'surpresseur_eau': return 'Eau & Surpresseur';
      case 'electricite_eclairage': return 'Électricité & Éclairage';
      case 'porte_interphone': return 'Accès & Interphone';
      case 'plomberie_evacuation': return 'Plomberie & Toiture';
      case 'nettoyage_ordures': return 'Propreté & Hygiène';
      case 'securite_gardiennage': return 'Sécurité & Incendie';
      default: return 'Autre intervention';
    }
  };

  const getFrequencyLabel = (f: PreventiveFrequency) => {
    if (lang === 'ar') {
      switch (f) {
        case 'hebdomadaire': return 'أسبوعية';
        case 'mensuel': return 'شهرية';
        case 'trimestriel': return 'فصلية';
        case 'semestriel': return 'نصف سنوية';
        case 'annuel': return 'سنوية';
      }
    }
    switch (f) {
      case 'hebdomadaire': return 'Hebdomadaire';
      case 'mensuel': return 'Mensuelle';
      case 'trimestriel': return 'Trimestrielle';
      case 'semestriel': return 'Semestrielle';
      case 'annuel': return 'Annuelle';
    }
  };

  const filteredIncidents = useMemo(() => {
    return data.incidents
      .filter((inc) => {
        if (statusFilter === 'open' && inc.status === 'resolu') return false;
        if (statusFilter === 'resolu' && inc.status !== 'resolu') return false;
        if (categoryFilter !== 'all') {
          const tile = healthTiles.find((h) => h.key === categoryFilter);
          if (tile) {
            if (!tile.match.includes(inc.category)) return false;
          } else if (inc.category !== categoryFilter) {
            return false;
          }
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const text = `${inc.title} ${inc.location} ${inc.description} ${inc.assignedVendor || ''}`.toLowerCase();
          if (!text.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.reportedDate).getTime() - new Date(a.reportedDate).getTime());
  }, [data.incidents, statusFilter, categoryFilter, searchQuery]);

  const sortedPreventive = useMemo(() => {
    return [...preventiveTasks].sort(
      (a, b) => new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime()
    );
  }, [preventiveTasks]);

  return (
    <div className="space-y-6">
      {/* Header + Segmented View Switch */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Wrench className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <h1 className="text-lg font-extrabold text-slate-900 dark:text-white">
                {lang === 'ar' ? 'حالة التجهيزات، الأعطال والأشغال' : 'Suivi des Pannes & Travaux'}
              </h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {lang === 'ar'
                ? 'متابعة شفافة لحالة المصاعد، خزان المياه، الأشغال الجارية وجدول الصيانة الوقائية.'
                : 'Suivi en temps réel des pannes signalées, travaux en cours et entretiens préventifs de la cage.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
            <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-xs">
              <button
                onClick={() => setSubTab('incidents')}
                className={`px-3.5 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer ${
                  subTab === 'incidents'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'الأعطال والأشغال' : 'Pannes & Travaux'}</span>
                {openIncidents.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 font-bold">
                    {openIncidents.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setSubTab('preventive')}
                className={`px-3.5 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer ${
                  subTab === 'preventive'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <CalendarClock className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'الصيانة الدورية' : 'Calendrier Préventif'}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsReportModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{lang === 'ar' ? 'الإبلاغ عن عطل' : 'Signaler une panne'}</span>
            </button>
          </div>
        </div>

        {/* Live Equipment Health Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          {healthTiles.map((tile) => {
            const tileOpen = openIncidents.filter((i) => tile.match.includes(i.category));
            const active = categoryFilter === tile.key;
            return (
              <button
                type="button"
                key={tile.key}
                onClick={() => {
                  setSubTab('incidents');
                  setCategoryFilter(active ? 'all' : tile.key);
                }}
                className={`text-start p-3.5 rounded-xl border transition-all cursor-pointer ${
                  active
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-700 ring-1 ring-emerald-400/50'
                    : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                    {tile.icon}
                    <span>{tile.label}</span>
                  </div>
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      tileOpen.length > 0 ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
                    }`}
                  />
                </div>
                <div
                  className={`text-[11px] font-semibold ${
                    tileOpen.length > 0
                      ? 'text-amber-700 dark:text-amber-400'
                      : 'text-emerald-700 dark:text-emerald-400'
                  }`}
                >
                  {tileOpen.length > 0
                    ? lang === 'ar'
                      ? `${tileOpen.length} تدخل جاري`
                      : `${tileOpen.length} intervention(s)`
                    : lang === 'ar'
                    ? 'في حالة ممتازة'
                    : 'Opérationnel'}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* SUBTAB 1: Incidents & Works */}
      {subTab === 'incidents' && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="inline-flex rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1">
              {[
                { key: 'all' as const, label: `${lang === 'ar' ? 'الكل' : 'Tous'} (${data.incidents.length})` },
                { key: 'open' as const, label: `${lang === 'ar' ? 'جاري' : 'En cours'} (${openIncidents.length})` },
                {
                  key: 'resolu' as const,
                  label: `${lang === 'ar' ? 'تم الإصلاح' : 'Résolus'} (${data.incidents.length - openIncidents.length})`,
                },
              ].map((st) => (
                <button
                  key={st.key}
                  onClick={() => setStatusFilter(st.key)}
                  className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer ${
                    statusFilter === st.key
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 flex-wrap grow sm:grow-0">
              {categoryFilter !== 'all' && (
                <button
                  onClick={() => setCategoryFilter('all')}
                  className="px-2.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-semibold cursor-pointer"
                >
                  {lang === 'ar' ? 'إلغاء الفلتر ×' : 'Réinitialiser filtre ×'}
                </button>
              )}
              <div className="relative min-w-[220px] grow sm:grow-0">
                <Search className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={lang === 'ar' ? 'بحث عن عطل أو موقع...' : 'Rechercher un incident, lieu...'}
                  className="w-full ps-9 pe-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {filteredIncidents.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="w-7 h-7" />}
              title={lang === 'ar' ? 'لا توجد أعطال مطابقة للبحث' : 'Aucun incident dans cette catégorie'}
              description={
                lang === 'ar'
                  ? 'التجهيزات تعمل بشكل جيد أو جرّب تعديل فلاتر العرض.'
                  : 'Les équipements concernés sont opérationnels ou aucun signalement ne correspond aux filtres.'
              }
              action={
                <button
                  type="button"
                  onClick={() => setIsReportModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{lang === 'ar' ? 'الإبلاغ عن عطل جديد' : 'Signaler une panne'}</span>
                </button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredIncidents.map((inc) => {
                const isResolved = inc.status === 'resolu';
                const step = isResolved ? 3 : inc.status === 'en_cours' ? 2 : 1;
                return (
                  <button
                    type="button"
                    key={inc.id}
                    onClick={() => setSelectedIncident(inc)}
                    className={`text-start bg-white dark:bg-slate-900 border rounded-2xl p-5 shadow-xs hover:shadow-md transition-all space-y-3.5 cursor-pointer ${
                      inc.priority === 'urgente' && !isResolved
                        ? 'border-rose-300 dark:border-rose-800/80'
                        : 'border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {getCategoryIcon(inc.category)}
                          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                            {getCategoryLabel(inc.category)}
                          </span>
                          {inc.priority === 'urgente' && !isResolved && (
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                              {t('urgent')}
                            </span>
                          )}
                        </div>
                        <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                          {inc.title}
                        </h3>
                      </div>

                      {isResolved ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {lang === 'ar' ? 'تم الحل' : 'Résolu'}
                        </span>
                      ) : inc.status === 'en_cours' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200 dark:border-sky-800 shrink-0">
                          <Clock className="w-3.5 h-3.5" />
                          {lang === 'ar' ? 'قيد الإصلاح' : 'En cours'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800 shrink-0">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          {lang === 'ar' ? 'مُبلّغ' : 'Signalé'}
                        </span>
                      )}
                    </div>

                    {inc.description && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                        {inc.description}
                      </p>
                    )}

                    {/* 3-Step Visual Progress */}
                    <div className="grid grid-cols-3 gap-1.5 text-[10px] font-semibold">
                      <div className="space-y-1">
                        <div className="h-1.5 rounded-full bg-emerald-500" />
                        <span className="text-emerald-700 dark:text-emerald-400">
                          {lang === 'ar' ? '1. مُبلّغ' : '1. Signalé'}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <div
                          className={`h-1.5 rounded-full ${
                            step >= 2 ? (step === 3 ? 'bg-emerald-500' : 'bg-amber-500') : 'bg-slate-200 dark:bg-slate-700'
                          }`}
                        />
                        <span
                          className={
                            step === 3
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : step === 2
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-slate-400'
                          }
                        >
                          {lang === 'ar' ? '2. قيد الإصلاح' : '2. En cours'}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <div
                          className={`h-1.5 rounded-full ${
                            step === 3 ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'
                          }`}
                        />
                        <span className={step === 3 ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-400'}>
                          {lang === 'ar' ? '3. تم الحل' : '3. Résolu'}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                      <span className="truncate">
                        {inc.location} · {formatDateFr(inc.reportedDate, lang)}
                      </span>
                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
                        <span>{lang === 'ar' ? 'التفاصيل' : 'Détails'}</span>
                        <ChevronRight className={`w-3.5 h-3.5 ${isRtl ? 'rotate-180' : ''}`} />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* SUBTAB 2: Preventive Calendar */}
      {subTab === 'preventive' && (
        <div className="space-y-4">
          <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/50 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-200 font-semibold">
              <CalendarClock className="w-4 h-4 text-emerald-600" />
              <span>
                {lang === 'ar'
                  ? `نسبة الالتزام بالصيانة الدورية: ${okPrevCount}/${preventiveTasks.length}`
                  : `Conformité préventive : ${okPrevCount} / ${preventiveTasks.length} contrôles à jour`}
              </span>
            </div>
            <span className="text-[11px] text-emerald-700 dark:text-emerald-400">
              {lang === 'ar'
                ? 'تشمل المصاعد، خزان المياه، ومطفآت الحريق'
                : 'Ascenseurs, bâche à eau, électricité & extincteurs'}
            </span>
          </div>

          {sortedPreventive.length === 0 ? (
            <EmptyState
              icon={<CalendarClock className="w-7 h-7" />}
              title={lang === 'ar' ? 'لا توجد مهام صيانة دورية مسجلة' : 'Aucune tâche préventive planifiée'}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sortedPreventive.map((task) => {
                const st = getDueStatus(task.nextDueDate);
                return (
                  <div
                    key={task.id}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {getCategoryIcon(task.equipment)}
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">{task.title}</h3>
                        </div>
                        <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2">
                          <span>{getCategoryLabel(task.equipment)}</span>
                          <span>•</span>
                          <span>{getFrequencyLabel(task.frequency)}</span>
                          {task.assignedVendor && (
                            <>
                              <span>•</span>
                              <span>{task.assignedVendor}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <span
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0 ${
                          st === 'overdue'
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300'
                            : st === 'soon'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300'
                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300'
                        }`}
                      >
                        {st === 'overdue'
                          ? lang === 'ar'
                            ? 'متأخر'
                            : 'En retard'
                          : st === 'soon'
                          ? lang === 'ar'
                            ? 'قريباً'
                            : 'À prévoir'
                          : lang === 'ar'
                          ? 'في الوقت'
                          : 'À jour'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[11px]">
                          {lang === 'ar' ? 'آخر فحص' : 'Dernier contrôle'}
                        </span>
                        <strong className="font-mono text-slate-800 dark:text-slate-200">
                          {formatShortDate(task.lastDoneDate, lang)}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">
                          {lang === 'ar' ? 'الموعد القادم' : 'Prochaine échéance'}
                        </span>
                        <strong className="font-mono text-slate-900 dark:text-white">
                          {formatShortDate(task.nextDueDate, lang)}
                        </strong>
                      </div>
                    </div>

                    {task.notes && <p className="text-xs text-slate-600 dark:text-slate-300">{task.notes}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Read-Only Incident Detail Drawer */}
      <SlideOverDrawer
        open={Boolean(selectedIncident)}
        onClose={() => setSelectedIncident(null)}
        title={selectedIncident?.title}
        subtitle={
          selectedIncident
            ? `${selectedIncident.location} · ${t('reportedOn')} ${formatDateFr(selectedIncident.reportedDate, lang)}`
            : undefined
        }
      >
        {selectedIncident && (
          <div className="space-y-5 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-200">
                {getCategoryIcon(selectedIncident.category)}
                {getCategoryLabel(selectedIncident.category)}
              </span>
              <span
                className={`px-2.5 py-1 rounded-full font-bold uppercase ${
                  selectedIncident.status === 'resolu'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                    : selectedIncident.priority === 'urgente'
                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                }`}
              >
                {selectedIncident.status === 'resolu'
                  ? lang === 'ar'
                    ? 'تم الحل'
                    : 'Résolu'
                  : selectedIncident.status === 'en_cours'
                  ? lang === 'ar'
                    ? 'قيد الإصلاح'
                    : 'En cours'
                  : lang === 'ar'
                  ? 'مُبلّغ عنه'
                  : 'Signalé'}
              </span>
            </div>

            {selectedIncident.description && (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 space-y-1.5">
                <div className="font-bold uppercase tracking-wider text-[11px] text-slate-400">
                  {lang === 'ar' ? 'وصف العطل' : 'Description'}
                </div>
                <p className="text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-line">
                  {selectedIncident.description}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800">
                <span className="text-[11px] text-slate-400 block">
                  {t('vendorLabel')}
                </span>
                <strong className="text-slate-900 dark:text-white mt-0.5 block">
                  {selectedIncident.assignedVendor || t('assignedDefault')}
                </strong>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800">
                <span className="text-[11px] text-slate-400 block">
                  {lang === 'ar' ? 'الطابق / الموقع' : 'Étage / Zone'}
                </span>
                <strong className="text-slate-900 dark:text-white mt-0.5 block">
                  {selectedIncident.floor === 0
                    ? lang === 'ar'
                      ? 'الطابق الأرضي'
                      : 'RDC'
                    : `${lang === 'ar' ? 'الطابق' : 'Étage'} ${selectedIncident.floor}`}
                </strong>
              </div>
            </div>

            {selectedIncident.status === 'resolu' && (
              <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 space-y-2">
                <div className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{lang === 'ar' ? 'تقرير التسوية والختام' : "Compte-rendu d'intervention"}</span>
                </div>
                {selectedIncident.resolutionNotes && (
                  <p className="text-slate-700 dark:text-slate-200">{selectedIncident.resolutionNotes}</p>
                )}
                {selectedIncident.actualCostDZD !== undefined && (
                  <div className="pt-1 text-emerald-700 dark:text-emerald-400 font-semibold">
                    {lang === 'ar' ? 'التكلفة الفعلية المسددة:' : 'Coût final validé :'}{' '}
                    <span className="font-mono font-bold">
                      {formatDZD(selectedIncident.actualCostDZD, lang)}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
              <p className="text-[11px] text-slate-500">
                {lang === 'ar'
                  ? 'هل لاحظت عاجلاً جديداً أو تعطل المصعد؟ تواصل فوراً مع رئيس مكتب السانديك أو أرقام الطوارئ.'
                  : 'Un nouveau dysfonctionnement ou une urgence ? Contactez directement le Syndic ou les secours.'}
              </p>
              <div className="flex flex-wrap gap-2">
                <a
                  href={`tel:${data.building.syndicPhone}`}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                >
                  <Phone className="w-4 h-4" />
                  <span>{t('contactSyndic')}</span>
                </a>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedIncident(null);
                    onNavigateTab('directory');
                  }}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 font-semibold cursor-pointer"
                >
                  <Siren className="w-4 h-4" />
                  <span>{t('emergencies24h')}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </SlideOverDrawer>

      {isReportModalOpen && (
        <ReportIncidentModal
          apartments={data.apartments}
          totalFloors={data.building.totalFloors}
          syndicPhone={data.building.syndicPhone}
          onClose={() => setIsReportModalOpen(false)}
          onSubmit={reportResidentIncident}
        />
      )}
    </div>
  );
};
