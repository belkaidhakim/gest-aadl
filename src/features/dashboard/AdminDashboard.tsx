import React, { useMemo, useState } from 'react';
import {
  Building2,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  CheckCircle2,
  Wrench,
  Phone,
  Users,
  FileText,
  Droplet,
  Layers,
  ChevronRight,
  Megaphone,
  BarChart3,
  PieChart,
  Eye,
  EyeOff,
  Copy,
  Check,
  Printer,
  Send,
  Target,
  X,
  BellRing,
  MessageSquare,
} from 'lucide-react';
import { PaymentRecord } from '../../types';
import {
  formatDZD,
  formatDateFr,
  formatMonthName,
  formatShortDate,
  generateFeeReminderText,
  getCurrentMonthStr,
} from '../../utils/helpers';
import { useI18n } from '../../i18n';
import { useAppStore } from '../../stores/AppStore';
import { canManageFinance, canManageMaintenance } from '../../utils/permissions';
import { useToast } from '../../components/ui/ToastProvider';
import { CashflowBarChart, DonutChart, FloorCollectionChart } from '../../components/ui/Charts';
import { AppTab } from '../../app/useRoute';
import { isCarryOverTransaction, isInternalTransfer } from '../treasury/treasuryHelpers';
import residenceHeroImg from '../../assets/images/aadl_residence_complex_1794390110787.jpg';

