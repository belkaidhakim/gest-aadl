import type { Language } from '../i18n/translations';

/**
 * Utility functions for Gest-AADL (French & Arabic bilingual support)
 */

export function formatDZD(amount: number, lang: Language = 'fr'): string {
  const formatted = new Intl.NumberFormat('fr-DZ', {
    maximumFractionDigits: 0,
  }).format(amount);
  return lang === 'ar' ? `${formatted} دج` : `${formatted} DZD`;
}

export function formatDateFr(dateString: string, lang: Language = 'fr'): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-DZ' : 'fr-DZ', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function formatShortDate(dateString: string, lang: Language = 'fr'): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-DZ' : 'fr-DZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export function formatMonthName(monthStr: string, lang: Language = 'fr'): string {
  if (!monthStr) return '';
  if (/^\d{4}$/.test(monthStr)) {
    return lang === 'ar' ? `السنة المالية ${monthStr}` : `Exercice Annuel ${monthStr}`;
  }
  if (!monthStr.includes('-')) return monthStr;
  const [year, month] = monthStr.split('-');
  const monthNamesFr = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];
  const monthNamesAr = [
    'جانفي', 'فيفري', 'مارس', 'أفريل', 'ماي', 'جوان',
    'جويلية', 'أوت', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ];
  const mIndex = parseInt(month, 10) - 1;
  const list = lang === 'ar' ? monthNamesAr : monthNamesFr;
  return `${list[mIndex] || month} ${year}`;
}

export function getCurrentMonthStr(): string {
  return String(new Date().getFullYear());
}

/**
 * Convert number to French text for official receipts
 */
export function numberToFrenchWords(n: number): string {
  if (n === 0) return 'Zéro dinar';
  
  const units = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf'];
  const teens = ['dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
  const tens = ['', 'dix', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante-dix', 'quatre-vingts', 'quatre-vingt-dix'];

  function convertBelow1000(num: number): string {
    let result = '';

    if (num >= 100) {
      const h = Math.floor(num / 100);
      const rem = num % 100;
      if (h === 1) {
        result += 'cent';
      } else {
        result += units[h] + (rem === 0 ? ' cents' : ' cent');
      }
      if (rem > 0) result += ' ';
      num = rem;
    }

    if (num >= 20) {
      const t = Math.floor(num / 10);
      const u = num % 10;
      if (t === 7) {
        result += 'soixante-' + (u === 1 ? 'et-onze' : teens[u]);
      } else if (t === 8) {
        result += (u === 0 ? 'quatre-vingts' : 'quatre-vingt-' + units[u]);
      } else if (t === 9) {
        result += 'quatre-vingt-' + teens[u];
      } else {
        result += tens[t] + (u === 1 ? ' et un' : (u > 0 ? '-' + units[u] : ''));
      }
    } else if (num >= 10) {
      result += teens[num - 10];
    } else if (num > 0) {
      result += units[num];
    }

    return result.trim();
  }

  if (n < 1000) {
    return capitalize(convertBelow1000(n)) + ' dinars algériens';
  }

  if (n < 1000000) {
    const thousands = Math.floor(n / 1000);
    const rem = n % 1000;
    let thText = thousands === 1 ? 'mille' : convertBelow1000(thousands) + ' mille';
    if (rem > 0) {
      thText += ' ' + convertBelow1000(rem);
    }
    return capitalize(thText) + ' dinars algériens';
  }

  return `${n} dinars algériens`;
}

function capitalize(s: string): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Generate a reminder SMS/WhatsApp text for unpaid fees
 */
export function generateFeeReminderText(
  residentName: string,
  apartmentNumber: string,
  buildingName: string,
  unpaidMonths: string[],
  totalAmountDZD: number,
  syndicPhone: string,
  syndicPresident = 'le responsable de bâtiment',
  lang: Language = 'fr'
): string {
  const monthsStr = unpaidMonths.map((m) => formatMonthName(m, lang)).join(lang === 'ar' ? '، ' : ', ');
  if (lang === 'ar') {
    return `السلام عليكم ${residentName}،\n\nتذكير من مكتب السانديك بخصوص ${buildingName} (${apartmentNumber}) :\nنرجو منكم التكرم بتسوية اشتراك الملكية المشتركة للفترة: ${monthsStr}.\nالمبلغ المستحق: ${formatDZD(totalAmountDZD, 'ar')}.\nطريقة الدفع: نقداً مباشرة لدى مسؤول العمارة ${syndicPresident} (${syndicPhone}) مقابل استلام وصل رسمي فوري.\n\nتسمح هذه المساهمات بضمان صيانة المصعدين، تشغيل مضخة المياه وإنارة الأجزاء المشتركة.\n\nشكراً لتعاونكم.\nسانديك ${buildingName}`;
  }
  return `Salam ${residentName},\n\nRappel du Syndic pour le ${buildingName} (${apartmentNumber}) :\nNous vous prions de bien vouloir régulariser votre cotisation de copropriété pour la période : ${monthsStr}.\nMontant dû : ${formatDZD(totalAmountDZD, 'fr')}.\nModalité : Paiement en espèces directement auprès du responsable de bâtiment ${syndicPresident} (${syndicPhone}) contre remise immédiate de quittance officielle.\n\nCes fonds permettent d'assurer l'entretien des 2 ascenseurs, le bon fonctionnement du surpresseur d'eau et l'éclairage des parties communes.\n\nMerci de votre collaboration.\nSyndic ${buildingName}`;
}

export function computeNextDueDate(baseDateStr: string, frequency: 'hebdomadaire' | 'mensuel' | 'trimestriel' | 'semestriel' | 'annuel'): string {
  const base = new Date(baseDateStr);
  const d = isNaN(base.getTime()) ? new Date() : base;
  switch (frequency) {
    case 'hebdomadaire':
      d.setDate(d.getDate() + 7);
      break;
    case 'mensuel':
      d.setMonth(d.getMonth() + 1);
      break;
    case 'trimestriel':
      d.setMonth(d.getMonth() + 3);
      break;
    case 'semestriel':
      d.setMonth(d.getMonth() + 6);
      break;
    case 'annuel':
      d.setFullYear(d.getFullYear() + 1);
      break;
  }
  return d.toISOString().slice(0, 10);
}

export function getDueStatus(nextDueDate: string): 'overdue' | 'soon' | 'ok' {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(nextDueDate);
  if (isNaN(due.getTime())) return 'ok';
  const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'overdue';
  if (diffDays <= 14) return 'soon';
  return 'ok';
}

export function maskPhone(phone?: string): string {
  if (!phone || phone === '-') return '—';
  const clean = phone.trim();
  if (clean.length <= 4) return '••••';
  return `${clean.slice(0, 4)} •• •• ${clean.slice(-2)}`;
}
