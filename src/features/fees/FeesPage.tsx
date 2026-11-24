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
} from 'lucide-react';
import { Apartment, PaymentRecord } from '../../types';
import { formatDZD, formatMonthName, getCurrentMonthStr, generateFeeReminderText } from '../../utils/helpers';
import { useI18n } from '../../i18n';
import { useAppStore } from '../../stores/AppStore';
import { canManageFinance } from '../../utils/permissions';
import { useToast } from '../../components/ui/ToastProvider';

interface FeesPageProps {
  onOpenNewPayment: (defaultApt?: Apartment) => void;
  onEditPayment: (payment: PaymentRecord) => void;
  onDeletePayment: (payment: PaymentRecord) => void;
  onViewReceipt: (payment: PaymentRecord) => void;
  onPrintUnpaidNotice: (month: string, unpaidApts: Apartment[]) => void;
}

const MULTI_YEARS = ['2024', '2025', '2026'];

export const FeesPage: React.FC<FeesPageProps> = ({
  onOpenNewPayment,
  onEditPayment,
  onDeletePayment,
  onViewReceipt,
  onPrintUnpaidNotice,
}) => {
  const { lang, t } = useI18n();
  const { data, role } = useAppStore();
  const toast = useToast();
  const canCollect = canManageFinance(role);

  const [viewMode, setViewMode] = useState<'period' | 'multi_year'>('period');
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthStr());
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'partial' | 'unpaid'>('all');
  const [floorFilter, setFloorFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

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
      .filter((p) => p.apartmentId === aptId && p.month === year)
      .reduce((sum, p) => sum + p.amountDZD, 0);

  const getAptYearRemaining = (apt: Apartment, year: string): number => {
    if (apt.occupancy === 'vacant') return 0;
    return Math.max(0, standardFee - getAptYearPaid(apt.id, year));
  };

  const getAptUnpaidYears = (apt: Apartment): string[] => {
    if (apt.occupancy === 'vacant') return [];
    return ['2025', '2026'].filter((y) => getAptYearPaid(apt.id, y) < standardFee);
  };

  const getAptTotalArrears = (apt: Apartment): number => {
    if (apt.occupancy === 'vacant') return 0;
    return ['2025', '2026'].reduce((acc, y) => acc + getAptYearRemaining(apt, y), 0);
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
    } else {
      const unpaidYears = getAptUnpaidYears(apt);
      const hasPartial = ['2025', '2026'].some((y) => {
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
      'Numero_Appartement', 'Etage', 'Type', 'Resident', 'Date_Naissance', 'Telephone',
      'Dossier_AADL', 'Statut', 'Montant_DZD', 'Numero_Quittance', 'Date_Paiement', 'Mode',
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

  return (
    <div className="space-y-6">
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
              {formatDZD(standardFee, lang)} / {data.building.feeFrequency === 'annuel' ? t('perYear') : t('perMonth')}
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
            </div>

            {viewMode === 'period' && (
              <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                <Calendar className="w-4 h-4 text-slate-400" />
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="text-xs font-bold bg-transparent text-slate-900 dark:text-white focus:outline-none cursor-pointer"
                >
                  <option value="2026">{formatMonthName('2026', lang)}</option>
                  <option value="2025">{formatMonthName('2025', lang)}</option>
                  <option value="2024">{formatMonthName('2024', lang)}</option>
                  <option value="2026-11">{formatMonthName('2026-11', lang)}</option>
                  <option value="2026-10">{formatMonthName('2026-10', lang)}</option>
                </select>
              </div>
            )}

            {canCollect && (
              <button
                onClick={() => onOpenNewPayment()}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{t('collectFeeBtn')}</span>
              </button>
            )}

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
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="p-3.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40">
            <span className="text-xs text-emerald-800 dark:text-emerald-300 font-medium block">
              {t('totalCollectedCash')} — {formatMonthName(selectedMonth, lang)} ({fullyPaidApts.length}/{occupiedApts.length} {t('paidShort')}
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
      </div>

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
              statusFilter === 'paid' ? 'bg-emerald-600 text-white shadow-sm font-semibold' : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{t('upToDate')} ({viewMode === 'period' ? fullyPaidApts.length : occupiedApts.filter((a) => getAptUnpaidYears(a).length === 0).length})</span>
          </button>
          <button
            onClick={() => setStatusFilter('partial')}
            className={`px-3 py-1.5 rounded-lg cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'partial' ? 'bg-amber-600 text-white shadow-sm font-semibold' : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>
              {lang === 'ar' ? 'دفع جزئي' : 'Partiel'} ({viewMode === 'period' ? partialApts.length : occupiedApts.filter((a) => ['2025', '2026'].some((y) => { const p = getAptYearPaid(a.id, y); return p > 0 && p < standardFee; })).length})
            </span>
          </button>
          <button
            onClick={() => setStatusFilter('unpaid')}
            className={`px-3 py-1.5 rounded-lg cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'unpaid' ? 'bg-rose-600 text-white shadow-sm font-semibold' : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>{t('unpaid')} ({viewMode === 'period' ? unpaidApartments.length : occupiedApts.filter((a) => getAptUnpaidYears(a).length > 0).length})</span>
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
                  <th className="py-3 px-4">{t('statusCol')} {formatMonthName(selectedMonth, lang)}</th>
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
                    const isFullyPaid = !isVacant && totalAptPaid >= standardFee && (standardFee > 0 || aptPayments.length > 0);
                    const isPartial = !isVacant && totalAptPaid > 0 && standardFee > 0 && totalAptPaid < standardFee;
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
                                {t('tenant')}{apt.tenant?.name ? ` : ${apt.tenant.name}` : ''}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-2.5 font-mono mt-0.5">
                            {apt.resident.birthDate && <span>{apt.resident.birthDate}</span>}
                            {apt.resident.phone && apt.resident.phone !== '-' && <span dir="ltr">{apt.resident.phone}</span>}
                          </div>
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-slate-600 dark:text-slate-400">
                          {apt.resident.aadlFolderNumber || '—'}
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          {isFullyPaid ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>{t('settledShort')} ({payment?.paymentMethod || 'Espèces'})</span>
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
                                      <span className="hidden xl:inline">{lang === 'ar' ? 'حذف' : 'Supprimer'}</span>
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
                  {MULTI_YEARS.map((y) => (
                    <th key={y} className="py-3 px-4 text-center">{t('exerciseCol')} {y}</th>
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
                      {MULTI_YEARS.map((year) => {
                        const paid = getAptYearPaid(apt.id, year);
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
                                <span>{t('remindBtn')} ({unpaidYears.length})</span>
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
    </div>
  );
};
