import React, { useMemo, useState } from 'react';
import {
  Phone,
  Droplet,
  Wrench,
  Megaphone,
  ShieldCheck,
  CheckCircle2,
  Wallet,
  CalendarClock,
  ChevronRight,
  Vote,
  ScrollText,
  Sparkles,
  PiggyBank,
  PieChart,
  Siren,
  AlertTriangle,
} from 'lucide-react';
import {
  formatDZD,
  formatDateFr,
  formatMonthName,
  formatShortDate,
  getCurrentMonthStr,
  getDueStatus,
} from '../../utils/helpers';
import { useI18n } from '../../i18n';
import { useAppStore } from '../../stores/AppStore';
import { CircularGauge, DonutChart } from '../../components/ui/Charts';
import { AppTab } from '../../app/useRoute';
import { isCarryOverTransaction } from '../treasury/treasuryHelpers';
import { ReportIncidentModal } from './ReportIncidentModal';
import residenceHeroImg from '../../assets/images/aadl_residence_complex_1794390110787.jpg';

interface ResidentEssentialPageProps {
  onNavigateTab: (tab: AppTab) => void;
}

export const ResidentEssentialPage: React.FC<ResidentEssentialPageProps> = ({ onNavigateTab }) => {
  const { lang, isRtl, t } = useI18n();
  const { data, reportResidentIncident } = useAppStore();
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const currentMonth = getCurrentMonthStr();

  const occupiedApartments = data.apartments.filter((a) => a.occupancy !== 'vacant').length;
  const currentMonthPayments = data.payments.filter((p) => p.month === currentMonth);
  const paidApartmentsCount = new Set(currentMonthPayments.map((p) => p.apartmentId)).size;
  const currentMonthCollected = currentMonthPayments.reduce((acc, p) => acc + p.amountDZD, 0);
  const totalExpected = occupiedApartments * data.building.standardMonthlyFeeDZD;
  const collectionRate = totalExpected > 0 ? Math.round((currentMonthCollected / totalExpected) * 100) : 0;

  const totalIncomes = data.transactions
    .filter((tx) => tx.type === 'recette')
    .reduce((acc, tx) => acc + tx.amountDZD, 0);
  const totalExpenses = data.transactions
    .filter((tx) => tx.type === 'depense')
    .reduce((acc, tx) => acc + tx.amountDZD, 0);
  const netBalance = totalIncomes - totalExpenses;
  const reserveBalance =
    data.transactions
      .filter((tx) => tx.fund === 'reserve' && tx.type === 'recette')
      .reduce((acc, tx) => acc + tx.amountDZD, 0) -
    data.transactions
      .filter((tx) => tx.fund === 'reserve' && tx.type === 'depense')
      .reduce((acc, tx) => acc + tx.amountDZD, 0);
  const reserveTarget = data.building.reserveTargetDZD || 150000;
  const reserveRate = Math.min(100, Math.max(0, Math.round((reserveBalance / reserveTarget) * 100)));

  const openIncidents = data.incidents.filter((i) => i.status !== 'resolu');
  const openElevatorIncidents = openIncidents.filter((i) => i.category === 'ascenseur');
  const openWaterIncidents = openIncidents.filter((i) => i.category === 'surpresseur_eau');
  const totalElevators = data.building.elevatorCount || 2;
  const operationalElevators = Math.max(0, totalElevators - openElevatorIncidents.length);
  const elevatorAvailability = Math.round((operationalElevators / totalElevators) * 100);

  const preventiveTasks = data.preventiveTasks || [];
  const okPreventiveCount = preventiveTasks.filter((task) => getDueStatus(task.nextDueDate) === 'ok').length;
  const preventiveScore =
    preventiveTasks.length > 0 ? Math.round((okPreventiveCount / preventiveTasks.length) * 100) : 100;
  const nextPreventiveTasks = [...preventiveTasks]
    .sort((a, b) => new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime())
    .slice(0, 3);

  const carryOverNet = useMemo(
    () =>
      data.transactions
        .filter((tx) => isCarryOverTransaction(tx))
        .reduce((acc, tx) => acc + (tx.type === 'recette' ? tx.amountDZD : -tx.amountDZD), 0),
    [data.transactions]
  );

  const operatingExpenses = useMemo(
    () =>
      data.transactions
        .filter((tx) => tx.type === 'depense' && !isCarryOverTransaction(tx))
        .reduce((acc, tx) => acc + tx.amountDZD, 0),
    [data.transactions]
  );

  const expenseSlices = useMemo(() => {
    const map: Record<string, number> = {};
    data.transactions
      .filter((tx) => tx.type === 'depense' && !isCarryOverTransaction(tx))
      .forEach((tx) => {
        map[tx.category] = (map[tx.category] || 0) + tx.amountDZD;
      });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value }));
  }, [data.transactions]);

  const importantNotices = [...data.notices]
    .sort((a, b) => Number(b.isPinned) - Number(a.isPinned))
    .slice(0, 3);
  const activeVote = data.votes.find((v) => v.status === 'active') || data.votes[0];
  const hasUrgentIssue = openIncidents.some((i) => i.priority === 'urgente');

  const quickNavCards: Array<{
    tab: AppTab;
    icon: React.ReactNode;
    title: string;
    metric: string;
    tone: string;
  }> = [
    {
      tab: 'incidents',
      icon: <Wrench className="w-4 h-4 text-amber-600 dark:text-amber-400" />,
      title: lang === 'ar' ? 'الأعطال والأشغال' : 'Pannes & Travaux',
      metric:
        openIncidents.length > 0
          ? lang === 'ar'
            ? `${openIncidents.length} قيد المتابعة`
            : `${openIncidents.length} en cours`
          : lang === 'ar'
          ? 'لا أعطال'
          : 'Aucun incident',
      tone: 'bg-amber-50 dark:bg-amber-950/50 border-amber-200/80 dark:border-amber-900/50',
    },
    {
      tab: 'notices',
      icon: <Megaphone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
      title: lang === 'ar' ? 'الإعلانات والجمعية' : 'Avis & Décisions AG',
      metric:
        lang === 'ar'
          ? `${data.notices.length} إعلان منشور`
          : `${data.notices.length} avis publiés`,
      tone: 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200/80 dark:border-emerald-900/50',
    },
    {
      tab: 'incidents',
      icon: <CalendarClock className="w-4 h-4 text-sky-600 dark:text-sky-400" />,
      title: lang === 'ar' ? 'الصيانة الدورية' : 'Entretien Préventif',
      metric: `${okPreventiveCount}/${preventiveTasks.length} ${t('upToDateShort')}`,
      tone: 'bg-sky-50 dark:bg-sky-950/50 border-sky-200/80 dark:border-sky-900/50',
    },
    {
      tab: 'directory',
      icon: <Siren className="w-4 h-4 text-rose-600 dark:text-rose-400" />,
      title: lang === 'ar' ? 'الطوارئ والمقاولون' : 'Urgences & Contacts',
      metric: `24h/7j · ${data.vendors.length} ${lang === 'ar' ? 'جهات' : 'contacts'}`,
      tone: 'bg-rose-50 dark:bg-rose-950/50 border-rose-200/80 dark:border-rose-900/50',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Architectural Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-slate-900 border border-slate-800 text-white shadow-md">
        <div className="absolute inset-0 z-0">
          <img
            src={residenceHeroImg}
            alt="Cité AADL"
            className="w-full h-full object-cover opacity-20"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900/95 to-emerald-950/75" />
        </div>

        <div className="relative z-10 p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2.5 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/15 text-emerald-300 font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                {t('residentPortalBadge')}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold border ${
                  hasUrgentIssue
                    ? 'bg-amber-500/15 border-amber-400/40 text-amber-300'
                    : 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    hasUrgentIssue ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'
                  }`}
                />
                {hasUrgentIssue ? t('interventionOngoing') : t('buildingOperational')}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              {data.building.buildingNumber} — {data.building.residenceName}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {data.building.wilaya} · {data.building.ilot} · {data.apartments.length} (R+{data.building.totalFloors}) ·{' '}
              {t('syndic')} : <strong className="text-white">{data.building.syndicPresident}</strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsReportModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl shadow-sm transition-colors cursor-pointer"
            >
              <AlertTriangle className="w-4 h-4" />
              <span>{lang === 'ar' ? 'الإبلاغ عن عطل' : 'Signaler une panne'}</span>
            </button>
            <a
              href={`tel:${data.building.syndicPhone}`}
              className="flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-sm transition-colors"
            >
              <Phone className="w-4 h-4" />
              <span>{t('contactSyndic')}</span>
            </a>
            <button
              onClick={() => onNavigateTab('directory')}
              className="flex items-center gap-1.5 px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-rose-100 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/30 rounded-xl transition-colors cursor-pointer"
            >
              <Siren className="w-4 h-4 text-rose-300" />
              <span>{t('emergencies24h')}</span>
            </button>
            <button
              onClick={() => onNavigateTab('notices')}
              className="flex items-center gap-1.5 px-3.5 py-2.5 text-xs sm:text-sm font-medium text-slate-200 bg-white/10 hover:bg-white/15 border border-white/15 rounded-xl transition-colors cursor-pointer"
            >
              <ScrollText className="w-4 h-4 text-emerald-300" />
              <span>{t('rulesShortcut')}</span>
            </button>
          </div>
        </div>

        {/* Integrated Quick-Access Strip */}
        <div className="relative z-10 px-6 sm:px-8 pb-6 grid grid-cols-2 lg:grid-cols-4 gap-3">
          {quickNavCards.map((item, idx) => (
            <button
              key={idx}
              onClick={() => onNavigateTab(item.tab)}
              className="text-start p-3 rounded-2xl bg-white/10 hover:bg-white/15 backdrop-blur-sm border border-white/10 transition-all flex items-center justify-between gap-3 cursor-pointer group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-white/95 dark:bg-slate-900 flex items-center justify-center shrink-0">
                  {item.icon}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate">{item.title}</div>
                  <div className="text-[11px] text-emerald-200/90 truncate">{item.metric}</div>
                </div>
              </div>
              <ChevronRight
                className={`w-4 h-4 text-slate-400 group-hover:text-white shrink-0 ${isRtl ? 'rotate-180' : ''}`}
              />
            </button>
          ))}
        </div>
      </div>

      {/* 4 Essential KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {t('feesKpiLabel')} {formatMonthName(currentMonth, lang)}
              </span>
              <div className="text-2xl font-black font-mono tracking-tight text-slate-900 dark:text-white tabular-nums">
                {paidApartmentsCount}
                <span className="text-sm font-semibold text-slate-400"> / {occupiedApartments}</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t('upToDateApts')}</p>
            </div>
            <CircularGauge
              percent={collectionRate}
              colorClass={collectionRate >= 75 ? 'text-emerald-500' : collectionRate >= 50 ? 'text-amber-500' : 'text-rose-500'}
            />
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">{t('condoRate')}</span>
            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
              {formatDZD(data.building.standardMonthlyFeeDZD, lang)} /{' '}
              {data.building.feeFrequency === 'mensuel' ? t('perMonth') : t('perYear')}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {t('buildingTreasury')}
              </span>
              <div
                className={`text-2xl font-black font-mono tracking-tight tabular-nums ${
                  netBalance >= 0 ? 'text-slate-900 dark:text-white' : 'text-rose-600'
                }`}
              >
                {formatDZD(netBalance, lang)}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t('availableCashBalance')}</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-400 font-semibold">
                <PiggyBank className="w-3.5 h-3.5" />
                {t('reserveFund')}
              </span>
              <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                {formatDZD(reserveBalance, lang)} ({reserveRate}%)
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-500"
                style={{ width: `${reserveRate}%` }}
              />
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onNavigateTab('incidents')}
          className="text-start bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all cursor-pointer"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {t('elevatorsLabel')} ({totalElevators} {t('cabins')})
              </span>
              <div
                className={`text-2xl font-black font-mono tracking-tight tabular-nums ${
                  operationalElevators === totalElevators
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : operationalElevators > 0
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {operationalElevators} / {totalElevators}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {operationalElevators === totalElevators ? t('allCabinsRunning') : t('maintenanceOngoing')}
              </p>
            </div>
            <CircularGauge
              percent={elevatorAvailability}
              colorClass={
                elevatorAvailability === 100
                  ? 'text-emerald-500'
                  : elevatorAvailability > 0
                  ? 'text-amber-500'
                  : 'text-rose-500'
              }
            />
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 text-[11px]">
            {Array.from({ length: totalElevators }).map((_, idx) => {
              const isDown = idx < openElevatorIncidents.length;
              return (
                <span
                  key={idx}
                  className={`flex-1 inline-flex items-center justify-center gap-1.5 py-1 rounded-lg font-semibold ${
                    isDown
                      ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                      : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${isDown ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`}
                  />
                  {t('cabin')} {idx + 1}
                </span>
              );
            })}
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('incidents')}
          className="text-start bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all cursor-pointer"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {t('waterMaintenance')}
              </span>
              <div
                className={`text-lg font-extrabold tracking-tight ${
                  openWaterIncidents.length > 0
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {openWaterIncidents.length > 0 ? t('boosterAlert') : t('waterNormal')}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('preventiveUpToDate')} {okPreventiveCount}/{preventiveTasks.length} {t('upToDateShort')}
              </p>
            </div>
            <CircularGauge
              percent={preventiveScore}
              colorClass={preventiveScore >= 75 ? 'text-sky-500' : 'text-amber-500'}
            />
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
            <span className="inline-flex items-center gap-1 text-slate-500">
              <Droplet className="w-3.5 h-3.5 text-sky-500" />
              {t('waterTank')}
            </span>
            <span className={`font-semibold ${openWaterIncidents.length > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {openWaterIncidents.length > 0 ? t('activeCheck') : t('ok')}
            </span>
          </div>
        </button>
      </div>

      {/* Bento Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          {/* Active Incidents & Progress Stepper */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-amber-500" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  {t('ongoingIssuesTitle')} ({openIncidents.length})
                </h2>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsReportModalOpen(true)}
                  className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 cursor-pointer"
                >
                  + {lang === 'ar' ? 'تبليغ' : 'Signaler'}
                </button>
                <button
                  onClick={() => onNavigateTab('incidents')}
                  className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  <span>{t('fullTracking')}</span>
                  <ChevronRight className={`w-3.5 h-3.5 ${isRtl ? 'rotate-180' : ''}`} />
                </button>
              </div>
            </div>

            {openIncidents.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto mb-1.5" />
                {t('noIssuesMsg')}
              </div>
            ) : (
              <div className="space-y-3">
                {openIncidents.slice(0, 4).map((inc) => {
                  const stepIdx = inc.status === 'en_cours' ? 2 : 1;
                  return (
                    <button
                      type="button"
                      key={inc.id}
                      onClick={() => onNavigateTab('incidents')}
                      className="w-full text-start p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors space-y-2.5 cursor-pointer"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                                inc.priority === 'urgente'
                                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                                  : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                              }`}
                            >
                              {inc.priority === 'urgente' ? t('urgent') : t('inProgress')}
                            </span>
                            <span className="text-[11px] font-mono text-slate-500">{inc.location}</span>
                          </div>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">{inc.title}</h3>
                        </div>
                        <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 shrink-0 self-start sm:self-center">
                          {inc.assignedVendor || t('assignedDefault')}
                        </span>
                      </div>

                      {/* 3-Step Visual Progress Bar */}
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
                              stepIdx >= 2 ? 'bg-amber-500' : 'bg-slate-200 dark:bg-slate-700'
                            }`}
                          />
                          <span className={stepIdx >= 2 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}>
                            {lang === 'ar' ? '2. قيد الإصلاح' : '2. En cours'}
                          </span>
                        </div>
                        <div className="space-y-1">
                          <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700" />
                          <span className="text-slate-400">{lang === 'ar' ? '3. تم الحل' : '3. Résolu'}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Transparent Expense Donut + Upcoming Preventive */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center gap-2 mb-3">
                <PieChart className="w-4 h-4 text-emerald-600" />
                <h2 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  {t('residentExpenseBreakdownTitle')}
                </h2>
              </div>
              <DonutChart
                slices={expenseSlices}
                centerLabel={t('expenses')}
                emptyNote={
                  operatingExpenses === 0 && carryOverNet !== 0
                    ? lang === 'ar'
                      ? `0 دج مصاريف تشغيلية في 2026 (ترحيل رصيد 2025 : ${formatDZD(carryOverNet, lang)})`
                      : `0 DZD de dépenses d'exploitation en 2026 (Report exercice 2025 : ${formatDZD(carryOverNet, lang)})`
                    : undefined
                }
              />
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3.5">
                <div className="flex items-center gap-2">
                  <CalendarClock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <h2 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    {t('upcomingPreventiveTitle')}
                  </h2>
                </div>
                <button
                  onClick={() => onNavigateTab('incidents')}
                  className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  {t('calendarLink')}
                </button>
              </div>
              <div className="space-y-2.5">
                {nextPreventiveTasks.map((task) => {
                  const st = getDueStatus(task.nextDueDate);
                  return (
                    <div
                      key={task.id}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-2"
                    >
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{task.title}</p>
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold shrink-0 ${
                          st === 'overdue'
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                            : st === 'soon'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        }`}
                      >
                        {formatShortDate(task.nextDueDate, lang)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Notices, Vote & Emergencies */}
        <div className="space-y-5">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-emerald-600" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  {t('hallNoticesTitle')}
                </h2>
              </div>
              <button
                onClick={() => onNavigateTab('notices')}
                className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
              >
                {t('seeAll')}
              </button>
            </div>

            {importantNotices.map((notice) => (
              <button
                type="button"
                key={notice.id}
                onClick={() => onNavigateTab('notices')}
                className="w-full text-start p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors space-y-1 cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2 text-[10px]">
                  <span
                    className={`font-bold uppercase px-1.5 py-0.5 rounded ${
                      notice.type === 'urgent'
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                        : notice.type === 'coupure_eau'
                        ? 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300'
                        : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {notice.type === 'coupure_eau' ? t('waterCut') : notice.type}
                  </span>
                  <span className="font-mono text-slate-400">{formatDateFr(notice.date, lang)}</span>
                </div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">{notice.title}</h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">{notice.message}</p>
              </button>
            ))}
          </div>

          {activeVote && (
            <button
              type="button"
              onClick={() => onNavigateTab('notices')}
              className="w-full text-start bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors rounded-2xl p-5 shadow-xs space-y-3 cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Vote className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    {t('agConsultation')}
                  </span>
                </div>
                <span className="text-[11px] font-mono text-emerald-600 font-bold">
                  {Math.round(
                    (activeVote.options.reduce((a, o) => a + o.votes, 0) /
                      Math.max(1, activeVote.totalEligibleApartments)) *
                      100
                  )}
                  % {t('quorum')}
                </span>
              </div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">{activeVote.title}</h3>
              <div className="space-y-1.5">
                {activeVote.options.slice(0, 2).map((opt) => {
                  const total = activeVote.options.reduce((a, o) => a + o.votes, 0) || 1;
                  const pct = Math.round((opt.votes / total) * 100);
                  return (
                    <div key={opt.id} className="space-y-0.5 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-slate-600 dark:text-slate-300 truncate">{opt.label}</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">{pct}%</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </button>
          )}

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-rose-500" />
                {t('emergencies24h')}
              </span>
              <button
                onClick={() => onNavigateTab('directory')}
                className="text-[11px] font-semibold text-emerald-600 hover:underline cursor-pointer"
              >
                {t('directoryLink')}
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-2 text-center">
              <a
                href="tel:14"
                className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 hover:bg-rose-100 transition-colors"
              >
                <span className="block text-sm font-black font-mono text-rose-700 dark:text-rose-300" dir="ltr">
                  14
                </span>
                <span className="text-[10px] text-rose-600 dark:text-rose-400 font-medium">
                  {t('civilProtectionShort')}
                </span>
              </a>
              <a
                href="tel:3303"
                className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900/60 hover:bg-amber-100 transition-colors"
              >
                <span className="block text-sm font-black font-mono text-amber-700 dark:text-amber-300" dir="ltr">
                  3303
                </span>
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                  {t('sonelgazShort')}
                </span>
              </a>
              <a
                href="tel:17"
                className="p-2.5 rounded-xl bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-900/60 hover:bg-sky-100 transition-colors"
              >
                <span className="block text-sm font-black font-mono text-sky-700 dark:text-sky-300" dir="ltr">
                  17
                </span>
                <span className="text-[10px] text-sky-600 dark:text-sky-400 font-medium">
                  {t('policeShort')}
                </span>
              </a>
              <a
                href="tel:1594"
                className="p-2.5 rounded-xl bg-cyan-50 dark:bg-cyan-950/50 border border-cyan-200 dark:border-cyan-900/60 hover:bg-cyan-100 transition-colors"
              >
                <span className="block text-sm font-black font-mono text-cyan-700 dark:text-cyan-300" dir="ltr">
                  1594
                </span>
                <span className="text-[10px] text-cyan-700 dark:text-cyan-400 font-medium">
                  {lang === 'ar' ? 'المياه (SEAAL)' : 'Eau (SEAAL)'}
                </span>
              </a>
            </div>
          </div>
        </div>
      </div>

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
