import React, { useEffect, useMemo, useState } from 'react';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  ArrowLeftRight,
  Plus,
  Printer,
  Shield,
  Paperclip,
  Trash2,
  Edit3,
  Check,
  PiggyBank,
  BarChart3,
  PieChart,
  Download,
  Search,
  AlertTriangle,
  FileWarning,
  Banknote,
  Sparkles,
  BookOpen,
  RotateCcw,
  CalendarCheck,
  Zap,
  Layers,
  Droplet,
  X,
} from 'lucide-react';
import {
  BudgetAllocation,
  PaymentMethod,
  Transaction,
  TransactionCategory,
  TransactionFund,
} from '../../types';
import { formatDZD, formatShortDate } from '../../utils/helpers';
import { useI18n } from '../../i18n';
import { useAppStore } from '../../stores/AppStore';
import { canManageFinance, canManageSettings } from '../../utils/permissions';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { useToast } from '../../components/ui/ToastProvider';
import { CashflowBarChart, CircularGauge, DonutChart } from '../../components/ui/Charts';
import { EmptyState } from '../../components/ui/EmptyState';
import { SlideOverDrawer } from '../../components/ui/SlideOverDrawer';
import { TransactionModal } from './TransactionModal';
import { TransferFundModal } from './TransferFundModal';
import { FinancialReportModal } from './FinancialReportModal';
import {
  ALL_PAYMENT_METHODS,
  DEFAULT_AADL_BUDGET_TEMPLATE,
  EXPENSE_CATEGORIES,
  computeRunningBalances,
  exportTransactionsCSV,
  getCategoryLabel,
  getPaymentMethodLabel,
  isCarryOverTransaction,
  isInternalTransfer,
} from './treasuryHelpers';

interface TreasuryPageProps {
  onPrintFinancialReport?: () => void;
}

