import React, { useCallback, useEffect, useState } from 'react';
import { ClipboardList, RefreshCw, Search, Clock } from 'lucide-react';
import { AuditLogEntry } from '../../types';
import { fetchAuditLogsRemote } from '../../services/api';
import { useAppStore } from '../../stores/AppStore';
import { useI18n } from '../../i18n';
import { EmptyState } from '../../components/ui/EmptyState';

export const AuditLogPage: React.FC = () => {
  const { lang, t } = useI18n();
  const { activeBuildingId } = useAppStore();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('all');

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchAuditLogsRemote(activeBuildingId, 150);
      setLogs(rows);
    } finally {
      setLoading(false);
    }
  }, [activeBuildingId]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const actions = Array.from(new Set(logs.map((l) => l.action)));

  const filtered = logs.filter((entry) => {
    if (actionFilter !== 'all' && entry.action !== actionFilter) return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      const text = `${entry.actorName} ${entry.actorRole} ${entry.action} ${entry.summary}`.toLowerCase();
      if (!text.includes(q)) return false;
    }
    return true;
  });

  const formatTimestamp = (iso: string) => {
    try {
      return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-DZ' : 'fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                {t('tabAudit')}
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {lang === 'ar'
                ? 'سجل كامل ومؤرخ لجميع العمليات المالية والتقنية والإدارية في البناية.'
                : 'Historique horodaté et traçabilité complète des actions effectuées par le Bureau.'}
            </p>
          </div>

          <button
            onClick={loadLogs}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl border border-slate-200 dark:border-slate-700 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{lang === 'ar' ? 'تحديث' : 'Actualiser'}</span>
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="relative grow max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={lang === 'ar' ? 'بحث حسب المستخدم أو العملية...' : 'Rechercher par utilisateur, action, référence...'}
              className="w-full ps-9 pe-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
          >
            <option value="all">{lang === 'ar' ? 'كل العمليات' : 'Toutes les actions'}</option>
            {actions.map((act) => (
              <option key={act} value={act}>
                {act}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Body */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="w-7 h-7" />}
          title={lang === 'ar' ? 'لا توجد سجلات مطابقة' : 'Aucune trace d’audit trouvée'}
          description={
            lang === 'ar'
              ? 'سيتم تسجيل كل دفعة أو عملية صرف أو تعديل هنا تلقائياً.'
              : 'Chaque encaissement, dépense ou modification critique sera journalisé ici.'
          }
        />
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">{lang === 'ar' ? 'التاريخ والوقت' : 'Horodatage'}</th>
                  <th className="py-3 px-4">{lang === 'ar' ? 'المستخدم' : 'Acteur'}</th>
                  <th className="py-3 px-4">{lang === 'ar' ? 'العملية' : 'Action'}</th>
                  <th className="py-3 px-4">{lang === 'ar' ? 'التفاصيل' : 'Détail'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {filtered.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {formatTimestamp(entry.timestamp)}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-bold text-slate-900 dark:text-white">{entry.actorName}</span>
                      <span className="ms-1.5 text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono">
                        {entry.actorRole}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-mono">
                        {entry.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                      <span className="font-medium">{entry.summary}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