interface AdminDashboardProps {
  onNavigateTab: (tab: AppTab) => void;
  onOpenNewPayment?: () => void;
  onSelectReceipt: (payment: PaymentRecord) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onNavigateTab,
  onSelectReceipt,
}) => {
  const { lang, isRtl, t } = useI18n();
  const { data, role, updateBuilding } = useAppStore();
  const toast = useToast();
  const currentMonth = getCurrentMonthStr();

  // Interactive UI state
  const [showDoorCode, setShowDoorCode] = useState(false);
  const [copiedDoorCode, setCopiedDoorCode] = useState(false);
  const [periodRange, setPeriodRange] = useState<'6m' | '1y' | 'all'>('6m');
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [reminderFilter, setReminderFilter] = useState<'unpaid_only' | 'all_due'>('all_due');
  const [isSummaryPdfOpen, setIsSummaryPdfOpen] = useState(false);
  const [isReserveTargetOpen, setIsReserveTargetOpen] = useState(false);
  const [reserveTargetInput, setReserveTargetInput] = useState<number>(data.building.reserveTargetDZD || 20000);
  const [savingTarget, setSavingTarget] = useState(false);

  const totalApartments = data.apartments.length;
  const occupiedAptsList = data.apartments.filter((a) => a.occupancy !== 'vacant');
  const occupiedApartments = occupiedAptsList.length;
  const standardFee = data.building.standardMonthlyFeeDZD;

  const currentMonthPayments = data.payments.filter((p) => p.month === currentMonth);
  const currentMonthCollected = currentMonthPayments.reduce((acc, p) => acc + p.amountDZD, 0);
  const paidByAptId = new Map<string, number>();
  currentMonthPayments.forEach((p) => {
    paidByAptId.set(p.apartmentId, (paidByAptId.get(p.apartmentId) || 0) + p.amountDZD);
  });
  const paidAptIds = new Set(currentMonthPayments.map((p) => p.apartmentId));
  const paidApartmentsCount = paidAptIds.size;
  const fullyPaidAptsCount = occupiedAptsList.filter(
    (a) => (paidByAptId.get(a.id) || 0) >= standardFee && (standardFee > 0 || paidByAptId.has(a.id))
  ).length;
  const totalExpectedCurrentMonth = occupiedApartments * standardFee;
  const collectionRate =
    totalExpectedCurrentMonth > 0
      ? Math.round((currentMonthCollected / totalExpectedCurrentMonth) * 100)
      : 0;

  const dueApartments = useMemo(() => {
    return occupiedAptsList
      .map((apt) => {
        const paidAmt = paidByAptId.get(apt.id) || 0;
        const remainingAmt = Math.max(0, standardFee - paidAmt);
        return { apt, paidAmt, remainingAmt };
      })
      .filter((item) => item.remainingAmt > 0)
      .sort((a, b) => a.paidAmt - b.paidAmt || a.apt.floor - b.apt.floor);
  }, [occupiedAptsList, paidByAptId, standardFee]);

  const unpaidZeroCount = dueApartments.filter((d) => d.paidAmt === 0).length;
  const totalRemainingDue = dueApartments.reduce((acc, d) => acc + d.remainingAmt, 0);

  // Treasury KPIs (distinguishing carry-over from current operating expenses)
  const externalTxs = useMemo(
    () => data.transactions.filter((tx) => !isInternalTransfer(tx)),
    [data.transactions]
  );

  const totalIncomes = useMemo(
    () => externalTxs.filter((tx) => tx.type === 'recette').reduce((acc, tx) => acc + tx.amountDZD, 0),
    [externalTxs]
  );

  const operatingExpenses = useMemo(
    () =>
      externalTxs
        .filter((tx) => tx.type === 'depense' && !isCarryOverTransaction(tx))
        .reduce((acc, tx) => acc + tx.amountDZD, 0),
    [externalTxs]
  );

  const carryOverNet = useMemo(
    () =>
      externalTxs
        .filter((tx) => isCarryOverTransaction(tx))
        .reduce((acc, tx) => acc + (tx.type === 'recette' ? tx.amountDZD : -tx.amountDZD), 0),
    [externalTxs]
  );

  const netTreasuryBalance =
    data.transactions
      .filter((tx) => tx.type === 'recette')
      .reduce((acc, tx) => acc + tx.amountDZD, 0) -
    data.transactions
      .filter((tx) => tx.type === 'depense')
      .reduce((acc, tx) => acc + tx.amountDZD, 0);

  const reserveBalance =
    data.transactions
      .filter((tx) => tx.fund === 'reserve' && tx.type === 'recette')
      .reduce((acc, tx) => acc + tx.amountDZD, 0) -
    data.transactions
      .filter((tx) => tx.fund === 'reserve' && tx.type === 'depense')
      .reduce((acc, tx) => acc + tx.amountDZD, 0);

  // Curative alerts
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

  // Cashflow aggregated by month (YYYY-MM) with cumulative running balance line & period range selector
  const cashflowPoints = useMemo(() => {
    const map = new Map<string, { income: number; expense: number }>();
    externalTxs.forEach((tx) => {
      const key = (tx.date || '').slice(0, 7) || '2026-01';
      const entry = map.get(key) || { income: 0, expense: 0 };
      if (tx.type === 'recette') entry.income += tx.amountDZD;
      else entry.expense += tx.amountDZD;
      map.set(key, entry);
    });
    const sorted = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    let running = 0;
    const withCumulative = sorted.map(([k, v]) => {
      running += v.income - v.expense;
      return { label: k.slice(2), income: v.income, expense: v.expense, cumulative: running };
    });
    if (periodRange === '6m') return withCumulative.slice(-6);
    if (periodRange === '1y') return withCumulative.slice(-12);
    return withCumulative;
  }, [externalTxs, periodRange]);

  // Operating expense breakdown for DonutChart (excluding prior-year carry-over)
  const expenseSlices = useMemo(() => {
    const map: Record<string, number> = {};
    externalTxs
      .filter((tx) => tx.type === 'depense' && !isCarryOverTransaction(tx))
      .forEach((tx) => {
        map[tx.category] = (map[tx.category] || 0) + tx.amountDZD;
      });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value }));
  }, [externalTxs]);

  // Floor recovery breakdown with floorNumber for click-through filtering
  const floorCollection = useMemo(() => {
    const maxFloor = Math.max(data.building.totalFloors || 0, ...data.apartments.map((a) => a.floor));
    const list: Array<{ label: string; floorNumber: number; paid: number; total: number }> = [];
    for (let f = 0; f <= maxFloor; f++) {
      const apts = data.apartments.filter((a) => a.floor === f && a.occupancy !== 'vacant');
      if (apts.length === 0) continue;
      const paid = apts.filter((a) => paidAptIds.has(a.id)).length;
      list.push({
        label: f === 0 ? t('rdcShort') : `É${f}`,
        floorNumber: f,
        paid,
        total: apts.length,
      });
    }
    return list;
  }, [data.apartments, data.building.totalFloors, paidAptIds, t]);

  const handleCopyDoorCode = () => {
    navigator.clipboard.writeText(data.building.doorCode || '');
    setCopiedDoorCode(true);
    toast.success(lang === 'ar' ? 'تم نسخ رمز الباب' : 'Digicode copié');
    setTimeout(() => setCopiedDoorCode(false), 1800);
  };

  const handleSelectFloor = (floorNumber: number, paid: number, total: number) => {
    try {
      sessionStorage.setItem(
        'gest_aadl_matrix_jump',
        JSON.stringify({ floor: floorNumber, status: paid < total ? 'due' : 'all' })
      );
    } catch {
      // ignore
    }
    onNavigateTab('matrix');
  };

  const handleCopyIndividualReminder = (apt: (typeof occupiedAptsList)[number], amountDue: number) => {
    const text = generateFeeReminderText(
      apt.resident.name,
      apt.number,
      data.building.buildingNumber,
      [currentMonth],
      amountDue,
      data.building.syndicPhone || '0661 60 19 87',
      data.building.syndicPresident,
      lang
    );
    navigator.clipboard.writeText(text);
    toast.success(`${t('messageCopied')} (${apt.number})`);
  };

  const buildWhatsAppLink = (phone: string, text: string): string | null => {
    const digits = (phone || '').replace(/\D/g, '');
    if (digits.length < 9) return null;
    const intl = digits.startsWith('0') ? `213${digits.slice(1)}` : digits;
    return `https://wa.me/${intl}?text=${encodeURIComponent(text)}`;
  };

  const buildManagementSummaryText = (): string => {
    const lines = [
      `📊 *BILAN DE GESTION — ${data.building.buildingNumber}* (${data.building.residenceName})`,
      `📅 ${formatMonthName(currentMonth, 'fr')} · Édité le ${formatShortDate(new Date().toISOString(), 'fr')}`,
      '',
      `💰 *Recouvrement* : ${formatDZD(currentMonthCollected, 'fr')} / ${formatDZD(totalExpectedCurrentMonth, 'fr')} (${collectionRate}%) — ${paidApartmentsCount}/${occupiedApartments} payés (${unpaidZeroCount} impayés)`,
      `🏦 *Trésorerie Nette* : ${formatDZD(netTreasuryBalance, 'fr')}`,
      `   • Recettes 2026 : +${formatDZD(totalIncomes, 'fr')}`,
      `   • Dépenses d'exploitation : -${formatDZD(operatingExpenses, 'fr')}`,
      ...(carryOverNet !== 0 ? [`   • Report exercice 2025 : ${formatDZD(carryOverNet, 'fr')}`] : []),
      `   • Fonds de réserve : ${formatDZD(reserveBalance, 'fr')}${data.building.reserveTargetDZD ? ` (Objectif : ${formatDZD(data.building.reserveTargetDZD, 'fr')})` : ''}`,
      '',
      `🔧 *Équipements* : Ascenseurs ${operationalElevators}/${totalElevators} opérationnels · Pannes ouvertes : ${openIncidents.length}`,
      '',
      `Syndic ${data.building.buildingNumber} — ${data.building.syndicPresident}`,
    ];
    return lines.join('\n');
  };

  const handleCopyGroupUnpaidList = () => {
    const lines = [
      `📋 *Point Cotisations ${formatMonthName(currentMonth, 'fr')} — ${data.building.buildingNumber}*`,
      `✅ ${paidApartmentsCount}/${occupiedApartments} logements ont contribué (${formatDZD(currentMonthCollected, 'fr')}).`,
      `⏳ Reste à recouvrer : ${formatDZD(totalRemainingDue, 'fr')}`,
      '',
      ...dueApartments.map(
        (d) =>
          `• ${d.apt.number} (${d.apt.resident.name}) : ${
            d.paidAmt === 0
              ? `Impayé (${formatDZD(d.remainingAmt, 'fr')})`
              : `Partiel (Reste ${formatDZD(d.remainingAmt, 'fr')})`
          }`
      ),
      '',
      `Merci de régulariser auprès de ${data.building.syndicPresident}.`,
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    toast.success(lang === 'ar' ? 'تم نسخ القائمة الجماعية' : 'Liste groupée copiée pour WhatsApp');
  };

  const handleSaveReserveTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reserveTargetInput < 0 || savingTarget) return;
    setSavingTarget(true);
    try {
      await updateBuilding({
        ...data.building,
        reserveTargetDZD: Number(reserveTargetInput),
      });
      setIsReserveTargetOpen(false);
    } finally {
      setSavingTarget(false);
    }
  };

  const visibleReminderRows =
    reminderFilter === 'unpaid_only'
      ? dueApartments.filter((d) => d.paidAmt === 0)
      : dueApartments;

  const suggested10Pct = Math.max(15000, Math.round((totalIncomes || totalExpectedCurrentMonth || 150000) * 0.1));

  return (
    <>
      <div className={`space-y-5 ${isSummaryPdfOpen ? 'no-print' : ''}`}>
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
                {t('housingSummary')} R+{data.building.totalFloors} · {totalApartments}{' '}
                {lang === 'ar' ? 'شقة' : 'logements'} ({data.apartments.filter((a) => a.type === 'F3').length} F3,{' '}
                {data.apartments.filter((a) => a.type === 'F4').length} F4) · {totalElevators} {t('cabins')}.
              </p>

              <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-slate-300">
                <div className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    {t('syndic')} : <strong>{data.building.syndicPresident}</strong>
                  </span>
                </div>
                {data.building.syndicPhone && data.building.syndicPhone !== '-' && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      {t('phoneShort')} : <strong dir="ltr">{data.building.syndicPhone}</strong>
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-slate-400">{t('doorCode')} :</span>
                  <span className="font-mono bg-slate-800/90 px-2 py-0.5 rounded border border-slate-700 text-amber-300 tracking-wider">
                    {showDoorCode ? data.building.doorCode : '•••••'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowDoorCode((prev) => !prev)}
                    title={
                      showDoorCode
                        ? lang === 'ar'
                          ? 'إخفاء الرمز'
                          : 'Masquer le digicode'
                        : lang === 'ar'
                        ? 'إظهار الرمز'
                        : 'Révéler le digicode'
                    }
                    className="p-1 rounded bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  >
                    {showDoorCode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyDoorCode}
                    title={lang === 'ar' ? 'نسخ رمز الباب' : 'Copier le digicode'}
                    className="p-1 rounded bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  >
                    {copiedDoorCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-row lg:flex-col gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsSummaryPdfOpen(true)}
                className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition-colors cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>{lang === 'ar' ? 'تصدير التقرير PDF' : 'Exporter Bilan PDF'}</span>
              </button>
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
          {/* Card 1: Collection + Relancer */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                <span className="text-xs font-medium">
                  {t('collectionOf')} {formatMonthName(currentMonth, lang)}
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                  {collectionRate}%
                </span>
              </div>
              <span className="text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-white tabular-nums">
                {formatDZD(currentMonthCollected, lang)}
              </span>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {t('expectedOf')} {formatDZD(totalExpectedCurrentMonth, lang)} {t('expectedSuffix')} (
                {paidApartmentsCount}/{occupiedApartments} {t('paidShort')}
                {paidApartmentsCount > fullyPaidAptsCount
                  ? ` · ${fullyPaidAptsCount} ${lang === 'ar' ? 'كامل' : 'soldés'}`
                  : ''}
                )
              </p>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full mt-3 overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, collectionRate)}%` }}
                />
              </div>
            </div>

            {dueApartments.length > 0 && canManageFinance(role) && (
              <button
                type="button"
                onClick={() => setIsReminderModalOpen(true)}
                className="mt-3 w-full inline-flex items-center justify-center gap-1.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/45 hover:bg-amber-100 dark:hover:bg-amber-950/70 border border-amber-200 dark:border-amber-800/80 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <BellRing className="w-3.5 h-3.5" />
                <span>
                  {lang === 'ar'
                    ? `تذكير المتأخرين (${dueApartments.length})`
                    : `Relancer les impayés (${unpaidZeroCount > 0 ? unpaidZeroCount : dueApartments.length})`}
                </span>
              </button>
            )}
          </div>

          {/* Card 2: Cash Balance + Clean Single-line Flows + Reserve Target */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                <span className="text-xs font-medium">{t('syndicCashBalance')}</span>
                <Wallet className="w-4 h-4 text-slate-400" />
              </div>
              <span
                className={`text-2xl font-bold font-mono tracking-tight tabular-nums ${
                  netTreasuryBalance >= 0 ? 'text-slate-900 dark:text-white' : 'text-rose-600'
                }`}
              >
                {formatDZD(netTreasuryBalance, lang)}
              </span>

              <div className="flex items-center justify-between gap-2 text-xs mt-2 font-mono tabular-nums">
                <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 whitespace-nowrap">
                  <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                  +{formatDZD(totalIncomes, lang)}
                </span>
                <span className="text-rose-600 dark:text-rose-400 flex items-center gap-0.5 whitespace-nowrap">
                  <ArrowDownRight className="w-3.5 h-3.5 shrink-0" />
                  -{formatDZD(operatingExpenses, lang)}
                </span>
              </div>

              {carryOverNet !== 0 && (
                <p className="text-[11px] font-mono font-medium text-amber-700 dark:text-amber-300 mt-1 whitespace-nowrap">
                  {lang === 'ar' ? 'ترحيل 2025 :' : 'Report 2025 :'} {formatDZD(carryOverNet, lang)}
                </p>
              )}
            </div>

            <div className="pt-2 mt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-1 text-[11px] text-slate-400">
              <span className="whitespace-nowrap">
                {t('includingReserve')}{' '}
                <strong className="text-sky-600 dark:text-sky-400 font-mono">
                  {formatDZD(reserveBalance, lang)}
                </strong>
                {data.building.reserveTargetDZD ? (
                  <span className="text-[10px]"> / {formatDZD(data.building.reserveTargetDZD, lang)}</span>
                ) : null}
              </span>
              {canManageFinance(role) && (
                <button
                  type="button"
                  onClick={() => {
                    if (role === 'president') {
                      setReserveTargetInput(data.building.reserveTargetDZD || suggested10Pct);
                      setIsReserveTargetOpen(true);
                    } else {
                      onNavigateTab('treasury');
                    }
                  }}
                  className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 hover:underline inline-flex items-center gap-0.5 cursor-pointer whitespace-nowrap"
                >
                  <Target className="w-3 h-3" />
                  <span>{lang === 'ar' ? 'تحديد هدف' : 'Définir un objectif'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Card 3: Elevators */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                <span className="text-xs font-medium">
                  {t('elevatorsLabel')} ({totalElevators} {t('cabins')})
                </span>
                <Layers className="w-4 h-4 text-slate-400" />
              </div>
              <span
                className={`text-lg font-bold ${
                  operationalElevators === totalElevators
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : operationalElevators > 0
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {operationalElevators} / {totalElevators}{' '}
                {operationalElevators > 1 ? t('operationalPlural') : t('operationalLabel')}
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
            </div>
            <button
              onClick={() => onNavigateTab('incidents')}
              className="text-[11px] text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 font-medium mt-2 flex items-center gap-1 cursor-pointer"
            >
              <span>{openElevatorIncidents.length > 0 ? t('interventionDetails') : t('maintenanceLog')}</span>
              <ChevronRight className={`w-3 h-3 ${isRtl ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* Card 4: Water Booster (No awkward line-clamp truncation) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                <span className="text-xs font-medium">{t('waterBoosterTitle')}</span>
                <Droplet className="w-4 h-4 text-sky-500" />
              </div>
              <span
                className={`text-lg font-bold ${
                  openWaterIncidents.length > 0
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {openWaterIncidents.length > 0 ? t('alertMaintenance') : t('regulatedPressure')}
              </span>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                {openWaterIncidents.length > 0 ? openWaterIncidents[0].title : t('waterNormalDesc')}
              </p>
            </div>
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
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  {t('cashflowChartTitle')}
                </h3>
              </div>
              <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 text-[10px] font-semibold">
                {[
                  { id: '6m' as const, label: lang === 'ar' ? '6 أشهر' : '6 mois' },
                  { id: '1y' as const, label: lang === 'ar' ? 'سنة' : '1 an' },
                  { id: 'all' as const, label: lang === 'ar' ? 'الكل' : 'Tout' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPeriodRange(opt.id)}
                    className={`px-2 py-0.5 rounded-md cursor-pointer transition-colors ${
                      periodRange === opt.id
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
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
            <div className="flex items-center justify-between mb-3 gap-2">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  {t('floorRecoveryTitle')}
                </h3>
                <span className="text-[10px] text-slate-400">
                  {lang === 'ar' ? 'انقر على طابق لعرض الشقق المتبقية' : 'Cliquez sur un étage pour filtrer'}
                </span>
              </div>
              <button
                onClick={() => onNavigateTab('matrix')}
                className="text-[11px] font-semibold text-emerald-600 hover:underline cursor-pointer shrink-0"
              >
                {t('openFullView')} →
              </button>
            </div>
            <FloorCollectionChart floors={floorCollection} onSelectFloor={handleSelectFloor} />
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
                    <div
                      key={incident.id}
                      className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                              incident.priority === 'urgente'
                                ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50'
                                : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50'
                            }`}
                          >
                            {incident.priority === 'urgente' ? t('urgent') : t('inProgress')}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">{incident.location}</span>
                        </div>
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{incident.title}</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">{incident.description}</p>
                      </div>

                      <div className="sm:text-end shrink-0 space-y-1.5">
                        <div className="flex sm:justify-end items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              try {
                                sessionStorage.setItem('gest_aadl_open_chat_inc', incident.id);
                              } catch {
                                // ignore
                              }
                              onNavigateTab('incidents');
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 cursor-pointer"
                          >
                            <MessageSquare className="w-3 h-3" />
                            <span>Chat ({(incident.messages || []).length})</span>
                          </button>
                          <span className="inline-block text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md">
                            {incident.assignedVendor || t('awaitingAssignment')}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          {t('reportedOn')} {formatDateFr(incident.reportedDate, lang)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>
                    {t('matrixBannerTitle')} {data.building.buildingNumber}
                  </span>
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
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-4">
                    {activeNotice.message}
                  </p>
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
                      <span className="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400 tabular-nums whitespace-nowrap">
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

      {/* Modal 1: Unpaid / Partial Fee Reminders */}
      {isReminderModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 no-print">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[88vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <BellRing className="w-5 h-5 text-amber-500" />
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {lang === 'ar'
                      ? 'تذكير السكان بالمساهمات غير المسددة'
                      : `Relancer les impayés — ${formatMonthName(currentMonth, lang)}`}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {unpaidZeroCount} impayé{unpaidZeroCount > 1 ? 's' : ''} (0 DZD) ·{' '}
                    {dueApartments.length - unpaidZeroCount} partiel(s) · Total à recouvrer :{' '}
                    <strong className="font-mono text-rose-600 dark:text-rose-400">
                      {formatDZD(totalRemainingDue, lang)}
                    </strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsReminderModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
              <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
                <button
                  type="button"
                  onClick={() => setReminderFilter('all_due')}
                  className={`px-3 py-1 rounded-lg font-semibold cursor-pointer ${
                    reminderFilter === 'all_due'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-500'
                  }`}
                >
                  {lang === 'ar' ? `الكل (${dueApartments.length})` : `Tous à recouvrer (${dueApartments.length})`}
                </button>
                <button
                  type="button"
                  onClick={() => setReminderFilter('unpaid_only')}
                  className={`px-3 py-1 rounded-lg font-semibold cursor-pointer ${
                    reminderFilter === 'unpaid_only'
                      ? 'bg-rose-600 text-white shadow-2xs'
                      : 'text-slate-500'
                  }`}
                >
                  {lang === 'ar' ? `غير مسدد كلياً (${unpaidZeroCount})` : `Impayés 0 DZD (${unpaidZeroCount})`}
                </button>
              </div>

              <button
                type="button"
                onClick={handleCopyGroupUnpaidList}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-semibold hover:bg-emerald-100 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'نسخ القائمة للمجموعة' : 'Copier liste groupe'}</span>
              </button>
            </div>

            <div className="overflow-y-auto grow divide-y divide-slate-100 dark:divide-slate-800 pr-1">
              {visibleReminderRows.map(({ apt, paidAmt, remainingAmt }) => {
                const msg = generateFeeReminderText(
                  apt.resident.name,
                  apt.number,
                  data.building.buildingNumber,
                  [currentMonth],
                  remainingAmt,
                  data.building.syndicPhone || '0661 60 19 87',
                  data.building.syndicPresident,
                  lang
                );
                const waUrl = buildWhatsAppLink(apt.resident.phone, msg);

                return (
                  <div
                    key={apt.id}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 dark:text-white">{apt.number}</span>
                        <span className="text-[11px] text-slate-400">
                          ({apt.floor === 0 ? t('rdcShort') : `${t('floor')} ${apt.floor}`})
                        </span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{apt.resident.name}</span>
                        {paidAmt === 0 ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                            {t('unpaidShort')}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            Partiel · {formatDZD(paidAmt, lang)} payé
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
                        Tél : {apt.resident.phone && apt.resident.phone !== '-' ? apt.resident.phone : 'Non renseigné'} ·{' '}
                        <strong className="text-rose-600 dark:text-rose-400">
                          Reste : {formatDZD(remainingAmt, lang)}
                        </strong>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleCopyIndividualReminder(apt, remainingAmt)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>{lang === 'ar' ? 'نسخ الرسالة' : 'Copier rappel'}</span>
                      </button>
                      {waUrl && (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>WhatsApp</span>
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs shrink-0">
              <button
                type="button"
                onClick={() => setIsReminderModalOpen(false)}
                className="px-4 py-2 text-slate-500 cursor-pointer"
              >
                {t('close')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsReminderModalOpen(false);
                  onNavigateTab('fees');
                }}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer"
              >
                {lang === 'ar' ? 'فتح صفحة الاشتراكات' : 'Ouvrir Cotisations & Reçus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Reserve Fund Target */}
      {isReserveTargetOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 no-print">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-sky-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {lang === 'ar' ? 'هدف صندوق الاحتياط للأشغال' : 'Objectif du Fonds de Réserve'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsReserveTargetOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveReserveTarget} className="space-y-4 text-xs">
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                {lang === 'ar'
                  ? 'حدد هدفاً لصندوق الاحتياط لتغطية الأعطال الكبرى للمصاعد ومضخات المياه (يُنصح بـ 10٪ على الأقل من المداخيل السنوية).'
                  : 'Définissez une cible d’épargne de copropriété pour anticiper les grosses réparations d’ascenseurs ou de surpresseur (recommandé : 10 % des recettes annuelles).'}
              </p>

              <div className="flex flex-wrap gap-1.5">
                {[suggested10Pct, 50000, 100000, 150000].map((preset, idx) => (
                  <button
                    key={`${preset}-${idx}`}
                    type="button"
                    onClick={() => setReserveTargetInput(preset)}
                    className={`px-2.5 py-1 rounded-lg font-mono font-semibold cursor-pointer border ${
                      reserveTargetInput === preset
                        ? 'bg-sky-600 text-white border-sky-600'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {idx === 0 ? `10 % (${formatDZD(preset, lang)})` : formatDZD(preset, lang)}
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  {lang === 'ar' ? 'المبلغ المستهدف (دج)' : 'Montant objectif (DZD)'}
                </label>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={reserveTargetInput}
                  onChange={(e) => setReserveTargetInput(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold text-sm"
                  required
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsReserveTargetOpen(false);
                    onNavigateTab('treasury');
                  }}
                  className="text-sky-600 dark:text-sky-400 font-semibold hover:underline cursor-pointer"
                >
                  {lang === 'ar' ? 'الذهاب إلى الخزينة →' : 'Ouvrir Caisse & Budget →'}
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsReserveTargetOpen(false)}
                    className="px-3 py-2 text-slate-500 cursor-pointer"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={savingTarget}
                    className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold cursor-pointer disabled:opacity-50"
                  >
                    {t('save')}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: One-click Management Summary PDF / Hall Export */}
      {isSummaryPdfOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto print:static print:bg-transparent print:p-0 print:block">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-5 my-8 print:border-none print:shadow-none print:p-0 print:my-0 print:max-w-none">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800 no-print">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {lang === 'ar' ? 'ملخص التسيير المالي والتقني (PDF)' : 'Bilan de Gestion Synthétique (PDF / WhatsApp)'}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(buildManagementSummaryText());
                    toast.success(lang === 'ar' ? 'تم نسخ التقرير لواتساب' : 'Synthèse copiée pour WhatsApp');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 rounded-lg border border-emerald-200 dark:border-emerald-800 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'نسخ نص واتساب' : 'Copier WhatsApp'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>{t('printA4')} / PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsSummaryPdfOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 sm:p-8 bg-white text-slate-900 border border-slate-300 rounded-xl print-card print:border-none print:p-0 space-y-5 text-xs">
              <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-start gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{t('republicHeader')}</p>
                  <h2 className="text-lg font-black text-slate-900 mt-0.5">{t('syndicOfficialHeader')}</h2>
                  <p className="text-sm font-bold text-slate-700">
                    {data.building.buildingNumber} — {data.building.residenceName}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {data.building.wilaya} · {data.building.gestImmoAgency}
                  </p>
                </div>
                <div className="text-end font-mono text-[11px] text-slate-600">
                  <div className="font-bold text-slate-900">{formatMonthName(currentMonth, lang)}</div>
                  <div>{formatDateFr(new Date().toISOString(), lang)}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded border border-slate-300 bg-slate-50">
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">Recouvrement</span>
                  <strong className="text-base font-mono font-black text-emerald-700 block mt-0.5">
                    {formatDZD(currentMonthCollected, 'fr')} ({collectionRate}%)
                  </strong>
                  <span className="text-[11px] text-slate-600">
                    {paidApartmentsCount}/{occupiedApartments} payés · {unpaidZeroCount} impayés
                  </span>
                </div>
                <div className="p-3.5 rounded border border-slate-300 bg-slate-50">
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">Solde Caisse Net</span>
                  <strong className="text-base font-mono font-black text-slate-900 block mt-0.5">
                    {formatDZD(netTreasuryBalance, 'fr')}
                  </strong>
                  <span className="text-[11px] text-slate-600 block">
                    Recettes +{formatDZD(totalIncomes, 'fr')} · Dépenses -{formatDZD(operatingExpenses, 'fr')}
                  </span>
                  {carryOverNet !== 0 && (
                    <span className="text-[10px] text-amber-800 font-semibold block">
                      Report 2025 : {formatDZD(carryOverNet, 'fr')}
                    </span>
                  )}
                </div>
                <div className="p-3.5 rounded border border-slate-300 bg-slate-50">
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">État Technique</span>
                  <strong className="text-base font-mono font-black text-slate-900 block mt-0.5">
                    Asc. {operationalElevators}/{totalElevators} OK
                  </strong>
                  <span className="text-[11px] text-slate-600">
                    {openIncidents.length} panne(s) en cours · Surpresseur {openWaterIncidents.length > 0 ? 'en alerte' : 'OK'}
                  </span>
                </div>
              </div>

              {dueApartments.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-bold uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-1">
                    Logements restant à régulariser ({dueApartments.length}) — Total dû :{' '}
                    {formatDZD(totalRemainingDue, 'fr')}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
                    {dueApartments.map(({ apt, paidAmt, remainingAmt }) => (
                      <div
                        key={apt.id}
                        className="flex items-center justify-between px-2.5 py-1.5 rounded border border-slate-200 bg-slate-50"
                      >
                        <span>
                          <strong>{apt.number}</strong> ({apt.resident.name})
                        </span>
                        <span className="font-mono font-bold text-rose-700 whitespace-nowrap">
                          {paidAmt === 0
                            ? formatDZD(remainingAmt, 'fr')
                            : `Reste ${formatDZD(remainingAmt, 'fr')}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
                <span>Document affiché dans le hall du {data.building.buildingNumber} pour transparence de gestion.</span>
                <span className="font-bold text-slate-800">{data.building.syndicPresident}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
