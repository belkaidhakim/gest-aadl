import React, { useMemo, useState } from 'react';
import {
  Megaphone,
  Printer,
  Pin,
  Droplet,
  Vote,
  FileText,
  ScrollText,
  Users,
  Search,
  Calendar,
  Award,
  ChevronRight,
  KeyRound,
} from 'lucide-react';
import { AssemblyMinutes, Notice } from '../../types';
import { formatDateFr } from '../../utils/helpers';
import { useI18n } from '../../i18n';
import { useAppStore } from '../../stores/AppStore';
import { EmptyState } from '../../components/ui/EmptyState';
import { SlideOverDrawer } from '../../components/ui/SlideOverDrawer';

interface ResidentNoticesPageProps {
  onPrintNotice: (notice: Notice) => void;
  onPrintMinutes: (minutes: AssemblyMinutes) => void;
  onPrintHouseRules: () => void;
}

export const ResidentNoticesPage: React.FC<ResidentNoticesPageProps> = ({
  onPrintNotice,
  onPrintMinutes,
  onPrintHouseRules,
}) => {
  const { lang, isRtl, t } = useI18n();
  const { data, residentCastVote } = useAppStore();

  const [subTab, setSubTab] = useState<'notices' | 'assembly' | 'rules'>('notices');
  const [typeFilter, setTypeFilter] = useState<'all' | Notice['type']>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [votingAptId, setVotingAptId] = useState<string>(data.apartments[0]?.id || '');
  const [votingPin, setVotingPin] = useState<string>('');
  const [castingVoteId, setCastingVoteId] = useState<string | null>(null);

  const filteredNotices = useMemo(() => {
    return [...data.notices]
      .filter((n) => {
        if (typeFilter !== 'all' && n.type !== typeFilter) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          if (
            !n.title.toLowerCase().includes(q) &&
            !n.message.toLowerCase().includes(q) &&
            !n.targetAudience.toLowerCase().includes(q)
          ) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        if (Boolean(b.isPinned) !== Boolean(a.isPinned)) return Number(b.isPinned) - Number(a.isPinned);
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
  }, [data.notices, typeFilter, searchQuery]);

  const filteredRules = useMemo(() => {
    const rules = data.houseRules || [];
    if (!searchQuery.trim()) return rules;
    const q = searchQuery.toLowerCase();
    return rules.filter(
      (sec) =>
        sec.title.toLowerCase().includes(q) ||
        sec.items.some((item) => item.toLowerCase().includes(q))
    );
  }, [data.houseRules, searchQuery]);

  const assemblyMinutes = data.assemblyMinutes || [];
  const occupiedCount = data.apartments.filter((a) => a.occupancy !== 'vacant').length || 1;

  const getNoticeBadge = (type: Notice['type']) => {
    switch (type) {
      case 'urgent':
        return (
          <span className="bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">
            {lang === 'ar' ? 'عاجل' : 'Urgent'}
          </span>
        );
      case 'coupure_eau':
        return (
          <span className="bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200 dark:border-sky-900/50 px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1">
            <Droplet className="w-3 h-3" />
            {lang === 'ar' ? 'انقطاع المياه' : "Coupure d'eau"}
          </span>
        );
      case 'assemblee':
        return (
          <span className="bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-900/50 px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1">
            <Users className="w-3 h-3" />
            {lang === 'ar' ? 'جمعية عامة' : 'Assemblée Générale'}
          </span>
        );
      case 'travaux':
        return (
          <span className="bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50 px-2 py-0.5 rounded-full text-[10px] font-bold">
            {lang === 'ar' ? 'أشغال' : 'Travaux'}
          </span>
        );
      default:
        return (
          <span className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50 px-2 py-0.5 rounded-full text-[10px] font-bold">
            {lang === 'ar' ? 'إعلام' : 'Information'}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <h1 className="text-lg font-extrabold text-slate-900 dark:text-white">
                {lang === 'ar' ? 'إعلانات البهو، الجمعية العامة والنظام الداخلي' : 'Avis du Hall, AG & Règlement'}
              </h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {lang === 'ar'
                ? 'اطلع على البلاغات الرسمية، نتائج تصويت الملاك، محاضر الجمعية العامة وقواعد العيش المشترك.'
                : 'Consultez les avis affichés, résultats des consultations, procès-verbaux et règlement intérieur.'}
            </p>
          </div>

          <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-xs self-start sm:self-center">
            <button
              onClick={() => setSubTab('notices')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer ${
                subTab === 'notices'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Megaphone className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? 'الإعلانات' : 'Avis & Communiqués'}</span>
            </button>
            <button
              onClick={() => setSubTab('assembly')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer ${
                subTab === 'assembly'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Vote className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? 'التصويت والمحاضر' : 'Votes & PV d’AG'}</span>
            </button>
            <button
              onClick={() => setSubTab('rules')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer ${
                subTab === 'rules'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <ScrollText className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? 'النظام الداخلي' : 'Règlement Intérieur'}</span>
            </button>
          </div>
        </div>

        {(subTab === 'notices' || subTab === 'rules') && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
            {subTab === 'notices' ? (
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'all' as const, label: lang === 'ar' ? 'الكل' : 'Tous' },
                  { id: 'urgent' as const, label: lang === 'ar' ? 'عاجل' : 'Urgent' },
                  { id: 'coupure_eau' as const, label: lang === 'ar' ? 'انقطاع المياه' : "Coupure d'eau" },
                  { id: 'travaux' as const, label: lang === 'ar' ? 'أشغال' : 'Travaux' },
                  { id: 'assemblee' as const, label: lang === 'ar' ? 'جمعية عامة' : 'Assemblée' },
                  { id: 'info' as const, label: lang === 'ar' ? 'إعلام' : 'Infos' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setTypeFilter(f.id)}
                    className={`px-3 py-1.5 rounded-xl font-semibold cursor-pointer ${
                      typeFilter === f.id
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-slate-500 dark:text-slate-400">
                {t('houseRulesHeader')} — {data.building.buildingNumber}
              </div>
            )}

            <div className="relative min-w-[220px] grow sm:grow-0">
              <Search className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={lang === 'ar' ? 'بحث في النصوص...' : 'Rechercher...'}
                className="w-full ps-9 pe-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>
        )}
      </div>

      {/* SUBTAB 1: Notices */}
      {subTab === 'notices' && (
        filteredNotices.length === 0 ? (
          <EmptyState
            icon={<Megaphone className="w-7 h-7" />}
            title={lang === 'ar' ? 'لا توجد إعلانات مطابقة' : 'Aucun avis correspondant'}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredNotices.map((notice) => (
              <div
                key={notice.id}
                className={`bg-white dark:bg-slate-900 border rounded-2xl p-5 shadow-xs flex flex-col justify-between gap-4 ${
                  notice.isPinned
                    ? 'border-emerald-300/80 dark:border-emerald-800/70'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {notice.isPinned && <Pin className="w-3.5 h-3.5 text-emerald-600" />}
                      {getNoticeBadge(notice.type)}
                    </div>
                    <span className="text-[11px] font-mono text-slate-400">
                      {formatDateFr(notice.date, lang)}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 dark:text-white">{notice.title}</h3>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 line-clamp-3 leading-relaxed">
                    {notice.message}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setSelectedNotice(notice)}
                    className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                  >
                    <span>{lang === 'ar' ? 'قراءة كاملة' : 'Lire la suite'}</span>
                    <ChevronRight className={`w-3.5 h-3.5 ${isRtl ? 'rotate-180' : ''}`} />
                  </button>

                  <button
                    type="button"
                    onClick={() => onPrintNotice(notice)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-semibold cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>{t('printA4')}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* SUBTAB 2: Read-Only Votes + Assembly Minutes */}
      {subTab === 'assembly' && (
        <div className="space-y-6">
          {/* Votes */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
              <Vote className="w-4 h-4 text-emerald-600" />
              <span>{lang === 'ar' ? 'نتائج استشارات وتصويت الملاك' : 'Consultations & Votes de la Copropriété'}</span>
            </div>

            {data.votes.length === 0 ? (
              <EmptyState
                icon={<Vote className="w-7 h-7" />}
                title={lang === 'ar' ? 'لا توجد استشارات جارية' : 'Aucune consultation enregistrée'}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.votes.map((vote) => {
                  const totalCast = vote.options.reduce((a, o) => a + o.votes, 0);
                  const quorumPct = Math.round((totalCast / Math.max(1, vote.totalEligibleApartments)) * 100);
                  const topVotes = Math.max(...vote.options.map((o) => o.votes));
                  const isClosed = vote.status === 'closed';

                  return (
                    <div
                      key={vote.id}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">{vote.title}</h4>
                        <span
                          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full shrink-0 ${
                            isClosed
                              ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                          }`}
                        >
                          {isClosed ? (lang === 'ar' ? 'مغلق' : 'Clôturé') : lang === 'ar' ? 'جاري' : 'En cours'}
                        </span>
                      </div>

                      {vote.description && <p className="text-xs text-slate-500">{vote.description}</p>}

                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {vote.endDate}
                        </span>
                        <span className="font-mono font-bold text-emerald-600">
                          {totalCast}/{vote.totalEligibleApartments} ({quorumPct}% {t('quorum')})
                        </span>
                      </div>

                      <div className="space-y-2.5 pt-1">
                        {vote.options.map((opt) => {
                          const pct = totalCast > 0 ? Math.round((opt.votes / totalCast) * 100) : 0;
                          const isLeading = topVotes > 0 && opt.votes === topVotes;
                          return (
                            <div key={opt.id} className="space-y-1 text-xs">
                              <div className="flex items-center justify-between gap-2 font-medium">
                                <span className="text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                                  <span>{opt.label}</span>
                                  {isLeading && (
                                    <Award className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  )}
                                </span>
                                <span className="font-mono text-slate-600 dark:text-slate-300 shrink-0">
                                  {opt.votes} ({pct}%)
                                </span>
                              </div>
                              <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${isLeading ? 'bg-emerald-600' : 'bg-slate-400 dark:bg-slate-600'}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {!isClosed && (
                        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5 text-xs">
                          <div className="flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-300">
                            <KeyRound className="w-3.5 h-3.5" />
                            <span>
                              {lang === 'ar'
                                ? 'التصويت الإلكتروني المباشر (بالرمز السري للشقة)'
                                : 'Voter en ligne avec votre Code PIN'}
                            </span>
                          </div>
                          <div className="grid grid-cols-5 gap-2">
                            <select
                              value={votingAptId}
                              onChange={(e) => setVotingAptId(e.target.value)}
                              className="col-span-3 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold"
                            >
                              {data.apartments.map((apt) => (
                                <option key={apt.id} value={apt.id}>
                                  {apt.number} {vote.votedApartments.includes(apt.id) ? '✓ (A voté)' : ''}
                                </option>
                              ))}
                            </select>
                            <input
                              type="password"
                              inputMode="numeric"
                              maxLength={4}
                              value={votingPin}
                              onChange={(e) => setVotingPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                              placeholder="PIN ••••"
                              className="col-span-2 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-center tracking-widest"
                            />
                          </div>
                          <div className="grid grid-cols-3 gap-1.5">
                            {vote.options.map((opt) => (
                              <button
                                key={opt.id}
                                type="button"
                                disabled={
                                  castingVoteId === vote.id ||
                                  votingPin.length < 4 ||
                                  vote.votedApartments.includes(votingAptId)
                                }
                                onClick={async () => {
                                  setCastingVoteId(vote.id);
                                  try {
                                    const ok = await residentCastVote(
                                      vote.id,
                                      opt.id,
                                      votingAptId,
                                      votingPin
                                    );
                                    if (ok) setVotingPin('');
                                  } finally {
                                    setCastingVoteId(null);
                                  }
                                }}
                                className="px-2 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-600 hover:text-white text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 disabled:opacity-45 transition-colors cursor-pointer truncate"
                              >
                                {opt.label.split(' ')[0]}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Assembly Minutes */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
              <FileText className="w-4 h-4 text-emerald-600" />
              <span>{lang === 'ar' ? 'أرشيف محاضر الجمعيات العامة' : "Procès-Verbaux d'Assemblée Générale"}</span>
            </div>

            {assemblyMinutes.length === 0 ? (
              <EmptyState
                icon={<FileText className="w-7 h-7" />}
                title={lang === 'ar' ? 'لا توجد محاضر مسجلة' : 'Aucun procès-verbal publié'}
              />
            ) : (
              <div className="space-y-4">
                {assemblyMinutes.map((pv) => {
                  const presencePct = Math.round((pv.presentApartmentIds.length / occupiedCount) * 100);
                  return (
                    <div
                      key={pv.id}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                        <div>
                          <div className="flex items-center gap-2 text-xs mb-1">
                            <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 font-bold uppercase text-[10px]">
                              AG {pv.type}
                            </span>
                            <span className="font-mono text-slate-500">
                              {formatDateFr(pv.date, lang)} · {pv.time}
                            </span>
                            <span className="text-slate-400">·</span>
                            <span className="text-slate-500">{pv.location}</span>
                          </div>
                          <h3 className="text-base font-bold text-slate-900 dark:text-white">{pv.title}</h3>
                        </div>

                        <button
                          onClick={() => onPrintMinutes(pv)}
                          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs cursor-pointer shrink-0"
                        >
                          <Printer className="w-4 h-4" />
                          <span>{t('printA4')}</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 space-y-2">
                          <h4 className="font-bold uppercase text-[11px] text-slate-500">
                            {lang === 'ar' ? 'جدول الأعمال' : 'Ordre du jour'}
                          </h4>
                          <ol className="list-decimal list-inside space-y-1 text-slate-700 dark:text-slate-300">
                            {pv.agenda.map((item, i) => (
                              <li key={i}>{item}</li>
                            ))}
                          </ol>
                        </div>
                        <div className="p-3.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-800/50 space-y-2">
                          <h4 className="font-bold uppercase text-[11px] text-emerald-700 dark:text-emerald-300">
                            {lang === 'ar' ? 'القرارات المصادق عليها' : 'Résolutions adoptées'}
                          </h4>
                          <ul className="list-disc list-inside space-y-1 text-slate-800 dark:text-slate-200">
                            {pv.decisions.map((dec, i) => (
                              <li key={i}>{dec}</li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div className="text-[11px] text-slate-500 flex flex-wrap justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <span className="inline-flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-emerald-600" />
                          {pv.presentApartmentIds.length} / {occupiedCount} ({presencePct}%)
                        </span>
                        <span>
                          <strong>{pv.presidentName}</strong> · <strong>{pv.secretaryName}</strong>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 3: House Rules */}
      {subTab === 'rules' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ScrollText className="w-5 h-5 text-emerald-600" />
                <span>
                  {t('houseRulesHeader')} — {data.building.buildingNumber}
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">{t('houseRulesSub')}</p>
            </div>

            <button
              onClick={onPrintHouseRules}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs cursor-pointer self-start sm:self-center"
            >
              <Printer className="w-4 h-4" />
              <span>{t('printRulesBtn')}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredRules.map((sec) => (
              <div
                key={sec.id}
                className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 space-y-2.5 text-xs"
              >
                <h4 className="font-bold text-slate-900 dark:text-white text-sm">{sec.title}</h4>
                <ul className="list-disc list-inside space-y-1.5 text-slate-700 dark:text-slate-300 leading-relaxed">
                  {sec.items.filter(Boolean).map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notice Reader Drawer */}
      <SlideOverDrawer
        open={Boolean(selectedNotice)}
        onClose={() => setSelectedNotice(null)}
        title={selectedNotice?.title}
        subtitle={
          selectedNotice
            ? `${selectedNotice.author} · ${formatDateFr(selectedNotice.date, lang)}`
            : undefined
        }
      >
        {selectedNotice && (
          <div className="space-y-5 text-xs">
            <div className="flex items-center justify-between gap-2">
              {getNoticeBadge(selectedNotice.type)}
              <span className="text-slate-500">{selectedNotice.targetAudience}</span>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-sm leading-relaxed text-slate-800 dark:text-slate-100 whitespace-pre-line">
              {selectedNotice.message}
            </div>
            <button
              type="button"
              onClick={() => onPrintNotice(selectedNotice)}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>{t('printA4')}</span>
            </button>
          </div>
        )}
      </SlideOverDrawer>
    </div>
  );
};
