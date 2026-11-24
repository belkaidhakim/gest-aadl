import React from 'react';
import { Printer, X, FileSpreadsheet } from 'lucide-react';
import { BudgetAllocation, BuildingInfo, Transaction } from '../../types';
import { formatDZD, formatDateFr, formatShortDate } from '../../utils/helpers';
import { useI18n } from '../../i18n';
import {
  ALL_PAYMENT_METHODS,
  getCategoryLabel,
  getPaymentMethodLabel,
  isInternalTransfer,
} from './treasuryHelpers';

interface FinancialReportModalProps {
  open: boolean;
  yearFilter: string;
  building: BuildingInfo;
  transactions: Transaction[];
  budgetPlan: BudgetAllocation[];
  onClose: () => void;
}

export const FinancialReportModal: React.FC<FinancialReportModalProps> = ({
  open,
  yearFilter,
  building,
  transactions,
  budgetPlan,
  onClose,
}) => {
  const { lang, t } = useI18n();
  if (!open) return null;

  const scopeTransactions = transactions
    .filter((tx) => yearFilter === 'all' || (tx.date || '').startsWith(yearFilter))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const externalScope = scopeTransactions.filter((tx) => !isInternalTransfer(tx));
  const totalScopeIncome = externalScope.filter((t) => t.type === 'recette').reduce((a, t) => a + t.amountDZD, 0);
  const totalScopeExpense = externalScope.filter((t) => t.type === 'depense').reduce((a, t) => a + t.amountDZD, 0);

  const globalCourant =
    transactions.filter((tx) => (tx.fund || 'courant') === 'courant' && tx.type === 'recette').reduce((a, t) => a + t.amountDZD, 0) -
    transactions.filter((tx) => (tx.fund || 'courant') === 'courant' && tx.type === 'depense').reduce((a, t) => a + t.amountDZD, 0);

  const globalReserve =
    transactions.filter((tx) => tx.fund === 'reserve' && tx.type === 'recette').reduce((a, t) => a + t.amountDZD, 0) -
    transactions.filter((tx) => tx.fund === 'reserve' && tx.type === 'depense').reduce((a, t) => a + t.amountDZD, 0);

  const globalNet = globalCourant + globalReserve;

  const expenseByCategory: Record<string, number> = {};
  externalScope
    .filter((tx) => tx.type === 'depense')
    .forEach((tx) => {
      expenseByCategory[tx.category] = (expenseByCategory[tx.category] || 0) + tx.amountDZD;
    });

  const totalBudgetPlanned = budgetPlan.reduce((a, b) => a + b.plannedAnnualDZD, 0);
  const totalBudgetActual = budgetPlan.reduce((a, b) => a + (expenseByCategory[b.category] || 0), 0);

  const paymentMethodBalances = ALL_PAYMENT_METHODS.map((method) => {
    const net = transactions
      .filter((tx) => tx.paymentMethod === method)
      .reduce((acc, tx) => acc + (tx.type === 'recette' ? tx.amountDZD : -tx.amountDZD), 0);
    return { method, net };
  }).filter((item) => item.net !== 0 || item.method === 'Espèces' || item.method === 'Virement CCP');

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto print:static print:bg-transparent print:p-0 print:block">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-6 my-8 print:border-none print:shadow-none print:p-0 print:my-0 print:max-w-none">
        {/* Controls (no-print) */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 no-print">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {lang === 'ar'
                ? 'التقرير المالي وتنفيذ الميزانية (A4)'
                : "Bilan Financier & Exécution Budgétaire (A4)"}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>{t('printA4')}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable A4 Sheet */}
        <div className="p-6 sm:p-8 bg-white text-slate-900 border border-slate-300 rounded-xl print-card print:border-none print:p-0 space-y-6 text-xs">
          {/* Republic & Syndic Header */}
          <div className="border-b-2 border-slate-900 pb-4 text-center space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">{t('republicHeader')}</p>
            <h1 className="text-xl font-black tracking-tight text-slate-900">{t('syndicOfficialHeader')}</h1>
            <p className="text-sm font-bold text-slate-700">
              {building.residenceName} — {building.buildingNumber}
            </p>
            <p className="text-xs text-slate-500">
              {building.wilaya} · {building.gestImmoAgency}
            </p>
          </div>

          <div className="text-center bg-slate-100 p-3 rounded border border-slate-200">
            <h2 className="text-base font-black uppercase text-slate-900">
              {lang === 'ar'
                ? `التقرير المالي الرسمي — ${yearFilter === 'all' ? 'الوضعية الشاملة' : `السنة المالية ${yearFilter}`}`
                : `ÉTAT FINANCIER & CAISSE — ${yearFilter === 'all' ? 'CUMUL GLOBAL' : `EXERCICE ${yearFilter}`}`}
            </h2>
          </div>

          {/* Section I: Treasury Balances */}
          <div className="space-y-3">
            <h3 className="font-bold uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-1">
              {lang === 'ar' ? 'أولاً: أرصدة الصندوق عند الإقفال' : 'I. Situation de Trésorerie & Soldes'}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 border border-slate-300 rounded bg-slate-50">
                <span className="text-[11px] text-slate-500 block">{t('netGlobalBalance')}</span>
                <strong className="text-sm font-mono font-black text-slate-900">{formatDZD(globalNet, lang)}</strong>
              </div>
              <div className="p-3 border border-slate-300 rounded">
                <span className="text-[11px] text-slate-500 block">{t('currentFund')}</span>
                <strong className="text-sm font-mono font-bold text-slate-900">{formatDZD(globalCourant, lang)}</strong>
              </div>
              <div className="p-3 border border-slate-300 rounded">
                <span className="text-[11px] text-slate-500 block">{t('reserveFund')}</span>
                <strong className="text-sm font-mono font-bold text-slate-900">{formatDZD(globalReserve, lang)}</strong>
              </div>
              <div className="p-3 border border-slate-300 rounded">
                <span className="text-[11px] text-slate-500 block">
                  {lang === 'ar' ? 'تدفقات الفترة (مداخيل / مصاريف)' : 'Flux période (Entrées / Sorties)'}
                </span>
                <div className="font-mono font-bold text-[11px] mt-0.5">
                  <span className="text-emerald-700">+{formatDZD(totalScopeIncome, lang)}</span>
                  {' / '}
                  <span className="text-rose-700">-{formatDZD(totalScopeExpense, lang)}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 text-[11px] pt-1">
              {paymentMethodBalances.map((item) => (
                <div key={item.method} className="px-2.5 py-1 rounded border border-slate-300 bg-slate-50">
                  <span className="text-slate-600">{getPaymentMethodLabel(item.method, lang)} : </span>
                  <strong className="font-mono text-slate-900">{formatDZD(item.net, lang)}</strong>
                </div>
              ))}
            </div>
          </div>

          {/* Section II: Budget vs Actual */}
          <div className="space-y-2">
            <h3 className="font-bold uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-1">
              {lang === 'ar' ? 'ثانياً: تنفيذ الميزانية التقديرية' : 'II. Exécution du Budget Prévisionnel'}
            </h3>
            <div className="border border-slate-300 rounded overflow-hidden">
              <table className="w-full text-start text-[11px]">
                <thead className="bg-slate-100 border-b border-slate-300 font-bold">
                  <tr>
                    <th className="py-2 px-3">{lang === 'ar' ? 'البند' : 'Poste budgétaire'}</th>
                    <th className="py-2 px-3">{lang === 'ar' ? 'الصندوق' : 'Fonds'}</th>
                    <th className="py-2 px-3 text-end">{lang === 'ar' ? 'الميزانية' : 'Prévu'}</th>
                    <th className="py-2 px-3 text-end">{lang === 'ar' ? 'المحقق' : 'Réalisé'}</th>
                    <th className="py-2 px-3 text-end">{lang === 'ar' ? 'الفارق' : 'Écart'}</th>
                    <th className="py-2 px-3 text-end">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {budgetPlan.map((item) => {
                    const actual = expenseByCategory[item.category] || 0;
                    const diff = item.plannedAnnualDZD - actual;
                    const pct = item.plannedAnnualDZD > 0 ? Math.round((actual / item.plannedAnnualDZD) * 100) : 0;
                    return (
                      <tr key={item.category}>
                        <td className="py-1.5 px-3 font-medium">{getCategoryLabel(item.category, lang)}</td>
                        <td className="py-1.5 px-3">
                          {item.fund === 'reserve'
                            ? lang === 'ar'
                              ? 'احتياط'
                              : 'Réserve'
                            : lang === 'ar'
                            ? 'جاري'
                            : 'Courant'}
                        </td>
                        <td className="py-1.5 px-3 text-end font-mono">{formatDZD(item.plannedAnnualDZD, lang)}</td>
                        <td className="py-1.5 px-3 text-end font-mono font-bold">{formatDZD(actual, lang)}</td>
                        <td className={`py-1.5 px-3 text-end font-mono ${diff < 0 ? 'text-rose-700 font-bold' : 'text-emerald-700'}`}>
                          {diff >= 0 ? `+${formatDZD(diff, lang)}` : formatDZD(diff, lang)}
                        </td>
                        <td className="py-1.5 px-3 text-end font-mono">{pct}%</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-slate-100 font-bold border-t border-slate-300">
                    <td colSpan={2} className="py-2 px-3 uppercase">
                      {lang === 'ar' ? 'المجموع' : 'Total Budget'}
                    </td>
                    <td className="py-2 px-3 text-end font-mono">{formatDZD(totalBudgetPlanned, lang)}</td>
                    <td className="py-2 px-3 text-end font-mono">{formatDZD(totalBudgetActual, lang)}</td>
                    <td className="py-2 px-3 text-end font-mono">{formatDZD(totalBudgetPlanned - totalBudgetActual, lang)}</td>
                    <td className="py-2 px-3 text-end font-mono">
                      {totalBudgetPlanned > 0 ? Math.round((totalBudgetActual / totalBudgetPlanned) * 100) : 0}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Section III: Journal */}
          <div className="space-y-2">
            <h3 className="font-bold uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-1">
              {lang === 'ar'
                ? `ثالثاً: سجل العمليات (${scopeTransactions.length})`
                : `III. Journal des Opérations (${scopeTransactions.length} écritures)`}
            </h3>
            <div className="border border-slate-300 rounded overflow-hidden">
              <table className="w-full text-start text-[11px]">
                <thead className="bg-slate-100 border-b border-slate-300 font-bold">
                  <tr>
                    <th className="py-1.5 px-2">{lang === 'ar' ? 'التاريخ' : 'Date'}</th>
                    <th className="py-1.5 px-2">{lang === 'ar' ? 'البيان والفئة' : 'Libellé & Poste'}</th>
                    <th className="py-1.5 px-2">{lang === 'ar' ? 'الصندوق' : 'Fonds'}</th>
                    <th className="py-1.5 px-2 text-end">{lang === 'ar' ? 'مدخول' : 'Recette'}</th>
                    <th className="py-1.5 px-2 text-end">{lang === 'ar' ? 'مصروف' : 'Dépense'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {scopeTransactions.map((tx) => (
                    <tr key={tx.id}>
                      <td className="py-1.5 px-2 font-mono whitespace-nowrap">{formatShortDate(tx.date, lang)}</td>
                      <td className="py-1.5 px-2">
                        <div className="font-semibold text-slate-900">{tx.description}</div>
                        <div className="text-[10px] text-slate-500">
                          {getCategoryLabel(tx.category, lang)} · {getPaymentMethodLabel(tx.paymentMethod, lang)}
                          {tx.referenceDoc ? ` · ${tx.referenceDoc}` : ''}
                        </div>
                      </td>
                      <td className="py-1.5 px-2">
                        {(tx.fund || 'courant') === 'reserve'
                          ? lang === 'ar'
                            ? 'احتياط'
                            : 'Réserve'
                          : lang === 'ar'
                          ? 'جاري'
                          : 'Courant'}
                      </td>
                      <td className="py-1.5 px-2 text-end font-mono font-bold text-emerald-700 whitespace-nowrap">
                        {tx.type === 'recette' ? formatDZD(tx.amountDZD, lang) : '—'}
                      </td>
                      <td className="py-1.5 px-2 text-end font-mono font-bold text-rose-700 whitespace-nowrap">
                        {tx.type === 'depense' ? formatDZD(tx.amountDZD, lang) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Dual Signatures */}
          <div className="pt-4 border-t border-slate-200 space-y-4">
            <p className="text-slate-500">
              {t('madeAt')} {building.wilaya}, {t('onDate')} {formatDateFr(new Date().toISOString(), lang)}
            </p>
            <div className="grid grid-cols-2 gap-6">
              <div className="text-center border border-dashed border-slate-300 rounded p-4 h-24 flex flex-col justify-between">
                <span className="text-[10px] font-bold uppercase text-slate-500">
                  {lang === 'ar' ? 'أمين المال' : 'Le Trésorier'}
                </span>
                <span className="font-bold text-slate-900">{building.committee?.treasurer || '—'}</span>
              </div>
              <div className="text-center border border-dashed border-slate-300 rounded p-4 h-24 flex flex-col justify-between">
                <span className="text-[10px] font-bold uppercase text-slate-500">{t('syndicStamp')}</span>
                <span className="font-bold text-slate-900">{building.syndicPresident}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