export const TreasuryPage: React.FC<TreasuryPageProps> = ({ onPrintFinancialReport }) => {
  const { lang, t } = useI18n();
  const { data, role, addTransaction, updateTransaction, deleteTransaction, updateBudgetPlan, resetFinancials } = useAppStore();
  const { confirm } = useConfirm();
  const toast = useToast();
  const canEdit = canManageFinance(role);
  const canResetFinancials = canManageSettings(role);

  const [subTab, setSubTab] = useState<'overview' | 'ledger' | 'budget'>('overview');
  const [yearFilter, setYearFilter] = useState<string>('all');

  // Modals & Drawers
  const [isNewTxModalOpen, setIsNewTxModalOpen] = useState(false);
  const [txPreset, setTxPreset] = useState<Partial<Transaction> | null>(null);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [isCloseExerciseOpen, setIsCloseExerciseOpen] = useState(false);
  const [closeYear, setCloseYear] = useState<string>(String(new Date().getFullYear()));
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  // Ledger filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'recette' | 'depense'>('all');
  const [filterFund, setFilterFund] = useState<'all' | TransactionFund>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterMethod, setFilterMethod] = useState<string>('all');
  const [onlyMissingAttachment, setOnlyMissingAttachment] = useState(false);

  // Budget workbench
  const [budgetFundFilter, setBudgetFundFilter] = useState<'all' | TransactionFund>('all');
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState<BudgetAllocation[]>(data.budgetPlan || []);
  const [newBudgetCat, setNewBudgetCat] = useState<TransactionCategory>('Autre');

  useEffect(() => {
    setBudgetDraft(data.budgetPlan || []);
    setIsEditingBudget(false);
  }, [data.building.id, data.budgetPlan]);

  const getTxFund = (tx: Transaction): TransactionFund => tx.fund || 'courant';

  // Available years dynamically computed
  const availableYears = useMemo(() => {
    const years = new Set<string>([String(new Date().getFullYear())]);
    data.transactions.forEach((tx) => {
      const yr = (tx.date || '').slice(0, 4);
      if (/^\d{4}$/.test(yr)) years.add(yr);
    });
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [data.transactions]);

  // Cumulative balances (always global across all years, including internal transfers)
  const courantBalance = useMemo(
    () =>
      data.transactions
        .filter((tx) => getTxFund(tx) === 'courant')
        .reduce((acc, tx) => acc + (tx.type === 'recette' ? tx.amountDZD : -tx.amountDZD), 0),
    [data.transactions]
  );

  const reserveBalance = useMemo(
    () =>
      data.transactions
        .filter((tx) => getTxFund(tx) === 'reserve')
        .reduce((acc, tx) => acc + (tx.type === 'recette' ? tx.amountDZD : -tx.amountDZD), 0),
    [data.transactions]
  );

  const netBalance = courantBalance + reserveBalance;
  const reserveTarget = data.building.reserveTargetDZD || 150000;
  const reserveProgress = Math.min(100, Math.max(0, Math.round((reserveBalance / reserveTarget) * 100)));
  const courantShare = netBalance > 0 ? Math.max(0, Math.min(100, Math.round((courantBalance / netBalance) * 100))) : 0;

  // Running balances across chronological ledger
  const runningBalances = useMemo(() => computeRunningBalances(data.transactions), [data.transactions]);

  // Scoped transactions for selected year / exercise
  const exerciseTransactions = useMemo(
    () => data.transactions.filter((tx) => yearFilter === 'all' || (tx.date || '').startsWith(yearFilter)),
    [data.transactions, yearFilter]
  );

  // Exclude internal transfers from external revenue / expense analytics & budget execution
  const externalExerciseTx = useMemo(
    () => exerciseTransactions.filter((tx) => !isInternalTransfer(tx)),
    [exerciseTransactions]
  );

  const exerciseIncomes = useMemo(
    () => externalExerciseTx.filter((tx) => tx.type === 'recette').reduce((a, tx) => a + tx.amountDZD, 0),
    [externalExerciseTx]
  );

  const carryOverNet = useMemo(
    () =>
      externalExerciseTx
        .filter((tx) => isCarryOverTransaction(tx))
        .reduce((acc, tx) => acc + (tx.type === 'recette' ? tx.amountDZD : -tx.amountDZD), 0),
    [externalExerciseTx]
  );

  const operatingExpenses = useMemo(
    () =>
      externalExerciseTx
        .filter((tx) => tx.type === 'depense' && !isCarryOverTransaction(tx))
        .reduce((a, tx) => a + tx.amountDZD, 0),
    [externalExerciseTx]
  );

  const exerciseExpenses = useMemo(
    () => externalExerciseTx.filter((tx) => tx.type === 'depense').reduce((a, tx) => a + tx.amountDZD, 0),
    [externalExerciseTx]
  );

  const expenseRecords = useMemo(
    () =>
      externalExerciseTx
        .filter((tx) => tx.type === 'depense')
        .sort((a, b) => {
          const diff = new Date(b.date).getTime() - new Date(a.date).getTime();
          if (diff !== 0) return diff;
          return b.id.localeCompare(a.id);
        }),
    [externalExerciseTx]
  );

  const expenseByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    externalExerciseTx
      .filter((tx) => tx.type === 'depense' && !isCarryOverTransaction(tx))
      .forEach((tx) => {
        map[tx.category] = (map[tx.category] || 0) + tx.amountDZD;
      });
    return map;
  }, [externalExerciseTx]);

  const donutSlices = useMemo(
    () =>
      Object.entries(expenseByCategory)
        .map(([cat, value]) => ({
          label: getCategoryLabel(cat as TransactionCategory, lang),
          value,
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6),
    [expenseByCategory, lang]
  );

  // Monthly cashflow bar points
  const cashflowPoints = useMemo(() => {
    const map = new Map<string, { income: number; expense: number }>();
    externalExerciseTx.forEach((tx) => {
      const monthKey = (tx.date || '').slice(0, 7) || '2026-01';
      const entry = map.get(monthKey) || { income: 0, expense: 0 };
      if (tx.type === 'recette') entry.income += tx.amountDZD;
      else entry.expense += tx.amountDZD;
      map.set(monthKey, entry);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-8)
      .map(([label, val]) => ({ label, ...val }));
  }, [externalExerciseTx]);

  // Reconciliation per payment method (global cumulative balances)
  const paymentMethodStats = useMemo(() => {
    return ALL_PAYMENT_METHODS.map((method: PaymentMethod) => {
      const matching = data.transactions.filter((tx) => tx.paymentMethod === method);
      const net = matching.reduce((acc, tx) => acc + (tx.type === 'recette' ? tx.amountDZD : -tx.amountDZD), 0);
      return { method, count: matching.length, net };
    }).filter((item) => item.count > 0 || item.method === 'Espèces' || item.method === 'Virement CCP');
  }, [data.transactions]);

  // Budget KPIs
  const budgetPlan = data.budgetPlan || [];
  const totalBudgetPlanned = budgetPlan.reduce((acc, b) => acc + b.plannedAnnualDZD, 0);
  const totalBudgetActual = budgetPlan.reduce((acc, b) => acc + (expenseByCategory[b.category] || 0), 0);
  const budgetExecRate =
    totalBudgetPlanned > 0 ? Math.round((totalBudgetActual / totalBudgetPlanned) * 100) : 0;

  const budgetAlerts = useMemo(() => {
    return budgetPlan
      .map((item) => {
        const actual = expenseByCategory[item.category] || 0;
        const pct = item.plannedAnnualDZD > 0 ? Math.round((actual / item.plannedAnnualDZD) * 100) : 0;
        return { ...item, actual, pct };
      })
      .filter((item) => item.pct >= 85)
      .sort((a, b) => b.pct - a.pct);
  }, [budgetPlan, expenseByCategory]);

  const overrunCount = budgetAlerts.filter((a) => a.actual > a.plannedAnnualDZD && a.plannedAnnualDZD > 0).length;
  const missingAttachmentCount = useMemo(
    () => externalExerciseTx.filter((tx) => tx.type === 'depense' && !tx.attachmentDataUrl).length,
    [externalExerciseTx]
  );

  // Filtered Ledger Transactions
  const filteredTransactions = useMemo(() => {
    return exerciseTransactions
      .filter((tx) => {
        if (filterType !== 'all' && tx.type !== filterType) return false;
        if (filterFund !== 'all' && getTxFund(tx) !== filterFund) return false;
        if (filterCategory !== 'all' && tx.category !== filterCategory) return false;
        if (filterMethod !== 'all' && tx.paymentMethod !== filterMethod) return false;
        if (onlyMissingAttachment && (tx.type !== 'depense' || Boolean(tx.attachmentDataUrl) || isInternalTransfer(tx))) {
          return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const haystack = `${tx.description} ${tx.category} ${tx.referenceDoc || ''} ${tx.paymentMethod}`.toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const diff = new Date(b.date).getTime() - new Date(a.date).getTime();
        if (diff !== 0) return diff;
        return b.id.localeCompare(a.id);
      });
  }, [
    exerciseTransactions,
    filterType,
    filterFund,
    filterCategory,
    filterMethod,
    onlyMissingAttachment,
    searchQuery,
  ]);

  const filteredTotals = useMemo(() => {
    const incomes = filteredTransactions
      .filter((t) => t.type === 'recette')
      .reduce((a, t) => a + t.amountDZD, 0);
    const expenses = filteredTransactions
      .filter((t) => t.type === 'depense')
      .reduce((a, t) => a + t.amountDZD, 0);
    return { incomes, expenses, net: incomes - expenses };
  }, [filteredTransactions]);

  const availableCategoriesToAdd = useMemo(() => {
    const used = new Set(budgetDraft.map((b) => b.category));
    return EXPENSE_CATEGORIES.filter((cat) => !used.has(cat));
  }, [budgetDraft]);

  const handleOpenBudgetEdit = () => {
    const draft = budgetPlan.map((b) => ({ ...b }));
    setBudgetDraft(draft);
    const used = new Set(draft.map((b) => b.category));
    const firstUnused = EXPENSE_CATEGORIES.find((c) => !used.has(c)) || 'Autre';
    setNewBudgetCat(firstUnused);
    setIsEditingBudget(true);
  };

  const handleAddBudgetLine = () => {
    if (budgetDraft.some((b) => b.category === newBudgetCat)) return;
    const nextList: BudgetAllocation[] = [
      ...budgetDraft,
      {
        category: newBudgetCat,
        plannedAnnualDZD: 20000,
        fund: newBudgetCat === 'Gros Travaux & Équipements' ? 'reserve' : 'courant',
      },
    ];
    setBudgetDraft(nextList);
    const used = new Set(nextList.map((b) => b.category));
    const remaining = EXPENSE_CATEGORIES.find((c) => !used.has(c));
    if (remaining) setNewBudgetCat(remaining);
  };

  const handleSaveBudget = async () => {
    await updateBudgetPlan(budgetDraft);
    setIsEditingBudget(false);
  };

  const handleLoadDefaultTemplate = async () => {
    await updateBudgetPlan(DEFAULT_AADL_BUDGET_TEMPLATE);
    setBudgetDraft(DEFAULT_AADL_BUDGET_TEMPLATE);
  };

  const handleTransfer = async (outTx: Transaction, inTx: Transaction) => {
    await addTransaction(outTx);
    await addTransaction(inTx);
  };

  const handleDeleteTx = async (tx: Transaction) => {
    const ok = await confirm({
      title: lang === 'ar' ? 'حذف العملية المالية' : 'Supprimer cette opération ?',
      message:
        lang === 'ar'
          ? `هل تريد حذف العملية "${tx.description}" بمبلغ ${formatDZD(tx.amountDZD, lang)}؟`
          : `Confirmez-vous la suppression de « ${tx.description} » (${formatDZD(tx.amountDZD, lang)}) ?`,
      confirmLabel: lang === 'ar' ? 'حذف' : 'Supprimer',
      cancelLabel: t('cancel'),
      danger: true,
    });
    if (ok) {
      await deleteTransaction(tx.id);
      if (selectedTx?.id === tx.id) setSelectedTx(null);
    }
  };

  const handleExportCsv = () => {
    exportTransactionsCSV(filteredTransactions, runningBalances, data.building.buildingNumber, lang);
    toast.success(
      lang === 'ar'
        ? `تم تصدير ${filteredTransactions.length} عملية إلى ملف CSV`
        : `${filteredTransactions.length} écriture(s) exportées en CSV`
    );
  };

  const handleResetFinancials = async () => {
    const ok = await confirm({
      title: lang === 'ar' ? 'تصفير المداخيل والمصاريف والتمارين' : 'Remettre recettes, dépenses & exercices à 0 DZD ?',
      message:
        lang === 'ar'
          ? 'سيتم مسح جميع الاشتراكات، المداخيل، المصاريف وتصفير الميزانية إلى 0 دج، مع الاحتفاظ بكل السكان، الإعلانات وإعدادات العمارة.'
          : 'Toutes les cotisations, recettes, dépenses et prévisions budgétaires seront remises à 0 DZD. Les résidents, avis et paramètres du bâtiment restent intactes.',
      confirmLabel: lang === 'ar' ? 'تصفير إلى 0 دج' : 'Remettre à 0 DZD',
      cancelLabel: t('cancel'),
      danger: true,
    });
    if (ok) {
      await resetFinancials();
    }
  };

  const isImageUrl = (url?: string) =>
    Boolean(url && (url.startsWith('data:image/') || /\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(url)));

  const visibleBudgetItems = (isEditingBudget ? budgetDraft : budgetPlan).filter(
    (item) => budgetFundFilter === 'all' || item.fund === budgetFundFilter
  );

  return (
    <div className="space-y-6">
      {/* Header + Toolbar + 4 Executive KPI Cards */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-5 print-card">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <Wallet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                {t('treasuryTitle')}
              </h2>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                {yearFilter === 'all'
                  ? lang === 'ar'
                    ? 'تراكم عام'
                    : 'Cumul global'
                  : `${lang === 'ar' ? 'السنة المالية' : 'Exercice'} ${yearFilter}`}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {data.building.buildingNumber} — {data.building.residenceName}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 no-print">
            {/* Year Selector */}
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              aria-label={lang === 'ar' ? 'اختيار السنة المالية' : 'Filtrer par exercice'}
              className="px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white cursor-pointer"
            >
              <option value="all">{lang === 'ar' ? 'كل السنوات' : 'Tous les exercices'}</option>
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsReportOpen(true);
                if (onPrintFinancialReport) {
                  // Report modal handles printable A4 cleanly
                }
              }}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? 'تقرير A4' : 'Bilan A4'}</span>
            </button>

            {canResetFinancials && (
              <button
                type="button"
                onClick={handleResetFinancials}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 border border-rose-200 dark:border-rose-900/50 rounded-xl cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'تصفير 0 دج' : 'Zéro comptable'}</span>
              </button>
            )}

            {canEdit && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setCloseYear(yearFilter !== 'all' ? yearFilter : String(new Date().getFullYear()));
                    setIsCloseExerciseOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 border border-amber-200 dark:border-amber-800 rounded-xl cursor-pointer"
                >
                  <CalendarCheck className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'إغلاق وترحيل السنة' : 'Clôturer Exercice'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsTransferOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/50 hover:bg-sky-100 border border-sky-200 dark:border-sky-800 rounded-xl cursor-pointer"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'تحويل بين الصندوقين' : 'Virement'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTxPreset(null);
                    setIsNewTxModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{lang === 'ar' ? 'عملية جديدة' : 'Nouvelle opération'}</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* 4 Executive KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
          {/* 1. Net Balance */}
          <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/50 flex flex-col justify-between gap-2">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5" />
                {t('netGlobalBalance')}
              </span>
              <div className="text-2xl font-black font-mono text-emerald-700 dark:text-emerald-300 mt-1 tabular-nums">
                {formatDZD(netBalance, lang)}
              </div>
            </div>
            <div className="pt-2 border-t border-emerald-200/50 dark:border-emerald-800/40 space-y-1 text-xs">
              <div className="flex items-center justify-between gap-2 font-mono tabular-nums">
                <span className="text-emerald-700/90 dark:text-emerald-400 whitespace-nowrap">
                  <ArrowUpRight className="w-3 h-3 inline" /> +{formatDZD(exerciseIncomes, lang)}
                </span>
                <span className="text-rose-600 dark:text-rose-400 font-semibold whitespace-nowrap">
                  <ArrowDownRight className="w-3 h-3 inline" /> -{formatDZD(operatingExpenses, lang)}
                </span>
              </div>
              {carryOverNet !== 0 && (
                <div className="text-[11px] font-mono font-semibold text-amber-700 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-950/50 px-2 py-0.5 rounded-md w-fit whitespace-nowrap">
                  {lang === 'ar' ? 'ترحيل رصيد 2025 :' : 'Report 2025 :'} {formatDZD(carryOverNet, lang)}
                </div>
              )}
            </div>
          </div>

          {/* 2. Courant Balance */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 flex flex-col justify-between gap-2">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-emerald-600" />
                  {t('currentFund')}
                </span>
                <span className="text-[11px] font-mono font-bold text-slate-500">{courantShare}%</span>
              </div>
              <div className="text-2xl font-black font-mono text-slate-900 dark:text-white mt-1 tabular-nums">
                {formatDZD(courantBalance, lang)}
              </div>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200/70 dark:border-slate-700/60">
              {lang === 'ar' ? 'نفقات التسيير اليومي والمصاعد' : 'Fonctionnement, ascenseurs & ménage'}
            </p>
          </div>

          {/* 3. Reserve Fund */}
          <div className="p-4 rounded-2xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200/70 dark:border-sky-800/50 flex items-center justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <span className="text-[11px] font-bold uppercase tracking-wider text-sky-800 dark:text-sky-300 flex items-center gap-1.5">
                <PiggyBank className="w-3.5 h-3.5" />
                {t('reserveFund')}
              </span>
              <div className="text-xl font-black font-mono text-sky-700 dark:text-sky-300 tabular-nums">
                {formatDZD(reserveBalance, lang)}
              </div>
              <p className="text-[11px] text-sky-700/80 dark:text-sky-400 truncate">
                {lang === 'ar' ? 'الهدف:' : 'Objectif :'} {formatDZD(reserveTarget, lang)}
              </p>
            </div>
            <CircularGauge percent={reserveProgress} colorClass="text-sky-600" size={58} />
          </div>

          {/* 4. Budget Execution */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-emerald-600" />
                {lang === 'ar' ? 'تنفيذ الميزانية' : 'Exécution Budget'}
              </span>
              <div className="text-xl font-black font-mono text-slate-900 dark:text-white tabular-nums">
                {formatDZD(totalBudgetActual, lang)}
              </div>
              <p className="text-[11px] text-slate-500 truncate">
                {lang === 'ar' ? 'المخطط:' : 'Voté :'} {formatDZD(totalBudgetPlanned, lang)}
                {overrunCount > 0 && (
                  <span className="ms-1.5 text-rose-600 font-bold">
                    ({overrunCount} {lang === 'ar' ? 'تجاوز' : 'dép.'})
                  </span>
                )}
              </p>
            </div>
            <CircularGauge
              percent={budgetExecRate}
              colorClass={budgetExecRate > 100 ? 'text-rose-500' : budgetExecRate >= 85 ? 'text-amber-500' : 'text-emerald-600'}
              size={58}
            />
          </div>
        </div>

        {/* Sub-Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 no-print">
          <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-xs">
            {[
              {
                id: 'overview' as const,
                icon: <PieChart className="w-3.5 h-3.5" />,
                label: lang === 'ar' ? 'الخلاصة والتدفقات' : 'Synthèse & Flux',
              },
              {
                id: 'ledger' as const,
                icon: <BookOpen className="w-3.5 h-3.5" />,
                label: `${lang === 'ar' ? 'السجل المحاسبي' : 'Grand Livre'} (${exerciseTransactions.length})`,
              },
              {
                id: 'budget' as const,
                icon: <BarChart3 className="w-3.5 h-3.5" />,
                label: lang === 'ar' ? 'الميزانية التقديرية' : `Budget Prévisionnel (${budgetPlan.length})`,
              },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSubTab(tab.id)}
                className={`px-3.5 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer ${
                  subTab === tab.id
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {missingAttachmentCount > 0 && subTab !== 'ledger' && (
            <button
              type="button"
              onClick={() => {
                setOnlyMissingAttachment(true);
                setFilterType('depense');
                setSubTab('ledger');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs font-semibold cursor-pointer"
            >
              <FileWarning className="w-3.5 h-3.5" />
              <span>
                {missingAttachmentCount}{' '}
                {lang === 'ar' ? 'مصروف بدون مستند إثبات' : 'dépense(s) sans justificatif'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* SUBTAB 1: OVERVIEW & RECONCILIATION */}
      {subTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {lang === 'ar' ? 'التدفقات الشهرية (مداخيل / مصاريف)' : 'Flux Mensuels de Trésorerie (Recettes vs Dépenses)'}
                </h3>
                <span className="text-[11px] text-slate-400">
                  {lang === 'ar' ? 'باستثناء التحويلات الداخلية' : 'Hors virements internes'}
                </span>
              </div>
              {cashflowPoints.length === 0 ? (
                <EmptyState
                  icon={<BarChart3 className="w-7 h-7" />}
                  title={lang === 'ar' ? 'لا توجد تدفقات في هذه الفترة' : 'Aucun flux enregistré sur cette période'}
                />
              ) : (
                <CashflowBarChart points={cashflowPoints} />
              )}
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white pb-3 border-b border-slate-100 dark:border-slate-800">
                {lang === 'ar' ? 'توزيع المصاريف حسب الفئة' : 'Répartition des dépenses'}
              </h3>
              <DonutChart
                slices={donutSlices}
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
          </div>

          {/* 1-Click Recurring Expenses Strip */}
          {canEdit && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print">
              <div className="flex items-center gap-2 text-xs">
                <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {lang === 'ar' ? 'تسجيل المصاريف الثابتة بنقرة واحدة :' : 'Charges fixes récurrentes en 1 clic :'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {[
                  {
                    label: lang === 'ar' ? 'عون النظافة' : 'Ménage mensuel',
                    icon: <Sparkles className="w-3.5 h-3.5 text-emerald-600" />,
                    preset: {
                      type: 'depense' as const,
                      fund: 'courant' as const,
                      category: 'Agent de Ménage & Entretien' as const,
                      amountDZD: 10000,
                      description: `Agent d'entretien & nettoyage paliers (${new Date().toISOString().slice(0, 7)})`,
                      paymentMethod: 'Espèces' as const,
                    },
                  },
                  {
                    label: lang === 'ar' ? 'فاتورة سونلغاز' : 'Facture Sonelgaz',
                    icon: <Zap className="w-3.5 h-3.5 text-amber-500" />,
                    preset: {
                      type: 'depense' as const,
                      fund: 'courant' as const,
                      category: 'Facture Électricité Sonelgaz' as const,
                      amountDZD: 12000,
                      description: 'Facture Sonelgaz — Éclairage parties communes & surpresseur',
                      paymentMethod: 'Espèces' as const,
                    },
                  },
                  {
                    label: lang === 'ar' ? 'عقد المصاعد' : 'Contrat Ascenseurs',
                    icon: <Layers className="w-3.5 h-3.5 text-sky-600" />,
                    preset: {
                      type: 'depense' as const,
                      fund: 'courant' as const,
                      category: 'Maintenance Ascenseurs' as const,
                      amountDZD: 12000,
                      description: `Redevance contrat maintenance des 2 ascenseurs (${new Date().toISOString().slice(0, 7)})`,
                      paymentMethod: 'Espèces' as const,
                    },
                  },
                  {
                    label: lang === 'ar' ? 'خزان المياه والمضخة' : 'Bâche à eau / Pompe',
                    icon: <Droplet className="w-3.5 h-3.5 text-cyan-600" />,
                    preset: {
                      type: 'depense' as const,
                      fund: 'courant' as const,
                      category: 'Réparation Bâche à Eau / Surpresseur' as const,
                      amountDZD: 8000,
                      description: 'Entretien / fournitures groupe surpresseur & bâche à eau',
                      paymentMethod: 'Espèces' as const,
                    },
                  },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      setTxPreset(item.preset);
                      setIsNewTxModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-slate-200 dark:border-slate-700 hover:border-emerald-300 font-semibold text-slate-700 dark:text-slate-200 cursor-pointer transition-colors"
                  >
                    {item.icon}
                    <span>+ {item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Direct Expense Management List on Overview */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ArrowDownRight className="w-4 h-4 text-rose-600" />
                  <span>
                    {lang === 'ar'
                      ? `سجل المصاريف المسجلة (${expenseRecords.length})`
                      : `Dépenses enregistrées (${expenseRecords.length})`}
                  </span>
                  {exerciseExpenses > 0 && (
                    <span className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400">
                      — {formatDZD(exerciseExpenses, lang)}
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {lang === 'ar'
                    ? 'يمكنك تعديل أو حذف أي مصروف مباشرة من هذه القائمة.'
                    : 'Modifiez ou supprimez directement une dépense ou un report comptable.'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 no-print">
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => setIsNewTxModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'تسجيل مصروف' : 'Ajouter une dépense'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSubTab('ledger')}
                  className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  {lang === 'ar' ? 'فتح السجل الكامل ←' : 'Voir le Grand Livre →'}
                </button>
              </div>
            </div>

            {expenseRecords.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                {lang === 'ar'
                  ? 'لا توجد مصاريف مسجلة في هذه الفترة.'
                  : 'Aucune dépense enregistrée sur cette période.'}
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {expenseRecords.map((tx) => {
                  const isCarryOver = isCarryOverTransaction(tx);
                  return (
                    <div
                      key={tx.id}
                      onClick={() => setSelectedTx(tx)}
                      className="py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 rounded-xl px-2 -mx-2 transition-colors cursor-pointer text-xs"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 dark:text-white">{tx.description}</span>
                          {isCarryOver && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                              {lang === 'ar' ? 'ترحيل سابق' : 'Report antérieur'}
                            </span>
                          )}
                          {tx.attachmentDataUrl && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                              <Paperclip className="w-3 h-3" />
                              {lang === 'ar' ? 'مرفق' : 'Justificatif'}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          <span className="font-mono">{formatShortDate(tx.date, lang)}</span> ·{' '}
                          {getCategoryLabel(tx.category, lang)} · {getPaymentMethodLabel(tx.paymentMethod, lang)}
                          {tx.referenceDoc ? ` · ${tx.referenceDoc}` : ''}
                        </div>
                      </div>

                      <div
                        className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="font-mono font-extrabold text-sm text-rose-600 dark:text-rose-400 tabular-nums whitespace-nowrap">
                          - {formatDZD(tx.amountDZD, lang)}
                        </span>
                        {canEdit && (
                          <div className="flex items-center gap-1.5 no-print">
                            <button
                              type="button"
                              onClick={() => setEditingTx(tx)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 rounded-lg border border-amber-200 dark:border-amber-800 cursor-pointer"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>{t('edit')}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteTx(tx)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 rounded-lg border border-rose-200 dark:border-rose-800 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>{lang === 'ar' ? 'حذف' : 'Supprimer'}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Payment Method Reconciliation + Vigilance */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {lang === 'ar' ? 'توزيع الأرصدة حسب وسيلة الدفع' : 'Ventilation des Soldes par Canal'}
                  </h3>
                </div>
                <span className="text-[11px] text-slate-400">
                  {lang === 'ar' ? 'جرد الصندوق النقدي / CCP' : 'Pointage Espèces / CCP'}
                </span>
              </div>

              <div className="space-y-2.5 text-xs">
                {paymentMethodStats.map((item) => (
                  <div
                    key={item.method}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2"
                  >
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white block">
                        {getPaymentMethodLabel(item.method, lang)}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {item.count} {lang === 'ar' ? 'عملية' : 'opération(s)'}
                      </span>
                    </div>
                    <span
                      className={`font-mono font-extrabold text-sm tabular-nums ${
                        item.net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'
                      }`}
                    >
                      {formatDZD(item.net, lang)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {lang === 'ar' ? 'نقاط المراقبة والميزانية' : 'Alertes Budgétaires & Contrôle'}
                  </h3>
                </div>
                <button
                  onClick={() => setSubTab('budget')}
                  className="text-xs font-semibold text-emerald-600 hover:underline cursor-pointer"
                >
                  {lang === 'ar' ? 'إدارة الميزانية' : 'Gérer le budget'}
                </button>
              </div>

              {budgetAlerts.length === 0 ? (
                <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-900/50 text-xs text-emerald-800 dark:text-emerald-300 font-medium">
                  {lang === 'ar'
                    ? 'جميع بنود الميزانية ضمن السقف المحدد.'
                    : 'Tous les postes budgétaires respectent le plafond voté (< 85%).'}
                </div>
              ) : (
                <div className="space-y-2.5 text-xs">
                  {budgetAlerts.map((al) => {
                    const over = al.actual > al.plannedAnnualDZD && al.plannedAnnualDZD > 0;
                    return (
                      <div
                        key={al.category}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                          over
                            ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/60'
                            : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/60'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 dark:text-white truncate">
                            {getCategoryLabel(al.category, lang)}
                          </div>
                          <div className="text-[11px] font-mono text-slate-600 dark:text-slate-300 mt-0.5">
                            {formatDZD(al.actual, lang)} / {formatDZD(al.plannedAnnualDZD, lang)}
                          </div>
                        </div>
                        <span
                          className={`font-mono font-extrabold px-2 py-1 rounded-lg text-xs shrink-0 ${
                            over ? 'bg-rose-600 text-white' : 'bg-amber-500 text-white'
                          }`}
                        >
                          {al.pct}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: GENERAL LEDGER */}
      {subTab === 'ledger' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
          {/* Rich Filter Bar */}
          <div className="flex flex-wrap items-center gap-2.5 text-xs no-print">
            <div className="relative grow min-w-[200px] max-w-xs">
              <Search className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={lang === 'ar' ? 'بحث بالبيان أو المرجع...' : 'Libellé, N° facture...'}
                className="w-full ps-9 pe-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
              {[
                { id: 'all' as const, label: lang === 'ar' ? 'الكل' : 'Tous' },
                { id: 'recette' as const, label: lang === 'ar' ? 'المداخيل' : 'Recettes' },
                { id: 'depense' as const, label: lang === 'ar' ? 'المصاريف' : 'Dépenses' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setFilterType(item.id)}
                  className={`px-3 py-1 rounded-lg font-semibold cursor-pointer ${
                    filterType === item.id
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
              {[
                { id: 'all' as const, label: lang === 'ar' ? 'كل الصناديق' : 'Tous fonds' },
                { id: 'courant' as const, label: lang === 'ar' ? 'جاري' : 'Courant' },
                { id: 'reserve' as const, label: lang === 'ar' ? 'احتياط' : 'Réserve' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setFilterFund(item.id)}
                  className={`px-3 py-1 rounded-lg font-semibold cursor-pointer ${
                    filterFund === item.id
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            >
              <option value="all">{lang === 'ar' ? 'كل البنود' : 'Toutes catégories'}</option>
              {[...new Set([...EXPENSE_CATEGORIES, 'Cotisations Copropriétaires', 'Dotation Fonds de Réserve'])].map(
                (cat) => (
                  <option key={cat} value={cat}>
                    {getCategoryLabel(cat as TransactionCategory, lang)}
                  </option>
                )
              )}
            </select>

            <select
              value={filterMethod}
              onChange={(e) => setFilterMethod(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            >
              <option value="all">{lang === 'ar' ? 'كل وسائل الدفع' : 'Tous modes'}</option>
              {ALL_PAYMENT_METHODS.map((pm) => (
                <option key={pm} value={pm}>
                  {getPaymentMethodLabel(pm, lang)}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setOnlyMissingAttachment((p) => !p)}
              className={`px-3 py-2 rounded-xl font-semibold border cursor-pointer ${
                onlyMissingAttachment
                  ? 'bg-amber-500 text-white border-amber-500'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
            >
              {lang === 'ar' ? 'بدون مستند' : 'Sans justificatif'}
            </button>
          </div>

          {filteredTransactions.length === 0 ? (
            <EmptyState
              icon={<Wallet className="w-7 h-7" />}
              title={lang === 'ar' ? 'لا توجد عمليات مطابقة' : 'Aucune opération trouvée'}
              description={lang === 'ar' ? 'غيّر فلاتر البحث أو أضف عملية جديدة.' : 'Modifiez les filtres ou enregistrez une opération.'}
            />
          ) : (
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
              <table className="w-full text-start text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">{lang === 'ar' ? 'التاريخ' : 'Date'}</th>
                    <th className="py-3 px-4">{lang === 'ar' ? 'البيان والفئة' : 'Libellé & Poste'}</th>
                    <th className="py-3 px-4">{lang === 'ar' ? 'الصندوق' : 'Fonds'}</th>
                    <th className="py-3 px-4">{lang === 'ar' ? 'المستند' : 'Justif.'}</th>
                    <th className="py-3 px-4 text-end">{lang === 'ar' ? 'المبلغ' : 'Montant'}</th>
                    <th className="py-3 px-4 text-end">{lang === 'ar' ? 'الرصيد التراكمي' : 'Solde cumulé'}</th>
                    {canEdit && <th className="py-3 px-4 text-end no-print" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {filteredTransactions.map((tx) => {
                    const isIncome = tx.type === 'recette';
                    const isTransfer = isInternalTransfer(tx);
                    const cumBalance = runningBalances.get(tx.id) ?? 0;

                    return (
                      <tr
                        key={tx.id}
                        onClick={() => setSelectedTx(tx)}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer"
                      >
                        <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">
                          {formatShortDate(tx.date, lang)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                            <span>{tx.description}</span>
                            {isTransfer && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 font-bold">
                                {lang === 'ar' ? 'تحويل داخلي' : 'Virement'}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {getCategoryLabel(tx.category, lang)} · {getPaymentMethodLabel(tx.paymentMethod, lang)}
                            {tx.referenceDoc ? ` · ${tx.referenceDoc}` : ''}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              getTxFund(tx) === 'reserve'
                                ? 'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300'
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                          >
                            {getTxFund(tx) === 'reserve'
                              ? lang === 'ar'
                                ? 'احتياط'
                                : 'Réserve'
                              : lang === 'ar'
                              ? 'جاري'
                              : 'Courant'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {tx.attachmentDataUrl ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                              <Paperclip className="w-3.5 h-3.5" />
                              <span className="truncate max-w-[120px]">{tx.attachmentName || t('viewAttachment')}</span>
                            </span>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600">—</span>
                          )}
                        </td>
                        <td
                          className={`py-3 px-4 text-end font-mono font-bold tabular-nums whitespace-nowrap ${
                            isIncome ? 'text-emerald-600' : 'text-rose-600'
                          }`}
                        >
                          {isIncome ? '+' : '-'} {formatDZD(tx.amountDZD, lang)}
                        </td>
                        <td className="py-3 px-4 text-end font-mono font-semibold text-slate-700 dark:text-slate-300 tabular-nums whitespace-nowrap">
                          {formatDZD(cumBalance, lang)}
                        </td>
                        {canEdit && (
                          <td
                            className="py-3 px-4 text-end no-print whitespace-nowrap"
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                          >
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setEditingTx(tx)}
                                className="p-1.5 text-amber-600 hover:text-amber-700 dark:text-amber-400 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950/40 cursor-pointer"
                                title={t('edit')}
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteTx(tx)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                                title={lang === 'ar' ? 'حذف' : 'Supprimer'}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-100/90 dark:bg-slate-800/90 border-t border-slate-200 dark:border-slate-700 font-bold text-xs">
                  <tr>
                    <td colSpan={4} className="py-3 px-4 text-slate-700 dark:text-slate-200">
                      {lang === 'ar'
                        ? `مجموع التحديد (${filteredTransactions.length} عملية)`
                        : `Total sélection (${filteredTransactions.length} écritures)`}
                    </td>
                    <td className="py-3 px-4 text-end font-mono tabular-nums whitespace-nowrap">
                      <span className="text-emerald-600">+{formatDZD(filteredTotals.incomes, lang)}</span>
                      <span className="mx-1 text-slate-400">/</span>
                      <span className="text-rose-600">-{formatDZD(filteredTotals.expenses, lang)}</span>
                    </td>
                    <td
                      className={`py-3 px-4 text-end font-mono tabular-nums whitespace-nowrap ${
                        filteredTotals.net >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600'
                      }`}
                    >
                      {formatDZD(filteredTotals.net, lang)}
                    </td>
                    {canEdit && <td className="no-print" />}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 3: ANNUAL BUDGET WORKBENCH */}
      {subTab === 'budget' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-emerald-600" />
                <span>{lang === 'ar' ? 'الميزانية السنوية التقديرية ومراقبة الانحرافات' : 'Budget Prévisionnel Annuel & Suivi des Écarts'}</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {lang === 'ar'
                  ? 'قارن المصاريف الفعلية بالميزانية المعتمدة وأضف أو عدّل البنود.'
                  : 'Comparez le réalisé aux plafonds votés, ajustez les enveloppes ou ajoutez un poste.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 no-print">
              <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-xs">
                {[
                  { id: 'all' as const, label: lang === 'ar' ? 'الكل' : 'Tous' },
                  { id: 'courant' as const, label: lang === 'ar' ? 'جاري' : 'Courant' },
                  { id: 'reserve' as const, label: lang === 'ar' ? 'احتياط' : 'Réserve' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setBudgetFundFilter(f.id)}
                    className={`px-3 py-1 rounded-lg font-semibold cursor-pointer ${
                      budgetFundFilter === f.id
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {canEdit && !isEditingBudget && (
                <>
                  {budgetPlan.length === 0 && (
                    <button
                      type="button"
                      onClick={handleLoadDefaultTemplate}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{lang === 'ar' ? 'تحميل نموذج AADL' : 'Charger modèle AADL'}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleOpenBudgetEdit}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>{t('edit')}</span>
                  </button>
                </>
              )}

              {canEdit && isEditingBudget && (
                <>
                  <button
                    type="button"
                    onClick={() => setIsEditingBudget(false)}
                    className="px-3 py-1.5 text-xs text-slate-500 cursor-pointer"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveBudget}
                    className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{t('saveBudget')}</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* 4 Budget Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
              <span className="text-slate-400 block">{lang === 'ar' ? 'إجمالي الميزانية المصادق عليها' : 'Budget Voté Total'}</span>
              <strong className="text-base font-mono font-black text-slate-900 dark:text-white mt-0.5 block">
                {formatDZD(totalBudgetPlanned, lang)}
              </strong>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
              <span className="text-slate-400 block">{lang === 'ar' ? 'المصروف الفعلي' : 'Réalisé'}</span>
              <strong className="text-base font-mono font-black text-slate-900 dark:text-white mt-0.5 block">
                {formatDZD(totalBudgetActual, lang)}
              </strong>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
              <span className="text-slate-400 block">{lang === 'ar' ? 'الرصيد المتبقي' : 'Disponible / Écart'}</span>
              <strong
                className={`text-base font-mono font-black mt-0.5 block ${
                  totalBudgetPlanned - totalBudgetActual >= 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {formatDZD(totalBudgetPlanned - totalBudgetActual, lang)}
              </strong>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
              <span className="text-slate-400 block">{lang === 'ar' ? 'بنود متجاوزة' : 'Postes en dépassement'}</span>
              <strong className={`text-base font-mono font-black mt-0.5 block ${overrunCount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {overrunCount}
              </strong>
            </div>
          </div>

          {/* Add Budget Line Tool in Edit Mode */}
          {canEdit && isEditingBudget && availableCategoriesToAdd.length > 0 && (
            <div className="p-3.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/50 flex flex-wrap items-center gap-2.5 text-xs">
              <select
                value={newBudgetCat}
                onChange={(e) => setNewBudgetCat(e.target.value as TransactionCategory)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white grow max-w-sm"
              >
                {availableCategoriesToAdd.map((cat) => (
                  <option key={cat} value={cat}>
                    {getCategoryLabel(cat, lang)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleAddBudgetLine}
                className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'إضافة بند' : 'Ajouter ce poste'}</span>
              </button>
            </div>
          )}

          {visibleBudgetItems.length === 0 ? (
            <EmptyState
              icon={<BarChart3 className="w-7 h-7" />}
              title={lang === 'ar' ? 'لا توجد بنود ميزانية مسجلة' : 'Aucune ligne budgétaire'}
              action={
                canEdit ? (
                  <button
                    type="button"
                    onClick={handleLoadDefaultTemplate}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{lang === 'ar' ? 'إنشاء ميزانية AADL نموذجية' : 'Générer le budget type AADL'}</span>
                  </button>
                ) : undefined
              }
            />
          ) : (
            <div className="space-y-3.5">
              {visibleBudgetItems.map((item) => {
                const draftIndex = budgetDraft.findIndex((b) => b.category === item.category);
                const actual = expenseByCategory[item.category] || 0;
                const remaining = item.plannedAnnualDZD - actual;
                const ratio = item.plannedAnnualDZD > 0 ? Math.round((actual / item.plannedAnnualDZD) * 100) : 0;
                const isOver = actual > item.plannedAnnualDZD && item.plannedAnnualDZD > 0;

                return (
                  <div
                    key={item.category}
                    className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 space-y-2 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {getCategoryLabel(item.category, lang)}
                        </span>
                        {isEditingBudget && draftIndex >= 0 ? (
                          <select
                            value={budgetDraft[draftIndex].fund}
                            onChange={(e) => {
                              const next = [...budgetDraft];
                              next[draftIndex] = { ...next[draftIndex], fund: e.target.value as TransactionFund };
                              setBudgetDraft(next);
                            }}
                            className="px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px]"
                          >
                            <option value="courant">{lang === 'ar' ? 'جاري' : 'Courant'}</option>
                            <option value="reserve">{lang === 'ar' ? 'احتياط' : 'Réserve'}</option>
                          </select>
                        ) : (
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              item.fund === 'reserve'
                                ? 'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300'
                                : 'bg-slate-200/70 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {item.fund === 'reserve'
                              ? lang === 'ar'
                                ? 'احتياط'
                                : 'Réserve'
                              : lang === 'ar'
                              ? 'جاري'
                              : 'Courant'}
                          </span>
                        )}
                      </div>

                      {isEditingBudget && draftIndex >= 0 ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            step={500}
                            value={budgetDraft[draftIndex].plannedAnnualDZD}
                            onChange={(e) => {
                              const next = [...budgetDraft];
                              next[draftIndex] = {
                                ...next[draftIndex],
                                plannedAnnualDZD: Number(e.target.value) || 0,
                              };
                              setBudgetDraft(next);
                            }}
                            className="w-32 px-2.5 py-1 text-end font-mono font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                          />
                          <button
                            type="button"
                            onClick={() => setBudgetDraft((prev) => prev.filter((b) => b.category !== item.category))}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                            title={lang === 'ar' ? 'حذف البند' : 'Supprimer ce poste'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2 font-mono tabular-nums">
                          <span className={`font-bold ${isOver ? 'text-rose-600' : 'text-slate-900 dark:text-white'}`}>
                            {formatDZD(actual, lang)}
                          </span>
                          <span className="text-slate-400">/ {formatDZD(item.plannedAnnualDZD, lang)}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              remaining < 0
                                ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                                : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                            }`}
                          >
                            {remaining >= 0
                              ? `${lang === 'ar' ? 'متبقي' : 'Reste'} ${formatDZD(remaining, lang)}`
                              : `${lang === 'ar' ? 'تجاوز' : 'Dépassé'} ${formatDZD(Math.abs(remaining), lang)}`}
                          </span>
                          <span
                            className={`w-10 text-end font-bold ${
                              isOver ? 'text-rose-600' : ratio >= 85 ? 'text-amber-600' : 'text-emerald-600'
                            }`}
                          >
                            {ratio}%
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="w-full bg-slate-200/80 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isOver ? 'bg-rose-500' : ratio >= 85 ? 'bg-amber-500' : item.fund === 'reserve' ? 'bg-sky-500' : 'bg-emerald-600'
                        }`}
                        style={{ width: `${Math.min(100, ratio)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Transaction Detail & Attachment Drawer */}
      <SlideOverDrawer
        open={Boolean(selectedTx)}
        onClose={() => setSelectedTx(null)}
        title={selectedTx?.description}
        subtitle={
          selectedTx
            ? `${formatShortDate(selectedTx.date, lang)} · ${getCategoryLabel(selectedTx.category, lang)}`
            : undefined
        }
      >
        {selectedTx && (
          <div className="space-y-5 text-xs">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-400 block">
                  {selectedTx.type === 'recette'
                    ? lang === 'ar'
                      ? 'مدخول مالي'
                      : 'Recette encaissée'
                    : lang === 'ar'
                    ? 'مصروف مالي'
                    : 'Dépense réglée'}
                </span>
                <div
                  className={`text-2xl font-black font-mono mt-0.5 ${
                    selectedTx.type === 'recette' ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {selectedTx.type === 'recette' ? '+' : '-'} {formatDZD(selectedTx.amountDZD, lang)}
                </div>
              </div>
              <span
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                  getTxFund(selectedTx) === 'reserve'
                    ? 'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300'
                    : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                }`}
              >
                {getTxFund(selectedTx) === 'reserve' ? t('reserveFund') : t('currentFund')}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                <span className="text-[11px] text-slate-400 block">{t('paymentMethodLabel')}</span>
                <strong className="text-slate-900 dark:text-white mt-0.5 block">
                  {getPaymentMethodLabel(selectedTx.paymentMethod, lang)}
                </strong>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                <span className="text-[11px] text-slate-400 block">
                  {lang === 'ar' ? 'المرجع' : 'Référence'}
                </span>
                <strong className="font-mono text-slate-900 dark:text-white mt-0.5 block">
                  {selectedTx.referenceDoc || '—'}
                </strong>
              </div>
            </div>

            {selectedTx.attachmentDataUrl && (
              <div className="space-y-2">
                <div className="font-bold text-slate-700 dark:text-slate-300">
                  {selectedTx.attachmentName || t('viewAttachment')}
                </div>
                <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 flex justify-center">
                  {isImageUrl(selectedTx.attachmentDataUrl) ? (
                    <img
                      src={selectedTx.attachmentDataUrl}
                      alt={selectedTx.attachmentName || 'justificatif'}
                      className="max-h-80 rounded object-contain"
                    />
                  ) : (
                    <a
                      href={selectedTx.attachmentDataUrl}
                      target="_blank"
                      rel="noreferrer"
                      download={selectedTx.attachmentName || 'justificatif.pdf'}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white font-semibold rounded-lg"
                    >
                      <Paperclip className="w-4 h-4" />
                      <span>{selectedTx.attachmentName || t('viewAttachment')}</span>
                    </a>
                  )}
                </div>
              </div>
            )}

            {canEdit && (
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setEditingTx(selectedTx);
                    setSelectedTx(null);
                  }}
                  className="w-full py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60 font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Edit3 className="w-4 h-4" />
                  <span>{lang === 'ar' ? 'تعديل هذه العملية' : 'Modifier cette opération'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteTx(selectedTx)}
                  className="w-full py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{lang === 'ar' ? 'حذف هذه العملية' : 'Supprimer cette opération'}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </SlideOverDrawer>

      {/* Modals */}
      {isNewTxModalOpen && canEdit && (
        <TransactionModal
          courantBalance={courantBalance}
          reserveBalance={reserveBalance}
          initialPreset={txPreset}
          onClose={() => {
            setIsNewTxModalOpen(false);
            setTxPreset(null);
          }}
          onSubmit={addTransaction}
        />
      )}

      {isCloseExerciseOpen && canEdit && (() => {
        const yrTxs = data.transactions.filter(
          (tx) => (tx.date || '').startsWith(closeYear) && !isInternalTransfer(tx)
        );
        const yrInc = yrTxs.filter((tx) => tx.type === 'recette').reduce((s, tx) => s + tx.amountDZD, 0);
        const yrExp = yrTxs.filter((tx) => tx.type === 'depense').reduce((s, tx) => s + tx.amountDZD, 0);
        const yrNet = yrInc - yrExp;
        const nextYr = String(Number(closeYear) + 1);
        const existingRan = data.transactions.find(
          (tx) => tx.id === `tx-ran-${closeYear}` || tx.referenceDoc === `RAN-${closeYear}`
        );

        return (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 no-print">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <CalendarCheck className="w-5 h-5 text-amber-600" />
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {lang === 'ar' ? 'إغلاق وترحيل السنة المالية' : "Clôture & Report d'Exercice"}
                  </h3>
                </div>
                <button onClick={() => setIsCloseExerciseOpen(false)} className="p-1 text-slate-400 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {lang === 'ar' ? 'اختر السنة المالية المراد إغلاقها' : 'Exercice à clôturer'}
                </label>
                <select
                  value={closeYear}
                  onChange={(e) => setCloseYear(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                >
                  {availableYears.map((yr) => (
                    <option key={yr} value={yr}>
                      Exercice {yr} → Report sur {Number(yr) + 1}
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Recettes {closeYear} :</span>
                  <span className="font-mono font-bold text-emerald-600">+{formatDZD(yrInc, lang)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Dépenses & Reports {closeYear} :</span>
                  <span className="font-mono font-bold text-rose-600">-{formatDZD(yrExp, lang)}</span>
                </div>
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between text-sm font-bold">
                  <span>Solde à reporter au 01/01/{nextYr} :</span>
                  <span className={`font-mono ${yrNet >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {yrNet >= 0 ? '+' : ''}
                    {formatDZD(yrNet, lang)}
                  </span>
                </div>
              </div>

              {existingRan && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300">
                  Un report <strong>RAN-{closeYear}</strong> existe déjà : il sera mis à jour automatiquement sans créer de doublon.
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCloseExerciseOpen(false)}
                  className="px-4 py-2 text-slate-500 cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button
                  type="button"
                  disabled={yrNet === 0}
                  onClick={async () => {
                    const ranTx: Transaction = {
                      id: existingRan?.id || `tx-ran-${closeYear}`,
                      date: `${nextYr}-01-01`,
                      type: yrNet >= 0 ? 'recette' : 'depense',
                      fund: 'courant',
                      category: 'Report à Nouveau (Solde Antérieur)',
                      amountDZD: Math.abs(yrNet),
                      description: `Report à nouveau de l'exercice ${closeYear} (${yrNet >= 0 ? 'Excédent' : 'Solde débiteur'})`,
                      referenceDoc: `RAN-${closeYear}`,
                      paymentMethod: 'Autre',
                    };
                    if (existingRan) {
                      await updateTransaction(ranTx);
                    } else {
                      await addTransaction(ranTx);
                    }
                    setYearFilter(nextYr);
                    setIsCloseExerciseOpen(false);
                  }}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold cursor-pointer"
                >
                  Reporter sur {nextYr}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {editingTx && canEdit && (
        <TransactionModal
          courantBalance={courantBalance}
          reserveBalance={reserveBalance}
          initialTransaction={editingTx}
          onClose={() => setEditingTx(null)}
          onSubmit={async (updated) => {
            await updateTransaction(updated);
            setEditingTx(null);
          }}
        />
      )}

      {isTransferOpen && canEdit && (
        <TransferFundModal
          courantBalance={courantBalance}
          reserveBalance={reserveBalance}
          onClose={() => setIsTransferOpen(false)}
          onTransfer={handleTransfer}
        />
      )}

      <FinancialReportModal
        open={isReportOpen}
        yearFilter={yearFilter}
        building={data.building}
        transactions={data.transactions}
        budgetPlan={budgetPlan}
        onClose={() => setIsReportOpen(false)}
      />
    </div>
  );
};
