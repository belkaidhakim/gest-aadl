import {
  BudgetAllocation,
  PaymentMethod,
  Transaction,
  TransactionCategory,
} from '../../types';

export const ALL_PAYMENT_METHODS: PaymentMethod[] = [
  'Espèces',
  'Virement CCP',
  'BaridiMob',
  'Chèque',
  'Autre',
];

export const EXPENSE_CATEGORIES: TransactionCategory[] = [
  'Maintenance Ascenseurs',
  'Facture Électricité Sonelgaz',
  'Agent de Ménage & Entretien',
  'Réparation Bâche à Eau / Surpresseur',
  'Serrurerie & Interphone',
  'Achat Fournitures & Ampoules',
  'Gros Travaux & Équipements',
  'Frais Administratifs / Juridiques',
  'Autre',
];

export const INCOME_CATEGORIES: TransactionCategory[] = [
  'Cotisations Copropriétaires',
  'Dotation Fonds de Réserve',
  'Autre',
];

export const DEFAULT_AADL_BUDGET_TEMPLATE: BudgetAllocation[] = [
  { category: 'Maintenance Ascenseurs', plannedAnnualDZD: 144000, fund: 'courant' },
  { category: 'Agent de Ménage & Entretien', plannedAnnualDZD: 120000, fund: 'courant' },
  { category: 'Facture Électricité Sonelgaz', plannedAnnualDZD: 48000, fund: 'courant' },
  { category: 'Réparation Bâche à Eau / Surpresseur', plannedAnnualDZD: 35000, fund: 'courant' },
  { category: 'Serrurerie & Interphone', plannedAnnualDZD: 20000, fund: 'courant' },
  { category: 'Achat Fournitures & Ampoules', plannedAnnualDZD: 18000, fund: 'courant' },
  { category: 'Frais Administratifs / Juridiques', plannedAnnualDZD: 15000, fund: 'courant' },
  { category: 'Gros Travaux & Équipements', plannedAnnualDZD: 150000, fund: 'reserve' },
];

export function getCategoryLabel(category: TransactionCategory, lang: 'fr' | 'ar'): string {
  if (lang === 'fr') return category;
  switch (category) {
    case 'Cotisations Copropriétaires':
      return 'اشتراكات الملاك والساكنين';
    case 'Dotation Fonds de Réserve':
      return 'تحويل / دعم صندوق الاحتياط';
    case 'Maintenance Ascenseurs':
      return 'صيانة المصاعد';
    case 'Facture Électricité Sonelgaz':
      return 'فاتورة الكهرباء سونلغاز';
    case 'Réparation Bâche à Eau / Surpresseur':
      return 'إصلاح خزان المياه ومجموعة الضغط';
    case 'Agent de Ménage & Entretien':
      return 'عون النظافة ومواد التنظيف';
    case 'Serrurerie & Interphone':
      return 'أقفال باب المدخل والإنترفون';
    case 'Achat Fournitures & Ampoules':
      return 'شراء مصابيح ومستلزمات';
    case 'Gros Travaux & Équipements':
      return 'أشغال كبرى وتجهيزات (الاحتياط)';
    case 'Frais Administratifs / Juridiques':
      return 'مصاريف إدارية وقضائية';
    default:
      return 'عملية أخرى';
  }
}

export function getPaymentMethodLabel(method: PaymentMethod, lang: 'fr' | 'ar'): string {
  if (lang === 'fr') return method;
  switch (method) {
    case 'Espèces':
      return 'نقداً';
    case 'Virement CCP':
      return 'تحويل بريدي CCP';
    case 'BaridiMob':
      return 'بريدي موب';
    case 'Chèque':
      return 'صك';
    default:
      return 'تحويل داخلي / آخر';
  }
}

export function isInternalTransfer(tx: Transaction): boolean {
  return Boolean(tx.referenceDoc && tx.referenceDoc.startsWith('VIR-'));
}

export function computeRunningBalances(transactions: Transaction[]): Map<string, number> {
  const chronological = [...transactions].sort((a, b) => {
    const tA = new Date(a.date).getTime();
    const tB = new Date(b.date).getTime();
    if (tA !== tB) return tA - tB;
    return a.id.localeCompare(b.id);
  });

  const balances = new Map<string, number>();
  let running = 0;
  for (const tx of chronological) {
    running += tx.type === 'recette' ? tx.amountDZD : -tx.amountDZD;
    balances.set(tx.id, running);
  }
  return balances;
}

function escapeCsvCell(value: string | number): string {
  const str = String(value ?? '');
  return `"${str.replace(/"/g, '""')}"`;
}

export function exportTransactionsCSV(
  transactions: Transaction[],
  runningBalances: Map<string, number>,
  buildingNumber: string,
  lang: 'fr' | 'ar'
): void {
  const headers =
    lang === 'ar'
      ? ['التاريخ', 'النوع', 'الصندوق', 'الفئة', 'البيان', 'طريقة الدفع', 'المرجع', 'المبلغ (دج)', 'الرصيد التراكمي (دج)']
      : ['Date', 'Type', 'Enveloppe', 'Catégorie', 'Libellé', 'Mode de règlement', 'Référence', 'Montant (DZD)', 'Solde Cumulé (DZD)'];

  const rows = transactions.map((tx) => {
    const fundLabel =
      (tx.fund || 'courant') === 'reserve'
        ? lang === 'ar'
          ? 'صندوق الاحتياط'
          : 'Fonds de Réserve'
        : lang === 'ar'
        ? 'الصندوق الجاري'
        : 'Budget Courant';
    const typeLabel =
      tx.type === 'recette'
        ? lang === 'ar'
          ? 'مدخول'
          : 'Recette'
        : lang === 'ar'
        ? 'مصروف'
        : 'Dépense';
    const signedAmount = tx.type === 'recette' ? tx.amountDZD : -tx.amountDZD;
    const balance = runningBalances.get(tx.id) ?? 0;

    return [
      tx.date,
      typeLabel,
      fundLabel,
      getCategoryLabel(tx.category, lang),
      tx.description,
      getPaymentMethodLabel(tx.paymentMethod, lang),
      tx.referenceDoc || '',
      signedAmount,
      balance,
    ]
      .map(escapeCsvCell)
      .join(';');
  });

  const csvContent = '\uFEFF' + [headers.map(escapeCsvCell).join(';'), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeSlug = buildingNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
  link.href = url;
  link.download = `caisse_${safeSlug}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
