import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  X,
  Building2,
  Receipt,
  Wrench,
  Phone,
  ArrowRight,
  Compass,
} from 'lucide-react';
import { PaymentRecord } from '../types';
import { useAppStore } from '../stores/AppStore';
import { useI18n } from '../i18n';
import { formatDZD } from '../utils/helpers';
import { AppTab } from './useRoute';
import { canManageFinance, canManageSettings } from '../utils/permissions';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (tab: AppTab) => void;
  onSelectReceipt: (payment: PaymentRecord) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  onClose,
  onNavigate,
  onSelectReceipt,
}) => {
  const { lang, t } = useI18n();
  const { data, isBureau, role } = useAppStore();
  const [query, setQuery] = useState('');

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (open) onClose();
      } else if (e.key === 'Escape' && open) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (open) setQuery('');
  }, [open]);

  const navShortcuts = useMemo(() => {
    const items: Array<{ tab: AppTab; label: string }> = isBureau
      ? [
          { tab: 'dashboard', label: t('tabDashboard') },
          { tab: 'matrix', label: t('tabMatrix') },
          { tab: 'fees', label: t('tabFees') },
          { tab: 'incidents', label: t('tabIncidents') },
          { tab: 'treasury', label: t('tabTreasury') },
          { tab: 'notices', label: t('tabNotices') },
          { tab: 'directory', label: t('tabDirectory') },
          { tab: 'audit', label: t('tabAudit') },
        ]
      : [
          { tab: 'dashboard', label: t('tabEssential') },
          { tab: 'incidents', label: t('tabIncidentsResident') },
          { tab: 'notices', label: t('tabNoticesResident') },
          { tab: 'directory', label: t('tabDirectoryResident') },
        ];
    if (isBureau && canManageSettings(role)) {
      items.push({ tab: 'settings', label: t('tabSettings') });
    }
    return items;
  }, [isBureau, role, t]);

  const q = query.trim().toLowerCase();

  const matchingNav = navShortcuts.filter((n) => !q || n.label.toLowerCase().includes(q));

  const matchingApts = useMemo(() => {
    if (!isBureau || !q) return [];
    return data.apartments
      .filter(
        (a) =>
          a.number.toLowerCase().includes(q) ||
          a.resident.name.toLowerCase().includes(q) ||
          (a.resident.aadlFolderNumber || '').toLowerCase().includes(q)
      )
      .slice(0, 5);
  }, [isBureau, q, data.apartments]);

  const matchingPayments = useMemo(() => {
    if (!isBureau || !canManageFinance(role) || !q) return [];
    return data.payments
      .filter(
        (p) =>
          p.receiptNumber.toLowerCase().includes(q) ||
          p.apartmentNumber.toLowerCase().includes(q) ||
          p.residentName.toLowerCase().includes(q)
      )
      .slice(0, 5);
  }, [isBureau, role, q, data.payments]);

  const matchingIncidents = useMemo(() => {
    if (!q) return [];
    return data.incidents
      .filter((i) => i.title.toLowerCase().includes(q) || i.location.toLowerCase().includes(q))
      .slice(0, 4);
  }, [q, data.incidents]);

  const matchingVendors = useMemo(() => {
    if (!q) return [];
    return data.vendors
      .filter((v) => v.name.toLowerCase().includes(q) || v.specialty.toLowerCase().includes(q))
      .slice(0, 4);
  }, [q, data.vendors]);

  if (!open) return null;

  const hasAny =
    matchingNav.length > 0 ||
    matchingApts.length > 0 ||
    matchingPayments.length > 0 ||
    matchingIncidents.length > 0 ||
    matchingVendors.length > 0;

  return (
    <div className="fixed inset-0 z-[80] bg-slate-950/60 backdrop-blur-xs flex items-start justify-center pt-16 sm:pt-24 p-4 no-print">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-800">
          <Search className="w-4 h-4 text-emerald-600 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('quickSearchPlaceholder')}
            className="w-full bg-transparent text-sm text-slate-900 dark:text-white focus:outline-none"
            autoFocus
          />
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-3 space-y-4 text-xs">
          {!hasAny && (
            <div className="py-8 text-center text-slate-400">{t('noSearchResults')}</div>
          )}

          {matchingNav.length > 0 && (
            <div className="space-y-1">
              <div className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {t('searchCategoryNav')}
              </div>
              {matchingNav.map((item) => (
                <button
                  key={item.tab}
                  onClick={() => {
                    onNavigate(item.tab);
                    onClose();
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/50 text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  <span className="flex items-center gap-2 font-medium">
                    <Compass className="w-3.5 h-3.5 text-emerald-600" />
                    {item.label}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                </button>
              ))}
            </div>
          )}

          {matchingApts.length > 0 && (
            <div className="space-y-1">
              <div className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {t('searchCategoryApts')}
              </div>
              {matchingApts.map((apt) => (
                <button
                  key={apt.id}
                  onClick={() => {
                    onNavigate('matrix');
                    onClose();
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-start cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                    <strong className="text-slate-900 dark:text-white">{apt.number}</strong>
                    <span className="text-slate-500">{apt.resident.name}</span>
                  </span>
                  <span className="font-mono text-[11px] text-slate-400">{apt.type}</span>
                </button>
              ))}
            </div>
          )}

          {matchingPayments.length > 0 && (
            <div className="space-y-1">
              <div className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {t('searchCategoryPayments')}
              </div>
              {matchingPayments.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    onSelectReceipt(p);
                    onClose();
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-start cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Receipt className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="font-mono font-bold text-slate-900 dark:text-white">{p.receiptNumber}</span>
                    <span className="text-slate-500">{p.apartmentNumber} · {p.residentName}</span>
                  </span>
                  <span className="font-mono font-bold text-emerald-600">{formatDZD(p.amountDZD, lang)}</span>
                </button>
              ))}
            </div>
          )}

          {matchingIncidents.length > 0 && (
            <div className="space-y-1">
              <div className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {t('searchCategoryIncidents')}
              </div>
              {matchingIncidents.map((inc) => (
                <button
                  key={inc.id}
                  onClick={() => {
                    onNavigate('incidents');
                    onClose();
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-start cursor-pointer"
                >
                  <span className="flex items-center gap-2 truncate">
                    <Wrench className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span className="font-medium text-slate-900 dark:text-white truncate">{inc.title}</span>
                  </span>
                  <span className="text-[10px] text-slate-400 shrink-0 ms-2">{inc.location}</span>
                </button>
              ))}
            </div>
          )}

          {matchingVendors.length > 0 && (
            <div className="space-y-1">
              <div className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {t('searchCategoryVendors')}
              </div>
              {matchingVendors.map((v) => (
                <button
                  key={v.id}
                  onClick={() => {
                    onNavigate('directory');
                    onClose();
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-start cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-sky-500" />
                    <span className="font-medium text-slate-900 dark:text-white">{v.name}</span>
                  </span>
                  <span className="font-mono text-[11px] text-emerald-600">{v.phone}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
