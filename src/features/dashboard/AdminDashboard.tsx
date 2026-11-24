import React, { useMemo } from 'react';
import {
  Building2,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  CheckCircle2,
  AlertTriangle,
  Wrench,
  Phone,
  Users,
  FileText,
  Plus,
  Droplet,
  Layers,
  ChevronRight,
  Megaphone,
  BarChart3,
  PieChart,
} from 'lucide-react';
import { PaymentRecord } from '../../types';
import { formatDZD, formatDateFr, formatMonthName, formatShortDate, getCurrentMonthStr, getDueStatus } from '../../utils/helpers';
import { useI18n } from '../../i18n';
import { useAppStore } from '../../stores/AppStore';
import { canManageFinance, canManageMaintenance } from '../../utils/permissions';
import { CashflowBarChart, DonutChart, FloorCollectionChart } from '../../components/ui/Charts';
import { AppTab } from '../../app/useRoute';
import residenceHeroImg from '../../assets/images/aadl_residence_complex_1794390110787.jpg';

interface AdminDashboardProps {
  onNavigateTab: (tab: AppTab) => void;
  onOpenNewPayment: () => void;
  onSelectReceipt: (payment: PaymentRecord) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onNavigateTab,
  onOpenNewPayment,
  onSelectReceipt,
}) => {
  const { lang, isRtl, t } = useI18n();
  const { data, role } = useAppStore();
  const currentMonth = getCurrentMonthStr();

  const totalApartments = data.apartments.length;
  const occupiedApartments = data.apartments.filter((a) => a.occupancy !== 'vacant').length;
  const currentMonthPayments = data.payments.filter((p) => p.month === currentMonth);
  const currentMonthCollected = currentMonthPayments.reduce((acc, p) => acc + p.amountDZD, 0);
  const paidAptIds = new Set(currentMonthPayments.map((p) => p.apartmentId));
  const paidApartmentsCount = paidAptIds.size;
  const totalExpectedCurrentMonth = occupiedApartments * data.building.standardMonthlyFeeDZD;
  const collectionRate = totalExpectedCurrentMonth > 0
    ? Math.round((currentMonthCollected / totalExpectedCurrentMonth) * 100)
    : 0;

  const totalIncomes = data.transactions
    .filter((tx) => tx.type === 'recette')
    .reduce((acc, tx) => acc + tx.amountDZD, 0);
  const totalExpenses = data.transactions
    .filter((tx) => tx.type === 'depense')
    .reduce((acc, tx) => acc + tx.amountDZD, 0);
  const netTreasuryBalance = totalIncomes - totalExpenses;
  const reserveBalance =
    data.transactions
      .filter((tx) => tx.fund === 'reserve' && tx.type === 'recette')
      .reduce((acc, tx) => acc + tx.amountDZD, 0) -
    data.transactions
      .filter((tx) => tx.fund === 'reserve' && tx.type === 'depense')
      .reduce((acc, tx) => acc + tx.amountDZD, 0);

  const urgentPreventiveTasks = (data.preventiveTasks || []).filter((task) => {
    const st = getDueStatus(task.nextDueDate);
    return st === 'overdue' || st === 'soon';
  });

  const openIncidents = data.incidents.filter((i) => i.status !== 'resolu');
  const openElevatorIncidents = openIncidents.filter((i) => i.category === 'ascenseur');
  const openWaterIncidents = openIncidents.filter((i) => i.category === 'surpresseur_eau');
  const totalElevators = data.building.elevatorCount || 2;
  const operationalElevators = Math.max(0, totalElevators - openElevatorIncidents.length);

  const recentPayments = [...data.payments]
    .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())
    .slice(0, 5);

  const pinnedNotices = data.notices.filter((n) => n.isPinned);
  const activeNotice = pinnedNotices.length > 0 ? pinnedNotices[0] : data.notices[0];

  // Cashflow aggregated by month (YYYY-MM)
  const cashflowPoints = useMemo(() => {
    const map = new Map<string, { income: number; expense: number }>();
    data.transactions.forEach((tx) => {
      const key = (tx.date || '').slice(0, 7) || '2026-01';
      const entry = map.get(key) || { income: 0, expense: 0 };
      if (tx.type === 'recette') entry.income += tx.amountDZD;
      else entry.expense += tx.amountDZD;
      map.set(key, entry);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6)
      .map(([k, v]) => ({ label: k.slice(2), income: v.income, expense: v.expense }));
  }, [data.transactions]);

  // Expense breakdown for DonutChart
  const expenseSlices = useMemo(() => {
    const map: Record<string, number> = {};
    data.transactions
      .filter((tx) => tx.type === 'depense')
      .forEach((tx) => {
        map[tx.category] = (map[tx.category] || 0) + tx.amountDZD;
      });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value }));
  }, [data.transactions]);

  // Floor recovery breakdown
  const floorCollection = useMemo(() => {
    const maxFloor = Math.max(data.building.totalFloors || 0, ...data.apartments.map((a) => a.floor));
    const list: Array<{ label: string; paid: number; total: number }> = [];
    for (let f = 0; f <= maxFloor; f++) {
      const apts = data.apartments.filter((a) => a.floor === f && a.occupancy !== 'vacant');
      if (apts.length === 0) continue;
      const paid = apts.filter((a) => paidAptIds.has(a.id)).length;
      list.push({
        label: f === 0 ? t('rdcShort') : `É${f}`,
        paid,
        total: apts.length,
      });
    }
    return list;
  }, [data.apartments, data.building.totalFloors, paidAptIds, t]);

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-slate-900 border border-slate-800 text-white shadow-sm">
        <div className="absolute inset-0 z-0">
          <img
            src={residenceHeroImg}
            alt="Cité AADL"
            className="w-full h-full object-cover opacity-25"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900/90 to-transparent" />
        </div>

        <div className="relative z-10 p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-emerald-400 mb-2">
              <span className="bg-emerald-950/80 border border-emerald-800/80 px-2 py-0.5 rounded text-emerald-300">
                {data.building.gestImmoAgency}
              </span>
              <span className="text-slate-400">·</span>
              <span className="text-slate-300">{data.building.wilaya}</span>
              <span className="text-slate-400">·</span>
              <span className="text-slate-300">{data.building.ilot}</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-2">
              {data.building.buildingNumber} — {data.building.residenceName}
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              {t('housingSummary')} R+{data.building.totalFloors} · {totalApartments} ({data.apartments.filter((a) => a.type === 'F3').length} F3, {data.apartments.filter((a) => a.type === 'F4').length} F4) · {totalElevators} {t('cabins')}.
            </p>

            <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-slate-300">
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <span>{t('syndic')} : <strong>{data.building.syndicPresident}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span>{t('phoneShort')} : <strong dir="ltr">{data.building.syndicPhone}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-slate-400">{t('doorCode')} :</span>
                <span className="font-mono bg-slate-800/90 px-1.5 py-0.5 rounded border border-slate-700 text-amber-300">
                  {data.building.doorCode}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-row lg:flex-col gap-2 shrink-0">
            {canManageFinance(role) && (
              <button
                onClick={onOpenNewPayment}
                className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{t('collectCash')}</span>
              </button>
            )}
            {canManageMaintenance(role) && (
              <button
                onClick={() => onNavigateTab('incidents')}
                className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-medium text-slate-200 bg-slate-800/90 hover:bg-slate-700 rounded-xl border border-slate-700 transition-colors cursor-pointer"
              >
                <Wrench className="w-4 h-4 text-amber-400" />
                <span>{t('reportIssue')}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4 Core KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-medium">{t('collectionOf')} {formatMonthName(currentMonth, lang)}</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
              {collectionRate}%
            </span>
          </div>
          <span className="text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-white tabular-nums">
            {formatDZD(currentMonthCollected, lang)}
          </span>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {t('expectedOf')} {formatDZD(totalExpectedCurrentMonth, lang)} {t('expectedSuffix')} ({paidApartmentsCount}/{occupiedApartments} {t('paidShort')})
          </p>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full mt-3 overflow-hidden">
            <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, collectionRate)}%` }} />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-medium">{t('syndicCashBalance')}</span>
            <Wallet className="w-4 h-4 text-slate-400" />
          </div>
          <span className={`text-2xl font-bold font-mono tracking-tight tabular-nums ${netTreasuryBalance >= 0 ? 'text-slate-900 dark:text-white' : 'text-rose-600'}`}>
            {formatDZD(netTreasuryBalance, lang)}
          </span>
          <div className="flex items-center gap-3 text-xs mt-2 font-mono tabular-nums">
            <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
              <ArrowUpRight className="w-3.5 h-3.5" />
              {formatDZD(totalIncomes, lang)}
            </span>
            <span className="text-rose-600 dark:text-rose-400 flex items-center gap-0.5">
              <ArrowDownRight className="w-3.5 h-3.5" />
              {formatDZD(totalExpenses, lang)}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {t('includingReserve')} <strong className="text-sky-600 dark:text-sky-400 font-mono">{formatDZD(reserveBalance, lang)}</strong>
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-medium">{t('elevatorsLabel')} ({totalElevators} {t('cabins')})</span>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>
          <span className={`text-lg font-bold ${
            operationalElevators === totalElevators
              ? 'text-emerald-600 dark:text-emerald-400'
              : operationalElevators > 0
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-rose-600 dark:text-rose-400'
          }`}>
            {operationalElevators} / {totalElevators} {operationalElevators > 1 ? t('operationalPlural') : t('operationalLabel')}
          </span>
          <div className="mt-2 space-y-1.5 text-xs">
            {openElevatorIncidents.length === 0 ? (
              <p className="text-emerald-600 dark:text-emerald-400 font-medium">{t('allElevatorsNormal')}</p>
            ) : (
              openElevatorIncidents.slice(0, 2).map((inc) => (
                <div key={inc.id} className="flex items-center justify-between gap-2">
                  <span className="text-slate-600 dark:text-slate-300 truncate">{inc.location} :</span>
                  <span className="text-rose-600 dark:text-rose-400 font-medium shrink-0">
                    {inc.status === 'signale' ? t('reported') : t('outOfOrder')}
                  </span>
                </div>
              ))
            )}
          </div>
          <button
            onClick={() => onNavigateTab('incidents')}
            className="text-[11px] text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 font-medium mt-2 flex items-center gap-1 cursor-pointer"
          >
            <span>{openElevatorIncidents.length > 0 ? t('interventionDetails') : t('maintenanceLog')}</span>
            <ChevronRight className={`w-3 h-3 ${isRtl ? 'rotate-180' : ''}`} />
          </button>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-medium">{t('waterBoosterTitle')}</span>
            <Droplet className="w-4 h-4 text-sky-500" />
          </div>
          <span className={`text-lg font-bold ${
            openWaterIncidents.length > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
          }`}>
            {openWaterIncidents.length > 0 ? t('alertMaintenance') : t('regulatedPressure')}
          </span>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
            {openWaterIncidents.length > 0 ? openWaterIncidents[0].title : t('waterNormalDesc')}
          </p>
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">{t('activeWaterIssues')}</span>
            <span className={`font-mono font-medium ${openWaterIncidents.length > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {openWaterIncidents.length > 0 ? `${openWaterIncidents.length} ${t('inProgress')}` : t('noneOk')}
            </span>
          </div>
        </div>
      </div>

      {/* DataViz Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              {t('cashflowChartTitle')}
            </h3>
          </div>
          <CashflowBarChart points={cashflowPoints} />
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-3">
            <PieChart className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              {t('expenseDonutTitle')}
            </h3>
          </div>
          <DonutChart slices={expenseSlices} centerLabel={t('expenses')} />
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              {t('floorRecoveryTitle')}
            </h3>
            <button onClick={() => onNavigateTab('matrix')} className="text-[11px] font-semibold text-emerald-600 hover:underline cursor-pointer">
              {t('openFullView')} →
            </button>
          </div>
          <FloorCollectionChart floors={floorCollection} />
        </div>
      </div>

      {/* Operations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-amber-500" />
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  {t('ongoingIssuesTitle')} ({openIncidents.length})
                </h2>
              </div>
              <button
                onClick={() => onNavigateTab('incidents')}
                className="text-xs font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 flex items-center gap-1 cursor-pointer"
              >
                <span>{t('seeFullRegistry')}</span>
                <ChevronRight className={`w-3.5 h-3.5 ${isRtl ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {openIncidents.length === 0 ? (
              <div className="py-8 text-center text-slate-500 dark:text-slate-400 text-sm">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                {t('noIssuesMsg')}
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {openIncidents.map((incident) => (
                  <div key={incident.id} className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                          incident.priority === 'urgente'
                            ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50'
                            : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50'
                        }`}>
                          {incident.priority === 'urgente' ? t('urgent') : t('inProgress')}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">{incident.location}</span>
                      </div>
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{incident.title}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">{incident.description}</p>
                    </div>

                    <div className="sm:text-end shrink-0">
                      <span className="inline-block text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md">
                        {incident.assignedVendor || t('awaitingAssignment')}
                      </span>
                      <p className="text-[11px] text-slate-400 mt-1">
                        {t('reportedOn')} {formatDateFr(incident.reportedDate, lang)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {urgentPreventiveTasks.length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/60 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {t('preventiveAlertsTitle')} ({urgentPreventiveTasks.length})
                  </h3>
                </div>
                <button
                  onClick={() => onNavigateTab('incidents')}
                  className="text-xs font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 cursor-pointer"
                >
                  {t('preventiveCalendarLink')}
                </button>
              </div>
              <div className="space-y-2 text-xs">
                {urgentPreventiveTasks.slice(0, 3).map((task) => {
                  const isLate = getDueStatus(task.nextDueDate) === 'overdue';
                  return (
                    <div key={task.id} className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{task.title}</span>
                      <span className={`font-mono shrink-0 px-2 py-0.5 rounded text-[11px] font-bold ${
                        isLate
                          ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                          : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                      }`}>
                        {isLate ? t('overdue') : t('dueDate')} : {formatShortDate(task.nextDueDate, lang)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>{t('matrixBannerTitle')} {data.building.buildingNumber}</span>
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{t('matrixBannerDesc')}</p>
            </div>
            <button
              onClick={() => onNavigateTab('matrix')}
              className="px-4 py-2 text-xs font-semibold text-emerald-800 dark:text-emerald-200 bg-white dark:bg-slate-900 hover:bg-emerald-100 dark:hover:bg-slate-800 border border-emerald-300 dark:border-emerald-700 rounded-xl shadow-xs whitespace-nowrap transition-colors cursor-pointer"
            >
              {t('openFloorView')}
            </button>
          </div>
        </div>

        <div className="space-y-6">
          {activeNotice && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {t('residentsNotices')}
                  </span>
                </div>
                <button
                  onClick={() => onNavigateTab('notices')}
                  className="text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 font-medium cursor-pointer"
                >
                  {t('allNotices')}
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white mb-1">{activeNotice.title}</h4>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-4">{activeNotice.message}</p>
                <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-700 text-[11px] text-slate-400 flex items-center justify-between">
                  <span>{activeNotice.author}</span>
                  <span>{formatDateFr(activeNotice.date, lang)}</span>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {t('recentPayments')}
                </span>
              </div>
              <button
                onClick={() => onNavigateTab('fees')}
                className="text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 font-medium cursor-pointer"
              >
                {t('manageFees')}
              </button>
            </div>

            <div className="space-y-2.5">
              {recentPayments.map((p) => (
                <div
                  key={p.id}
                  className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors flex items-center justify-between gap-2"
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">{p.apartmentNumber}</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">({p.residentName})</span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      {p.receiptNumber} · {p.paymentMethod}
                    </div>
                  </div>

                  <div className="text-end">
                    <span className="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {formatDZD(p.amountDZD, lang)}
                    </span>
                    <button
                      onClick={() => onSelectReceipt(p)}
                      className="block text-[10px] text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 underline cursor-pointer mt-0.5"
                    >
                      {t('printReceipt')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
