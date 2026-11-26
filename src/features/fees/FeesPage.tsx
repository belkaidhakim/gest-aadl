import React, { useState } from 'react';
import {
  FileText,
  CheckCircle2,
  XCircle,
  Plus,
  Search,
  Printer,
  Download,
  Copy,
  Calendar,
  History,
  AlertCircle,
  Clock,
  Pencil,
  Trash2,
  Award,
  CreditCard,
  Sparkles,
  Check,
  X,
} from 'lucide-react';
import {
  Apartment,
  PaymentMethod,
  PaymentRecord,
  SpecialCall,
  SpecialCallContribution,
  TransactionFund,
} from '../../types';
import {
  formatDZD,
  formatDateFr,
  formatMonthName,
  generateFeeReminderText,
  getAvailableFeePeriods,
  getCurrentMonthStr,
  getDynamicYears,
} from '../../utils/helpers';
import { useI18n } from '../../i18n';
import { useAppStore } from '../../stores/AppStore';
import { canManageFinance } from '../../utils/permissions';
import { useToast } from '../../components/ui/ToastProvider';
import { useConfirm } from '../../components/ui/ConfirmDialog';

interface FeesPageProps {
  onOpenNewPayment: (defaultApt?: Apartment) => void;
  onEditPayment: (payment: PaymentRecord) => void;
  onDeletePayment: (payment: PaymentRecord) => void;
  onViewReceipt: (payment: PaymentRecord) => void;
  onOpenQuitus?: (apt: Apartment) => void;
  onPrintUnpaidNotice: (month: string, unpaidApts: Apartment[]) => void;
}

