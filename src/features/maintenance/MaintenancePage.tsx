import React, { useEffect, useState } from 'react';
import {
  Wrench,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  Droplet,
  Layers,
  Zap,
  Check,
  CalendarClock,
  Scale,
  ShieldCheck,
} from 'lucide-react';
import {
  Incident,
  IncidentCategory,
  PreventiveFrequency,
  PreventiveTask,
} from '../../types';
import { formatDZD, formatDateFr, formatShortDate, getDueStatus } from '../../utils/helpers';
import { useI18n } from '../../i18n';
import { useAppStore } from '../../stores/AppStore';
import { canManageMaintenance } from '../../utils/permissions';
import { EmptyState } from '../../components/ui/EmptyState';
import { AddQuoteModal, NewIncidentModal, ResolveIncidentModal } from './IncidentModals';
import { CompletePreventiveModal, NewPreventiveModal } from './PreventiveModals';

export const MaintenancePage: React.FC = () => {
  const { lang, t } = useI18n();
  const {
    data,
    role,
    addIncident,
    updateIncidentStatus,
    addIncidentQuote,
    selectIncidentQuote,
    addPreventiveTask,
    completePreventiveTask,
  } = useAppStore();

  const canManage = canManageMaintenance(role);
  const [subTab, setSubTab] = useState<'curative' | 'preventive'>('curative');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [resolvingIncident, setResolvingIncident] = useState<Incident | null>(null);
  const [quoteIncident, setQuoteIncident] = useState<Incident | null>(null);
  const [isNewPrevModalOpen, setIsNewPrevModalOpen] = useState(false);
  const [completingTask, setCompletingTask] = useState<PreventiveTask | null>(null);

  useEffect(() => {
    try {
      const jumpTab = sessionStorage.getItem('gest_aadl_maint_subtab');
      if (jumpTab === 'preventive') {
        setSubTab('preventive');
        sessionStorage.removeItem('gest_aadl_maint_subtab');
      }
    } catch {
      // ignore
    }
  }, []);

  const quoteThreshold = data.building.quoteThresholdDZD || 20000;
  const preventiveTasks = data.preventiveTasks || [];
  const overdueTasks = preventiveTasks.filter((task) => getDueStatus(task.nextDueDate) === 'overdue');
  const soonTasks = preventiveTasks.filter((task) => getDueStatus(task.nextDueDate) === 'soon');

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
        case 'securite_gardiennage': return 'الأمن والحماية من الحرائق';
        default: return 'عطل آخر';
      }
    }
    switch (category) {
      case 'ascenseur': return 'Ascenseurs';
      case 'surpresseur_eau': return 'Bâche à eau & Surpresseur';
      case 'electricite_eclairage': return 'Électricité & Éclairage';
      case 'porte_interphone': return "Porte d'accès & Interphone";
      case 'plomberie_evacuation': return 'Plomberie & Toiture';
      case 'nettoyage_ordures': return 'Propreté & Hygiène';
      case 'securite_gardiennage': return 'Sécurité & Incendie';
      default: return 'Autre incident';
    }
  };

  const getFrequencyLabel = (f: PreventiveFrequency) => {
    if (lang === 'ar') {
      switch (f) {
        case 'hebdomadaire': return 'أسبوعية';
        case 'mensuel': return 'شهرية';
        case 'trimestriel': return 'فصلية (3 أشهر)';
        case 'semestriel': return 'نصف سنوية (6 أشهر)';
        case 'annuel': return 'سنوية';
      }
    }
    switch (f) {
      case 'hebdomadaire': return 'Hebdomadaire';
      case 'mensuel': return 'Mensuelle';
      case 'trimestriel': return 'Trimestrielle';
      case 'semestriel': return 'Semestrielle (6 mois)';
      case 'annuel': return 'Annuelle';
    }
  };

  const filteredIncidents = data.incidents
    .filter((inc) => {
      if (filterCategory !== 'all' && inc.category !== filterCategory) return false;
      if (filterStatus === 'open' && inc.status === 'resolu') return false;
      if (filterStatus === 'resolu' && inc.status !== 'resolu') return false;
      return true;
    })
    .sort((a, b) => new Date(b.reportedDate).getTime() - new Date(a.reportedDate).getTime());

  const openIncidentsCount = data.incidents.filter((i) => i.status !== 'resolu').length;

  return (
    <div className="space-y-6">
      {/* Header & Sub-tabs */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Wrench className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                {t('incidentsTitle')}
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {lang === 'ar'
                ? 'متابعة أعطال المصاعد وخزان المياه وجدول الصيانة الوقائية.'
                : 'Suivi curatif des pannes, comparateur de devis et calendrier préventif.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-xs">
              <button
                onClick={() => setSubTab('curative')}
                className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer ${
                  subTab === 'curative'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'الأعطال الجارية' : 'Incidents & Pannes'}</span>
                {openIncidentsCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 font-bold">
                    {openIncidentsCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setSubTab('preventive')}
                className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer ${
                  subTab === 'preventive'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <CalendarClock className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'الصيانة الدورية' : 'Entretien Préventif'}</span>
                {(overdueTasks.length > 0 || soonTasks.length > 0) && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300 font-bold">
                    {overdueTasks.length + soonTasks.length}
                  </span>
                )}
              </button>
            </div>

            {canManage && subTab === 'curative' && (
              <button
                onClick={() => setIsNewModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{lang === 'ar' ? 'إبلاغ عن عطل' : 'Signaler une panne'}</span>
              </button>
            )}

            {canManage && subTab === 'preventive' && (
              <button
                onClick={() => setIsNewPrevModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{lang === 'ar' ? 'إضافة مهمة دورية' : 'Planifier tâche'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Filters on Curative */}
        {subTab === 'curative' && (
          <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
            <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-1">
              {[
                { key: 'all', label: lang === 'ar' ? 'الكل' : 'Tous' },
                { key: 'open', label: `${lang === 'ar' ? 'قيد المعالجة' : 'Ouverts'} (${openIncidentsCount})` },
                { key: 'resolu', label: lang === 'ar' ? 'تم حلها' : 'Résolus' },
              ].map((st) => (
                <button
                  key={st.key}
                  onClick={() => setFilterStatus(st.key)}
                  className={`px-3 py-1 rounded-md font-medium cursor-pointer ${
                    filterStatus === st.key
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>

            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
            >
              <option value="all">{lang === 'ar' ? 'كل التجهيزات' : 'Tous les équipements'}</option>
              <option value="ascenseur">{lang === 'ar' ? 'المصاعد' : 'Ascenseurs'}</option>
              <option value="surpresseur_eau">{lang === 'ar' ? 'خزان المياه ومجموعة الضغط' : 'Bâche à eau & Surpresseur'}</option>
              <option value="electricite_eclairage">{lang === 'ar' ? 'الكهرباء والإنارة' : 'Électricité & Éclairage'}</option>
              <option value="porte_interphone">{lang === 'ar' ? 'باب المدخل والإنترفون' : 'Porte & Interphone'}</option>
              <option value="plomberie_evacuation">{lang === 'ar' ? 'السباكة والسطح' : 'Plomberie & Toiture'}</option>
              <option value="securite_gardiennage">{lang === 'ar' ? 'الأمن والحماية' : 'Sécurité & Incendie'}</option>
            </select>
          </div>
        )}
      </div>

      {/* CURATIVE LIST */}
      {subTab === 'curative' && (
        filteredIncidents.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 className="w-7 h-7" />}
            title={lang === 'ar' ? 'لا توجد أعطال في هذا الفلتر' : 'Aucun incident trouvé'}
            description={
              lang === 'ar'
                ? 'جميع تجهيزات العمارة تعمل بشكل طبيعي أو لا يوجد تطابق مع الفلتر.'
                : 'Les équipements de la cage sont opérationnels ou aucun incident ne correspond aux filtres.'
            }
          />
        ) : (
          <div className="space-y-4">
            {filteredIncidents.map((inc) => {
              const isResolved = inc.status === 'resolu';
              const quotes = inc.quotes || [];
              const needsMoreQuotes =
                !isResolved &&
                (inc.estimatedCostDZD || 0) >= quoteThreshold &&
                quotes.length < 2;
              const lowestQuoteId =
                quotes.length > 0
                  ? [...quotes].sort((a, b) => a.amountDZD - b.amountDZD)[0].id
                  : null;

              return (
                <div
                  key={inc.id}
                  className={`bg-white dark:bg-slate-900 border rounded-2xl p-5 shadow-xs space-y-3 ${
                    inc.priority === 'urgente' && !isResolved
                      ? 'border-rose-300 dark:border-rose-800/80'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {getCategoryIcon(inc.category)}
                        <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                          {inc.title}
                        </h3>
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {getCategoryLabel(inc.category)}
                        </span>
                        {inc.priority === 'urgente' && !isResolved && (
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300">
                            {lang === 'ar' ? 'عاجل' : 'Urgent'}
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span>{inc.location}</span>
                        <span>•</span>
                        <span>
                          {t('reportedOn')} {formatDateFr(inc.reportedDate, lang)}
                        </span>
                        <span>•</span>
                        <span>
                          {lang === 'ar' ? 'المبلغ:' : 'Signalé par :'} {inc.reportedBy}
                        </span>
                        {inc.assignedVendor && (
                          <>
                            <span>•</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                              {t('vendorLabel')} {inc.assignedVendor}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {inc.status === 'signale' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          {lang === 'ar' ? 'مُبلّغ عنه' : 'Signalé'}
                        </span>
                      )}
                      {inc.status === 'en_cours' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                          <Clock className="w-3.5 h-3.5" />
                          {lang === 'ar' ? 'قيد الإصلاح' : 'En cours'}
                        </span>
                      )}
                      {isResolved && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {lang === 'ar' ? 'تم الإصلاح' : 'Résolu'}
                        </span>
                      )}

                      {canManage && !isResolved && (
                        <>
                          {inc.status === 'signale' && (
                            <button
                              onClick={() => updateIncidentStatus(inc.id, 'en_cours')}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white cursor-pointer"
                            >
                              {lang === 'ar' ? 'بدء الإصلاح' : 'Prendre en charge'}
                            </button>
                          )}
                          <button
                            onClick={() => setQuoteIncident(inc)}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center gap-1 cursor-pointer"
                          >
                            <Scale className="w-3.5 h-3.5" />
                            <span>{t('addQuoteBtn')}</span>
                          </button>
                          <button
                            onClick={() => setResolvingIncident(inc)}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                          >
                            {lang === 'ar' ? 'إغلاق العطل' : 'Clôturer'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {inc.description && (
                    <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                      {inc.description}
                    </p>
                  )}

                  {/* Quote comparator / rule */}
                  {(needsMoreQuotes || quotes.length > 0) && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                      {needsMoreQuotes && (
                        <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-300 flex items-center gap-2">
                          <Scale className="w-4 h-4 shrink-0" />
                          <span>
                            {lang === 'ar'
                              ? `التكلفة التقديرية تفوق ${formatDZD(quoteThreshold, lang)} — يوصى بمقارنة عرضي أسعار على الأقل قبل الالتزام.`
                              : `Coût estimé ≥ ${formatDZD(quoteThreshold, lang)} : la charte syndicale recommande au moins 2 devis comparatifs avant engagement.`}
                          </span>
                        </div>
                      )}

                      {quotes.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {quotes.map((qt) => (
                            <div
                              key={qt.id}
                              className={`p-2.5 rounded-xl border text-xs flex flex-col justify-between gap-1.5 ${
                                qt.selected
                                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700'
                                  : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1">
                                    <span>{qt.vendorName}</span>
                                    {qt.id === lowestQuoteId && quotes.length > 1 && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-100 text-sky-700 dark:bg-sky-900/60 dark:text-sky-300">
                                        {lang === 'ar' ? 'الأقل سعراً' : 'Moins-disant'}
                                      </span>
                                    )}
                                  </div>
                                  <div className="font-mono font-extrabold text-sm text-emerald-700 dark:text-emerald-400">
                                    {formatDZD(qt.amountDZD, lang)}
                                  </div>
                                </div>
                                {qt.selected ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                                    <Check className="w-3.5 h-3.5" />
                                    {lang === 'ar' ? 'معتمد' : 'Retenu'}
                                  </span>
                                ) : (
                                  canManage &&
                                  !isResolved && (
                                    <button
                                      onClick={() => selectIncidentQuote(inc.id, qt.id)}
                                      className="text-[11px] font-semibold px-2 py-1 rounded bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 hover:bg-emerald-50 cursor-pointer"
                                    >
                                      {lang === 'ar' ? 'اعتماد' : 'Retenir'}
                                    </button>
                                  )
                                )}
                              </div>
                              {qt.notes && <div className="text-[11px] text-slate-500">{qt.notes}</div>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Footer summary */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500">
                    <div>
                      {inc.estimatedCostDZD ? (
                        <span>
                          {lang === 'ar' ? 'التقدير:' : 'Estimé :'}{' '}
                          <strong className="font-mono">{formatDZD(inc.estimatedCostDZD, lang)}</strong>
                        </span>
                      ) : null}
                      {inc.actualCostDZD !== undefined && (
                        <span className="ms-3 text-emerald-700 dark:text-emerald-400 font-semibold">
                          {lang === 'ar' ? 'التكلفة الفعلية:' : 'Coût réel :'}{' '}
                          <strong className="font-mono">{formatDZD(inc.actualCostDZD, lang)}</strong>
                        </span>
                      )}
                    </div>
                    {isResolved && inc.resolutionNotes && (
                      <span className="italic text-slate-600 dark:text-slate-300">
                        « {inc.resolutionNotes} »
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* PREVENTIVE CALENDAR */}
      {subTab === 'preventive' && (
        preventiveTasks.length === 0 ? (
          <EmptyState
            icon={<CalendarClock className="w-7 h-7" />}
            title={lang === 'ar' ? 'لا توجد مهام صيانة دورية مسجلة' : 'Aucune tâche préventive planifiée'}
            description={
              lang === 'ar'
                ? 'أضف جدول فحص المصاعد وخزان المياه ومطفآت الحريق.'
                : 'Planifiez les contrôles périodiques des ascenseurs, de la bâche à eau et des extincteurs.'
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {preventiveTasks.map((task) => {
              const dueStatus = getDueStatus(task.nextDueDate);
              return (
                <div
                  key={task.id}
                  className={`bg-white dark:bg-slate-900 border rounded-2xl p-5 shadow-xs space-y-3 ${
                    dueStatus === 'overdue'
                      ? 'border-rose-300 dark:border-rose-800'
                      : dueStatus === 'soon'
                      ? 'border-amber-300 dark:border-amber-800'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {getCategoryIcon(task.equipment)}
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                          {task.title}
                        </h3>
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
                        dueStatus === 'overdue'
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300'
                          : dueStatus === 'soon'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300'
                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300'
                      }`}
                    >
                      {dueStatus === 'overdue'
                        ? lang === 'ar'
                          ? 'متأخر'
                          : 'En retard'
                        : dueStatus === 'soon'
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
                        {lang === 'ar' ? 'آخر تنفيذ' : 'Dernière exécution'}
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

                  {(task.history || []).length > 0 && (
                    <div className="text-[11px] text-slate-500 pt-1">
                      {lang === 'ar' ? 'السجل:' : 'Historique :'} {(task.history || []).length}{' '}
                      {lang === 'ar' ? 'عملية مسجلة' : 'intervention(s)'}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                    <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                      {task.estimatedCostDZD ? formatDZD(task.estimatedCostDZD, lang) : '—'}
                    </span>

                    {canManage && (
                      <button
                        onClick={() => setCompletingTask(task)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{lang === 'ar' ? 'تنفيذ الآن' : 'Exécuter'}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Modals */}
      {isNewModalOpen && (
        <NewIncidentModal
          defaultReporter={data.building.syndicPresident}
          vendors={data.vendors}
          totalFloors={data.building.totalFloors}
          onClose={() => setIsNewModalOpen(false)}
          onSubmit={addIncident}
        />
      )}

      {quoteIncident && (
        <AddQuoteModal
          incident={quoteIncident}
          vendors={data.vendors}
          onClose={() => setQuoteIncident(null)}
          onSubmit={(q) => addIncidentQuote(quoteIncident.id, q)}
        />
      )}

      {resolvingIncident && (
        <ResolveIncidentModal
          incident={resolvingIncident}
          onClose={() => setResolvingIncident(null)}
          onSubmit={(cost, notes) => updateIncidentStatus(resolvingIncident.id, 'resolu', cost, notes)}
        />
      )}

      {isNewPrevModalOpen && (
        <NewPreventiveModal
          vendors={data.vendors}
          onClose={() => setIsNewPrevModalOpen(false)}
          onSubmit={addPreventiveTask}
        />
      )}

      {completingTask && (
        <CompletePreventiveModal
          task={completingTask}
          defaultPerformer={data.building.committee?.technicalLead || data.building.syndicPresident}
          onClose={() => setCompletingTask(null)}
          onSubmit={(date, by, cost, notes) => completePreventiveTask(completingTask.id, date, by, cost, notes)}
        />
      )}
    </div>
  );
};