export const FeesPage: React.FC<FeesPageProps> = ({
  onOpenNewPayment,
  onEditPayment,
  onDeletePayment,
  onViewReceipt,
  onOpenQuitus,
  onPrintUnpaidNotice,
}) => {
  const { lang, t } = useI18n();
  const {
    data,
    role,
    user,
    approvePaymentDeclaration,
    rejectPaymentDeclaration,
    addSpecialCall,
    updateSpecialCall,
    deleteSpecialCall,
    recordSpecialCallContribution,
    deleteSpecialCallContribution,
  } = useAppStore();
  const toast = useToast();
  const { confirm } = useConfirm();
  const canCollect = canManageFinance(role);

  const [viewMode, setViewMode] = useState<'period' | 'multi_year' | 'special_calls'>('period');
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthStr());
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'partial' | 'unpaid'>('all');
  const [floorFilter, setFloorFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [proofLightboxUrl, setProofLightboxUrl] = useState<string | null>(null);

  // Special Call Modal & Quick Collect State
  const [isSpecialCallModal, setIsSpecialCallModal] = useState(false);
  const [editingCall, setEditingCall] = useState<SpecialCall | null>(null);
  const [callForm, setCallForm] = useState<{
    title: string;
    description: string;
    amountPerApartmentDZD: number;
    dueDate: string;
    fund: TransactionFund;
  }>({
    title: '',
    description: '',
    amountPerApartmentDZD: 5000,
    dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    fund: 'reserve',
  });
  const [collectCallId, setCollectCallId] = useState<string | null>(null);
  const [collectAptId, setCollectAptId] = useState<string>(data.apartments[0]?.id || '');
  const [collectAmount, setCollectAmount] = useState<number>(5000);
  const [collectMethod, setCollectMethod] = useState<PaymentMethod>('Espèces');

  const availablePeriods = getAvailableFeePeriods(
    data.building.feeFrequency || 'annuel',
    data.payments,
    data.transactions
  );
  const dynamicYears = getDynamicYears(data.payments, data.transactions);
  const currentYrNum = new Date().getFullYear();
  const arrearsYears = dynamicYears.filter((y) => Number(y) >= 2025 && Number(y) <= currentYrNum);

  const pendingDecls = (data.paymentDeclarations || []).filter((d) => d.status === 'pending');
  const specialCalls = data.specialCalls || [];

  const monthPayments = data.payments.filter((p) => p.month === selectedMonth);
  const paymentsByAptId = new Map<string, PaymentRecord[]>();
  monthPayments.forEach((p) => {
    const existing = paymentsByAptId.get(p.apartmentId) || [];
    paymentsByAptId.set(p.apartmentId, [...existing, p]);
  });

  const getAptPeriodPaid = (aptId: string): number =>
    (paymentsByAptId.get(aptId) || []).reduce((sum, p) => sum + p.amountDZD, 0);

  const standardFee = data.building.standardMonthlyFeeDZD;
  const occupiedApts = data.apartments.filter((a) => a.occupancy !== 'vacant');
  const fullyPaidApts = occupiedApts.filter(
    (a) => getAptPeriodPaid(a.id) >= standardFee && (standardFee > 0 || paymentsByAptId.has(a.id))
  );
  const partialApts = occupiedApts.filter((a) => {
    const paidAmt = getAptPeriodPaid(a.id);
    return paidAmt > 0 && standardFee > 0 && paidAmt < standardFee;
  });
  const unpaidApartments = occupiedApts.filter((a) => getAptPeriodPaid(a.id) === 0);

  const totalExpected = occupiedApts.length * standardFee;
  const totalCollected = monthPayments.reduce((acc, p) => acc + p.amountDZD, 0);
  const totalRemaining = Math.max(0, totalExpected - totalCollected);
  const collectionRate = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0;
  const maxFloor = Math.max(data.building.totalFloors || 0, ...data.apartments.map((a) => a.floor));

  const getAptYearPaid = (aptId: string, year: string): number =>
    data.payments
      .filter((p) => p.apartmentId === aptId && (p.month === year || p.month.startsWith(`${year}-`)))
      .reduce((sum, p) => sum + p.amountDZD, 0);

  const getAptYearRemaining = (apt: Apartment, year: string): number => {
    if (apt.occupancy === 'vacant') return 0;
    return Math.max(0, standardFee - getAptYearPaid(apt.id, year));
  };

  const getAptUnpaidYears = (apt: Apartment): string[] => {
    if (apt.occupancy === 'vacant') return [];
    return arrearsYears.filter((y) => getAptYearPaid(apt.id, y) < standardFee);
  };

  const getAptTotalArrears = (apt: Apartment): number => {
    if (apt.occupancy === 'vacant') return 0;
    return arrearsYears.reduce((acc, y) => acc + getAptYearRemaining(apt, y), 0);
  };

  const totalCumulativeArrears = occupiedApts.reduce((sum, apt) => sum + getAptTotalArrears(apt), 0);

  const filteredApartments = data.apartments.filter((apt) => {
    if (viewMode === 'period') {
      const paidAmt = getAptPeriodPaid(apt.id);
      const isFullyPaid = paidAmt >= standardFee && (standardFee > 0 || paymentsByAptId.has(apt.id));
      const isPartial = paidAmt > 0 && standardFee > 0 && paidAmt < standardFee;
      const isUnpaid = paidAmt === 0 && apt.occupancy !== 'vacant';
      if (statusFilter === 'paid' && !isFullyPaid) return false;
      if (statusFilter === 'partial' && !isPartial) return false;
      if (statusFilter === 'unpaid' && !isUnpaid) return false;
    } else if (viewMode === 'multi_year') {
      const unpaidYears = getAptUnpaidYears(apt);
      const hasPartial = arrearsYears.some((y) => {
        const p = getAptYearPaid(apt.id, y);
        return p > 0 && p < standardFee;
      });
      if (statusFilter === 'paid' && (unpaidYears.length > 0 || apt.occupancy === 'vacant')) return false;
      if (statusFilter === 'partial' && !hasPartial) return false;
      if (statusFilter === 'unpaid' && unpaidYears.length === 0) return false;
    }

    if (floorFilter !== 'all' && apt.floor.toString() !== floorFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNum = apt.number.toLowerCase().includes(q);
      const matchName = apt.resident.name.toLowerCase().includes(q);
      const matchFolder = (apt.resident.aadlFolderNumber || '').toLowerCase().includes(q);
      if (!matchNum && !matchName && !matchFolder) return false;
    }
    return true;
  });

  const handleCopyReminder = (apt: Apartment, periods: string[], amountDZD: number) => {
    const text = generateFeeReminderText(
      apt.resident.name,
      apt.number,
      data.building.buildingNumber,
      periods,
      amountDZD,
      data.building.syndicPhone,
      data.building.syndicPresident,
      lang
    );
    navigator.clipboard.writeText(text);
    toast.success(t('messageCopied'));
  };

  const handleExportCSV = () => {
    const headers = [
      'Numero_Appartement',
      'Etage',
      'Type',
      'Resident',
      'Date_Naissance',
      'Telephone',
      'Dossier_AADL',
      'Statut',
      'Montant_DZD',
      'Numero_Quittance',
      'Date_Paiement',
      'Mode',
    ];
    const rows = data.apartments.map((apt) => {
      const aptPayments = paymentsByAptId.get(apt.id) || [];
      const latestPayment = aptPayments[0];
      const totalAptAmount = aptPayments.reduce((sum, p) => sum + p.amountDZD, 0);
      return [
        apt.number,
        apt.floor,
        apt.type,
        `"${apt.resident.name}"`,
        `"${apt.resident.birthDate || ''}"`,
        `"${apt.resident.phone}"`,
        `"${apt.resident.aadlFolderNumber || ''}"`,
        apt.occupancy === 'vacant'
          ? 'Non habité'
          : totalAptAmount >= standardFee && standardFee > 0
          ? 'Payé'
          : totalAptAmount > 0
          ? 'Partiel'
          : 'Impayé',
        latestPayment ? totalAptAmount : 0,
        latestPayment ? aptPayments.map((p) => p.receiptNumber).join(' / ') : '',
        latestPayment ? latestPayment.paymentDate.slice(0, 10) : '',
        latestPayment ? latestPayment.paymentMethod : '',
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `cotisations_${data.building.buildingNumber}_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleSaveSpecialCall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!callForm.title.trim() || callForm.amountPerApartmentDZD <= 0) return;
    if (editingCall) {
      await updateSpecialCall({
        ...editingCall,
        title: callForm.title.trim(),
        description: callForm.description.trim() || undefined,
        amountPerApartmentDZD: Number(callForm.amountPerApartmentDZD),
        dueDate: callForm.dueDate,
        fund: callForm.fund,
      });
    } else {
      await addSpecialCall({
        id: `spcall-${Date.now()}`,
        title: callForm.title.trim(),
        description: callForm.description.trim() || undefined,
        amountPerApartmentDZD: Number(callForm.amountPerApartmentDZD),
        dueDate: callForm.dueDate,
        fund: callForm.fund,
        status: 'active',
        createdAt: new Date().toISOString().slice(0, 10),
        contributions: [],
      });
    }
    setIsSpecialCallModal(false);
    setEditingCall(null);
  };

  return (
    <div className="space-y-6">
      {/* Pending BaridiMob / CCP Declarations Validation Banner */}
      {canCollect && pendingDecls.length > 0 && (
        <div className="bg-sky-50/90 dark:bg-sky-950/35 border border-sky-300 dark:border-sky-800 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-sky-600" />
              <h3 className="text-sm font-extrabold text-sky-950 dark:text-sky-100">
                {lang === 'ar'
                  ? `تحويلات بريدي موب / CCP بانتظار المصادقة (${pendingDecls.length})`
                  : `Virements BaridiMob / CCP à valider (${pendingDecls.length})`}
              </h3>
            </div>
            <span className="text-[11px] font-semibold text-sky-700 dark:text-sky-300">
              {lang === 'ar'
                ? 'المصادقة تُصدر الوصل وتُدرج المبلغ في الخزينة تلقائياً'
                : 'La validation génère la quittance et crédite la caisse'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pendingDecls.map((decl) => (
              <div
                key={decl.id}
                className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-sky-200 dark:border-sky-800/80 flex flex-col justify-between gap-3 text-xs"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="font-bold text-slate-900 dark:text-white text-sm">
                      {decl.apartmentNumber} — {decl.residentName}
                    </div>
                    <div className="text-slate-600 dark:text-slate-300">
                      <span className="font-semibold text-sky-700 dark:text-sky-300">
                        {decl.paymentMethod}
                      </span>{' '}
                      · {decl.specialCallTitle || formatMonthName(decl.month, lang)}
                      {decl.reference ? ` · Réf: ${decl.reference}` : ''}
                    </div>
                    {decl.notes && <div className="text-[11px] text-slate-500 italic">« {decl.notes} »</div>}
                  </div>
                  <div className="text-end shrink-0">
                    <span className="text-base font-black font-mono text-emerald-600 block">
                      {formatDZD(decl.amountDZD, lang)}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {formatDateFr(decl.submittedAt.slice(0, 10), lang)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div>
                    {decl.proofDataUrl ? (
                      <button
                        type="button"
                        onClick={() => setProofLightboxUrl(decl.proofDataUrl!)}
                        className="inline-flex items-center gap-1.5 text-sky-700 dark:text-sky-300 font-semibold hover:underline cursor-pointer"
                      >
                        <img
                          src={decl.proofDataUrl}
                          alt="Preuve"
                          className="w-7 h-7 rounded object-cover border border-sky-200"
                        />
                        <span>Voir la capture</span>
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-400">Sans capture jointe</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={async () => {
                        const ok = await confirm({
                          title: 'Rejeter cette déclaration ?',
                          message: `Supprimer la déclaration de ${decl.apartmentNumber} (${formatDZD(decl.amountDZD, lang)}) ?`,
                          confirmLabel: 'Rejeter',
                          danger: true,
                        });
                        if (ok) await rejectPaymentDeclaration(decl.id);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 hover:bg-rose-100 font-semibold cursor-pointer"
                    >
                      Rejeter
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const createdPayment = await approvePaymentDeclaration(decl.id);
                        if (createdPayment) {
                          onViewReceipt(createdPayment);
                        }
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer shadow-2xs"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Valider & Quittance</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {data.building.feeFrequency === 'annuel' ? t('feesTitleAnnual') : t('feesTitleMonthly')}
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {formatDZD(standardFee, lang)} /{' '}
              {data.building.feeFrequency === 'annuel' ? t('perYear') : t('perMonth')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-medium">
              <button
                onClick={() => setViewMode('period')}
                className={`px-2.5 py-1.5 rounded-lg cursor-pointer ${
                  viewMode === 'period'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm font-semibold'
                    : 'text-slate-500'
                }`}
              >
                {t('byPeriod')}
              </button>
              <button
                onClick={() => setViewMode('multi_year')}
                className={`px-2.5 py-1.5 rounded-lg cursor-pointer flex items-center gap-1 ${
                  viewMode === 'multi_year'
                    ? 'bg-emerald-600 text-white shadow-sm font-semibold'
                    : 'text-slate-500'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>{t('multiYearArrears')}</span>
              </button>
              <button
                onClick={() => setViewMode('special_calls')}
                className={`px-2.5 py-1.5 rounded-lg cursor-pointer flex items-center gap-1 ${
                  viewMode === 'special_calls'
                    ? 'bg-sky-600 text-white shadow-sm font-semibold'
                    : 'text-slate-500'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>
                  {lang === 'ar' ? 'مشاريع خاصة' : 'Appels Spéciaux'} ({specialCalls.length})
                </span>
              </button>
            </div>

            {viewMode === 'period' && (
              <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                <Calendar className="w-4 h-4 text-slate-400" />
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="text-xs font-bold bg-transparent text-slate-900 dark:text-white focus:outline-none cursor-pointer"
                >
                  {availablePeriods.map((p) => (
                    <option key={p} value={p}>
                      {formatMonthName(p, lang)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {canCollect && viewMode !== 'special_calls' && (
              <button
                onClick={() => onOpenNewPayment()}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{t('collectFeeBtn')}</span>
              </button>
            )}

            {canCollect && viewMode === 'special_calls' && (
              <button
                onClick={() => {
                  setEditingCall(null);
                  setCallForm({
                    title: '',
                    description: '',
                    amountPerApartmentDZD: 5000,
                    dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
                    fund: 'reserve',
                  });
                  setIsSpecialCallModal(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-xl shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{lang === 'ar' ? 'مشروع / نداء استثنائي جديد' : 'Nouvel Appel de Fonds'}</span>
              </button>
            )}

            {viewMode !== 'special_calls' && (
              <>
                <button
                  onClick={() => onPrintUnpaidNotice(selectedMonth, unpaidApartments)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-xl shadow-xs cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-slate-500" />
                  <span>{t('unpaidNoticeHall')}</span>
                </button>

                <button
                  onClick={handleExportCSV}
                  className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer"
                  title={t('exportCsv')}
                >
                  <Download className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>

        {viewMode !== 'special_calls' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="p-3.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40">
              <span className="text-xs text-emerald-800 dark:text-emerald-300 font-medium block">
                {t('totalCollectedCash')} — {formatMonthName(selectedMonth, lang)} ({fullyPaidApts.length}/
                {occupiedApts.length} {t('paidShort')}
                {partialApts.length > 0 ? ` + ${partialApts.length} ${lang === 'ar' ? 'جزئي' : 'partiels'}` : ''})
              </span>
              <span className="text-xl font-bold font-mono text-emerald-700 dark:text-emerald-300 tabular-nums">
                {formatDZD(totalCollected, lang)}
              </span>
              <div className="flex items-center gap-2 mt-1 text-[11px] text-emerald-700/80 dark:text-emerald-400">
                <span>{t('collectionRate')}</span>
                <strong>{collectionRate}%</strong>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-800/40">
              <span className="text-xs text-rose-800 dark:text-rose-300 font-medium block">
                {viewMode === 'multi_year'
                  ? t('cumulativeArrears')
                  : `${t('remainingToCollect')} (${unpaidApartments.length} ${lang === 'ar' ? 'غير مسدد' : 'impayés'}${
                      partialApts.length > 0
                        ? ` + ${partialApts.length} ${lang === 'ar' ? 'جزئي' : 'partiels'}`
                        : ''
                    })`}
              </span>
              <span className="text-xl font-bold font-mono text-rose-700 dark:text-rose-300 tabular-nums">
                {formatDZD(viewMode === 'multi_year' ? totalCumulativeArrears : totalRemaining, lang)}
              </span>
              <p className="text-[11px] text-rose-600/80 dark:text-rose-400 mt-1">
                {t('expectedOf')} {formatDZD(totalExpected, lang)}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
              <span className="text-xs text-slate-600 dark:text-slate-400 font-medium block">
                {t('graduatedReminderTitle')}
              </span>
              <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 space-y-0.5">
                <div>{t('reminderJ15')}</div>
                <div>{t('reminderJ30')}</div>
                <div>{t('reminderJ60')}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SPECIAL CALLS TAB */}
      {viewMode === 'special_calls' && (
        <div className="space-y-4">
          {specialCalls.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center space-y-3">
              <Sparkles className="w-8 h-8 text-sky-500 mx-auto" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {lang === 'ar'
                  ? 'لا توجد مشاريع استثنائية مفتوحة حالياً'
                  : 'Aucun appel de fonds exceptionnel (caméras, surpresseur, étanchéité...)'}
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Créez un appel de fonds voté en Assemblée Générale pour suivre séparément la participation de chaque appartement sans mélanger avec la cotisation courante.
              </p>
            </div>
          ) : (
            specialCalls.map((sc) => {
              const expectedCallTotal = occupiedApts.length * sc.amountPerApartmentDZD;
              const collectedCallTotal = (sc.contributions || []).reduce((s, c) => s + c.amountDZD, 0);
              const pct = expectedCallTotal > 0 ? Math.min(100, Math.round((collectedCallTotal / expectedCallTotal) * 100)) : 0;
              const paidAptSet = new Set((sc.contributions || []).map((c) => c.apartmentId));

              return (
                <div
                  key={sc.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 font-bold text-[10px] uppercase">
                          {sc.fund === 'reserve' ? 'Fonds de Réserve' : 'Fonds Courant'}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">Échéance : {sc.dueDate}</span>
                      </div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1">{sc.title}</h3>
                      {sc.description && <p className="text-xs text-slate-500 mt-0.5">{sc.description}</p>}
                    </div>

                    {canCollect && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => {
                            setCollectCallId(collectCallId === sc.id ? null : sc.id);
                            setCollectAmount(sc.amountPerApartmentDZD);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
                        >
                          + Encaisser quote-part
                        </button>
                        <button
                          onClick={() => {
                            setEditingCall(sc);
                            setCallForm({
                              title: sc.title,
                              description: sc.description || '',
                              amountPerApartmentDZD: sc.amountPerApartmentDZD,
                              dueDate: sc.dueDate,
                              fund: sc.fund,
                            });
                            setIsSpecialCallModal(true);
                          }}
                          className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={async () => {
                            const ok = await confirm({
                              title: "Supprimer l'appel de fonds",
                              message: `Supprimer « ${sc.title} » et ses écritures liées ?`,
                              confirmLabel: 'Supprimer',
                              danger: true,
                            });
                            if (ok) await deleteSpecialCall(sc.id);
                          }}
                          className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Progress */}
                  <div className="space-y-1.5 text-xs">
                    <div className="flex flex-wrap justify-between font-semibold">
                      <span>
                        Quote-part : <strong>{formatDZD(sc.amountPerApartmentDZD, lang)}</strong> / logement ·{' '}
                        {paidAptSet.size}/{occupiedApts.length} logements ont participé
                      </span>
                      <span className="font-mono text-emerald-600">
                        {formatDZD(collectedCallTotal, lang)} / {formatDZD(expectedCallTotal, lang)} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-sky-600 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>

                  {/* Inline quick collection form */}
                  {collectCallId === sc.id && canCollect && (
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const apt = data.apartments.find((a) => a.id === collectAptId);
                        if (!apt || collectAmount <= 0) return;
                        const seq = String((sc.contributions || []).length + 1).padStart(3, '0');
                        const contrib: SpecialCallContribution = {
                          id: `spc-${Date.now()}`,
                          receiptNumber: `APP-${sc.id.slice(-4).toUpperCase()}-${seq}`,
                          apartmentId: apt.id,
                          apartmentNumber: apt.number,
                          residentName: apt.resident.name,
                          amountDZD: Number(collectAmount),
                          paymentDate: new Date().toISOString(),
                          paymentMethod: collectMethod,
                          collectedBy: user.fullName || data.building.syndicPresident,
                        };
                        await recordSpecialCallContribution(sc.id, contrib);
                        setCollectCallId(null);
                      }}
                      className="p-3.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-800 grid grid-cols-1 sm:grid-cols-4 gap-2.5 items-end text-xs"
                    >
                      <div>
                        <label className="block font-bold mb-1">Logement</label>
                        <select
                          value={collectAptId}
                          onChange={(e) => setCollectAptId(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                        >
                          {data.apartments.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.number} — {a.resident.name} {paidAptSet.has(a.id) ? '(Déjà versé)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block font-bold mb-1">Montant (DZD)</label>
                        <input
                          type="number"
                          value={collectAmount}
                          onChange={(e) => setCollectAmount(Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono font-bold"
                        />
                      </div>
                      <div>
                        <label className="block font-bold mb-1">Mode</label>
                        <select
                          value={collectMethod}
                          onChange={(e) => setCollectMethod(e.target.value as PaymentMethod)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                        >
                          <option value="Espèces">Espèces</option>
                          <option value="BaridiMob">BaridiMob</option>
                          <option value="Virement CCP">Virement CCP</option>
                          <option value="Chèque">Chèque</option>
                        </select>
                      </div>
                      <button
                        type="submit"
                        className="py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                      >
                        Valider encaissement
                      </button>
                    </form>
                  )}

                  {/* Contributions list */}
                  {(sc.contributions || []).length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                      {(sc.contributions || []).map((c) => (
                        <span
                          key={c.id}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                        >
                          <strong>{c.apartmentNumber}</strong>
                          <span className="font-mono text-emerald-600 font-bold">
                            {formatDZD(c.amountDZD, lang)}
                          </span>
                          {canCollect && (
                            <button
                              type="button"
                              onClick={() => deleteSpecialCallContribution(sc.id, c.id)}
                              className="text-slate-400 hover:text-rose-600 cursor-pointer"
                            >
                              ×
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Filters for Period / Multi-Year */}
      {viewMode !== 'special_calls' && (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-medium">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg cursor-pointer ${
                  statusFilter === 'all'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm font-semibold'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {t('all')} ({data.apartments.length})
              </button>
              <button
                onClick={() => setStatusFilter('paid')}
                className={`px-3 py-1.5 rounded-lg cursor-pointer flex items-center gap-1.5 ${
                  statusFilter === 'paid'
                    ? 'bg-emerald-600 text-white shadow-sm font-semibold'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>
                  {t('upToDate')} (
                  {viewMode === 'period'
                    ? fullyPaidApts.length
                    : occupiedApts.filter((a) => getAptUnpaidYears(a).length === 0).length}
                  )
                </span>
              </button>
              <button
                onClick={() => setStatusFilter('partial')}
                className={`px-3 py-1.5 rounded-lg cursor-pointer flex items-center gap-1.5 ${
                  statusFilter === 'partial'
                    ? 'bg-amber-600 text-white shadow-sm font-semibold'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>
                  {lang === 'ar' ? 'دفع جزئي' : 'Partiel'} (
                  {viewMode === 'period'
                    ? partialApts.length
                    : occupiedApts.filter((a) =>
                        arrearsYears.some((y) => {
                          const p = getAptYearPaid(a.id, y);
                          return p > 0 && p < standardFee;
                        })
                      ).length}
                  )
                </span>
              </button>
              <button
                onClick={() => setStatusFilter('unpaid')}
                className={`px-3 py-1.5 rounded-lg cursor-pointer flex items-center gap-1.5 ${
                  statusFilter === 'unpaid'
                    ? 'bg-rose-600 text-white shadow-sm font-semibold'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>
                  {t('unpaid')} (
                  {viewMode === 'period'
                    ? unpaidApartments.length
                    : occupiedApts.filter((a) => getAptUnpaidYears(a).length > 0).length}
                  )
                </span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={floorFilter}
                onChange={(e) => setFloorFilter(e.target.value)}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value="all">{t('allFloors')}</option>
                <option value="0">{t('rdc')}</option>
                {Array.from({ length: maxFloor }).map((_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {t('floor')} {i + 1}
                  </option>
                ))}
              </select>

              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute start-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('search')}
                  className="text-xs ps-8 pe-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white w-44 sm:w-56"
                />
              </div>
            </div>
          </div>

          {viewMode === 'period' ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-start text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700/80 text-slate-600 dark:text-slate-300 font-semibold">
                    <tr>
                      <th className="py-3 px-4">{t('doorFloorCol')}</th>
                      <th className="py-3 px-4">{t('residentCol')}</th>
                      <th className="py-3 px-4">{t('aadlFolder')}</th>
                      <th className="py-3 px-4">
                        {t('statusCol')} {formatMonthName(selectedMonth, lang)}
                      </th>
                      <th className="py-3 px-4">{t('receiptCol')}</th>
                      <th className="py-3 px-4 text-end">{t('amountCol')}</th>
                      <th className="py-3 px-4 text-end">{t('actionsCol')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                    {filteredApartments.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400">
                          {t('noMatchingApt')}
                        </td>
                      </tr>
                    ) : (
                      filteredApartments.map((apt) => {
                        const aptPayments = paymentsByAptId.get(apt.id) || [];
                        const payment = aptPayments[0];
                        const totalAptPaid = aptPayments.reduce((sum, p) => sum + p.amountDZD, 0);
                        const isVacant = apt.occupancy === 'vacant';
                        const isFullyPaid =
                          !isVacant && totalAptPaid >= standardFee && (standardFee > 0 || aptPayments.length > 0);
                        const isPartial =
                          !isVacant && totalAptPaid > 0 && standardFee > 0 && totalAptPaid < standardFee;
                        const remainingDue = Math.max(0, standardFee - totalAptPaid);

                        return (
                          <tr key={apt.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="py-3 px-4 whitespace-nowrap">
                              <div className="font-bold text-slate-900 dark:text-white">{apt.number}</div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                {apt.floor === 0 ? t('rdcShort') : `${t('floor')} ${apt.floor}`} · {apt.type}
                              </div>
                            </td>

                            <td className="py-3 px-4">
                              <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                                <span>{apt.resident.name}</span>
                                {apt.resident.isSyndicMember && (
                                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                    {t('syndic')}
                                  </span>
                                )}
                                {apt.occupancy === 'tenant' && (
                                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                                    {t('tenant')}
                                    {apt.tenant?.name ? ` : ${apt.tenant.name}` : ''}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-2.5 font-mono mt-0.5">
                                {apt.resident.birthDate && <span>{apt.resident.birthDate}</span>}
                                {apt.resident.phone && apt.resident.phone !== '-' && (
                                  <span dir="ltr">{apt.resident.phone}</span>
                                )}
                              </div>
                            </td>

                            <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-slate-600 dark:text-slate-400">
                              {apt.resident.aadlFolderNumber || '—'}
                            </td>

                            <td className="py-3 px-4 whitespace-nowrap">
                              {isFullyPaid ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  <span>
                                    {t('settledShort')} ({payment?.paymentMethod || 'Espèces'})
                                  </span>
                                </span>
                              ) : isPartial ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                  <Clock className="w-3 h-3 text-amber-600" />
                                  <span>
                                    {lang === 'ar' ? 'دفع جزئي' : 'Partiel'} ·{' '}
                                    {lang === 'ar' ? 'الباقي' : 'Reste'} {formatDZD(remainingDue, lang)}
                                  </span>
                                </span>
                              ) : isVacant ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                  {t('notInhabited')}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                                  <XCircle className="w-3 h-3 text-rose-600" />
                                  <span>{t('unpaidShort')}</span>
                                </span>
                              )}
                            </td>

                            <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-slate-600 dark:text-slate-400">
                              {aptPayments.length > 0 ? (
                                <div className="flex flex-col items-start gap-1">
                                  {aptPayments.map((p) => (
                                    <div key={p.id} className="flex items-center gap-1.5">
                                      <button
                                        onClick={() => onViewReceipt(p)}
                                        className="text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                                      >
                                        {p.receiptNumber}
                                      </button>
                                      {aptPayments.length > 1 && canCollect && (
                                        <>
                                          <button
                                            onClick={() => onEditPayment(p)}
                                            title={`${t('edit')} ${p.receiptNumber}`}
                                            className="p-0.5 text-amber-600 hover:text-amber-700 dark:text-amber-400 rounded cursor-pointer"
                                          >
                                            <Pencil className="w-3 h-3" />
                                          </button>
                                          <button
                                            onClick={() => onDeletePayment(p)}
                                            title={`${lang === 'ar' ? 'حذف' : 'Supprimer'} ${p.receiptNumber}`}
                                            className="p-0.5 text-rose-500 hover:text-rose-700 dark:text-rose-400 rounded cursor-pointer"
                                          >
                                            <Trash2 className="w-3 h-3" />
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                '—'
                              )}
                            </td>

                            <td className="py-3 px-4 text-end whitespace-nowrap font-mono tabular-nums">
                              {isFullyPaid ? (
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                  {formatDZD(totalAptPaid, lang)}
                                </span>
                              ) : isPartial ? (
                                <div>
                                  <span className="font-bold text-amber-600 dark:text-amber-400">
                                    {formatDZD(totalAptPaid, lang)}
                                  </span>
                                  <span className="block text-[10px] text-slate-400">
                                    / {formatDZD(standardFee, lang)}
                                  </span>
                                </div>
                              ) : isVacant ? (
                                <span className="text-slate-400">—</span>
                              ) : (
                                <span className="text-rose-600 dark:text-rose-400 font-semibold">
                                  {formatDZD(0, lang)}
                                </span>
                              )}
                            </td>

                            <td className="py-3 px-4 text-end whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                {onOpenQuitus && !isVacant && (
                                  <button
                                    onClick={() => onOpenQuitus(apt)}
                                    title="Attestation de Quitus A4"
                                    className="p-1.5 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 rounded border border-emerald-200 dark:border-emerald-800 cursor-pointer"
                                  >
                                    <Award className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {isPartial && canCollect && (
                                  <>
                                    <button
                                      onClick={() => onOpenNewPayment(apt)}
                                      className="px-2.5 py-1 text-[11px] font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded cursor-pointer"
                                    >
                                      {lang === 'ar' ? 'إتمام' : 'Compléter'}
                                    </button>
                                    <button
                                      onClick={() => handleCopyReminder(apt, [selectedMonth], remainingDue)}
                                      className="p-1 text-slate-500 hover:text-slate-800 dark:hover:text-white rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                      title={t('copyWhatsappReminder')}
                                    >
                                      <Copy className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}
                                {payment && (
                                  <>
                                    <button
                                      onClick={() => onViewReceipt(payment)}
                                      className="px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 rounded border border-emerald-200 dark:border-emerald-800 cursor-pointer"
                                    >
                                      {t('receiptBtn')}
                                    </button>
                                    {canCollect && (
                                      <>
                                        <button
                                          onClick={() => onEditPayment(payment)}
                                          title={t('edit')}
                                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 rounded border border-amber-200 dark:border-amber-800 cursor-pointer"
                                        >
                                          <Pencil className="w-3 h-3" />
                                          <span>{t('edit')}</span>
                                        </button>
                                        <button
                                          onClick={() => onDeletePayment(payment)}
                                          title={lang === 'ar' ? 'حذف الاشتراك' : 'Supprimer la cotisation'}
                                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 rounded border border-rose-200 dark:border-rose-800 cursor-pointer"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                          <span className="hidden xl:inline">
                                            {lang === 'ar' ? 'حذف' : 'Supprimer'}
                                          </span>
                                        </button>
                                      </>
                                    )}
                                  </>
                                )}
                                {!isFullyPaid && !isPartial && !isVacant && canCollect && (
                                  <>
                                    <button
                                      onClick={() => onOpenNewPayment(apt)}
                                      className="px-2.5 py-1 text-[11px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded cursor-pointer"
                                    >
                                      {t('collectFeeBtn')}
                                    </button>
                                    <button
                                      onClick={() => handleCopyReminder(apt, [selectedMonth], standardFee)}
                                      className="p-1 text-slate-500 hover:text-slate-800 dark:hover:text-white rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                      title={t('copyWhatsappReminder')}
                                    >
                                      <Copy className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <AlertCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{t('multiYearBanner')}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-start text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700/80 text-slate-600 dark:text-slate-300 font-semibold">
                    <tr>
                      <th className="py-3 px-4">{t('residentCol')}</th>
                      {dynamicYears.map((y) => (
                        <th key={y} className="py-3 px-4 text-center">
                          {t('exerciseCol')} {y}
                        </th>
                      ))}
                      <th className="py-3 px-4 text-end">{t('cumulativeArrearsCol')}</th>
                      {canCollect && <th className="py-3 px-4 text-end">{t('reminderCol')}</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                    {filteredApartments.map((apt) => {
                      const isVacant = apt.occupancy === 'vacant';
                      const unpaidYears = getAptUnpaidYears(apt);
                      const totalDue = getAptTotalArrears(apt);
                      return (
                        <tr key={apt.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900 dark:text-white">
                              {apt.number} — <span className="font-semibold">{apt.resident.name}</span>
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {apt.floor === 0 ? t('rdcShort') : `${t('floor')} ${apt.floor}`} · {apt.type}
                            </div>
                          </td>
                          {dynamicYears.map((year) => {
                            const paid = getAptYearPaid(apt.id, year);
                            const isFutureYear = Number(year) > currentYrNum;
                            return (
                              <td key={year} className="py-3 px-4 text-center font-mono">
                                {isVacant ? (
                                  <span className="text-slate-400">{t('empty')}</span>
                                ) : paid >= standardFee && standardFee > 0 ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 text-[11px] font-bold">
                                    <CheckCircle2 className="w-3 h-3" />
                                    {formatDZD(paid, lang)}
                                  </span>
                                ) : paid > 0 ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 text-[11px] font-bold">
                                    <Clock className="w-3 h-3" />
                                    {formatDZD(paid, lang)}
                                  </span>
                                ) : year === '2024' ? (
                                  <span className="text-slate-400 text-[11px]">{t('archived')}</span>
                                ) : isFutureYear ? (
                                  <span className="text-slate-400 text-[11px]">À venir</span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 text-[11px] font-semibold">
                                    {t('unpaidShort')}
                                  </span>
                                )}
                              </td>
                            );
                          })}
                          <td className="py-3 px-4 text-end font-mono font-bold tabular-nums">
                            {isVacant ? (
                              <span className="text-slate-400">—</span>
                            ) : totalDue === 0 ? (
                              <span className="text-emerald-600 dark:text-emerald-400">{formatDZD(0, lang)}</span>
                            ) : (
                              <span className="text-rose-600 dark:text-rose-400">{formatDZD(totalDue, lang)}</span>
                            )}
                          </td>
                          {canCollect && (
                            <td className="py-3 px-4 text-end whitespace-nowrap">
                              {!isVacant && unpaidYears.length > 0 && (
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => onOpenNewPayment(apt)}
                                    className="px-2 py-1 text-[11px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded cursor-pointer"
                                  >
                                    {t('collectFeeBtn')}
                                  </button>
                                  <button
                                    onClick={() => handleCopyReminder(apt, unpaidYears, totalDue)}
                                    className="px-2 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded cursor-pointer flex items-center gap-1"
                                  >
                                    <Copy className="w-3 h-3" />
                                    <span>
                                      {t('remindBtn')} ({unpaidYears.length})
                                    </span>
                                  </button>
                                </div>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Special Call Modal */}
      {isSpecialCallModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4 no-print">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingCall ? "Modifier l'appel de fonds" : 'Nouvel Appel de Fonds Exceptionnel'}
              </h3>
              <button onClick={() => setIsSpecialCallModal(false)} className="p-1 text-slate-400 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSpecialCall} className="space-y-3.5">
              <div>
                <label className="block font-bold mb-1">Intitulé du projet voté en AG *</label>
                <input
                  type="text"
                  required
                  value={callForm.title}
                  onChange={(e) => setCallForm({ ...callForm, title: e.target.value })}
                  placeholder="Ex : Installation caméras vidéosurveillance / Pompe secours"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">Description / Détails</label>
                <textarea
                  rows={2}
                  value={callForm.description}
                  onChange={(e) => setCallForm({ ...callForm, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">Quote-part / logement (DZD)</label>
                  <input
                    type="number"
                    required
                    min={100}
                    value={callForm.amountPerApartmentDZD}
                    onChange={(e) => setCallForm({ ...callForm, amountPerApartmentDZD: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Date limite</label>
                  <input
                    type="date"
                    required
                    value={callForm.dueDate}
                    onChange={(e) => setCallForm({ ...callForm, dueDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold mb-1">Fonds destinataire</label>
                <select
                  value={callForm.fund}
                  onChange={(e) => setCallForm({ ...callForm, fund: e.target.value as TransactionFund })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  <option value="reserve">Fonds de Réserve (Gros travaux & équipements)</option>
                  <option value="courant">Fonds Courant</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsSpecialCallModal(false)}
                  className="px-4 py-2 text-slate-500 cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold cursor-pointer"
                >
                  {t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {proofLightboxUrl && (
        <div
          onClick={() => setProofLightboxUrl(null)}
          className="fixed inset-0 z-50 bg-slate-950/85 flex items-center justify-center p-4 cursor-pointer"
        >
          <img src={proofLightboxUrl} alt="Preuve de paiement" className="max-w-full max-h-[88vh] rounded-2xl shadow-2xl" />
        </div>
      )}
    </div>
  );
};
