import React, { useState } from 'react';
import {
  Megaphone,
  Printer,
  Plus,
  Pin,
  Calendar,
  Vote,
  Droplet,
  FileText,
  ScrollText,
  Lock,
  Unlock,
  Users,
  Edit3,
  Check,
  Pencil,
  Trash2,
  Share2,
} from 'lucide-react';
import { AssemblyMinutes, AssemblyVote, HouseRuleSection, Notice } from '../../types';
import { formatDateFr, generateNoticeWhatsAppText } from '../../utils/helpers';
import { useI18n } from '../../i18n';
import { useAppStore } from '../../stores/AppStore';
import { canManageGovernance } from '../../utils/permissions';
import { EmptyState } from '../../components/ui/EmptyState';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { useToast } from '../../components/ui/ToastProvider';
import { NewMinutesModal, NewNoticeModal, NewVoteModal } from './GovernanceModals';

interface GovernancePageProps {
  onPrintNotice: (notice: Notice) => void;
  onPrintMinutes: (minutes: AssemblyMinutes) => void;
  onPrintHouseRules: () => void;
}

export const GovernancePage: React.FC<GovernancePageProps> = ({
  onPrintNotice,
  onPrintMinutes,
  onPrintHouseRules,
}) => {
  const { lang, t } = useI18n();
  const { confirm } = useConfirm();
  const toast = useToast();
  const {
    data,
    role,
    addNotice,
    updateNotice,
    deleteNotice,
    addVote,
    updateVote,
    deleteVote,
    toggleVoteStatus,
    castVote,
    addAssemblyMinutes,
    updateAssemblyMinutes,
    deleteAssemblyMinutes,
    updateHouseRules,
  } = useAppStore();

  const canManage = canManageGovernance(role);
  const [subTab, setSubTab] = useState<'notices' | 'minutes' | 'rules'>('notices');
  const [isNewNoticeModal, setIsNewNoticeModal] = useState(false);
  const [editingNotice, setEditingNotice] = useState<Notice | null>(null);
  const [isNewVoteModal, setIsNewVoteModal] = useState(false);
  const [editingVote, setEditingVote] = useState<AssemblyVote | null>(null);
  const [isNewMinutesModal, setIsNewMinutesModal] = useState(false);
  const [editingMinutes, setEditingMinutes] = useState<AssemblyMinutes | null>(null);
  const [isEditingRules, setIsEditingRules] = useState(false);
  const [rulesDraft, setRulesDraft] = useState<HouseRuleSection[]>(data.houseRules || []);
  const [selectedVotingApt, setSelectedVotingApt] = useState<string>(data.apartments[0]?.id || '');

  const handleShareNoticeWhatsApp = (notice: Notice) => {
    const text = generateNoticeWhatsAppText(notice, data.building, lang);
    navigator.clipboard.writeText(text).catch(() => {});
    toast.success(lang === 'ar' ? 'تم نسخ نص الإعلان لواتساب' : 'Avis copié & prêt pour WhatsApp');
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  const assemblyMinutes = data.assemblyMinutes || [];
  const houseRules = data.houseRules || [];
  const eligibleCount = data.apartments.filter((a) => a.occupancy !== 'vacant').length || data.apartments.length;

  const getNoticeBadge = (type: Notice['type']) => {
    switch (type) {
      case 'urgent':
        return (
          <span className="bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50 px-2 py-0.5 rounded text-[11px] font-bold">
            {lang === 'ar' ? 'عاجل' : 'URGENT'}
          </span>
        );
      case 'coupure_eau':
        return (
          <span className="bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200 dark:border-sky-900/50 px-2 py-0.5 rounded text-[11px] font-bold inline-flex items-center gap-1">
            <Droplet className="w-3 h-3" />
            {lang === 'ar' ? 'انقطاع المياه' : "Coupure d'eau"}
          </span>
        );
      case 'assemblee':
        return (
          <span className="bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-900/50 px-2 py-0.5 rounded text-[11px] font-bold inline-flex items-center gap-1">
            <Users className="w-3 h-3" />
            {lang === 'ar' ? 'جمعية عامة' : 'Assemblée Générale'}
          </span>
        );
      case 'travaux':
        return (
          <span className="bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50 px-2 py-0.5 rounded text-[11px] font-bold">
            {lang === 'ar' ? 'أشغال' : 'Travaux'}
          </span>
        );
      default:
        return (
          <span className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50 px-2 py-0.5 rounded text-[11px] font-bold">
            {lang === 'ar' ? 'إعلام' : 'Information'}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Subtabs */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                {t('tabNotices')}
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {lang === 'ar'
                ? 'إعلانات السكان، تصويت الملاك، محاضر الجمعية العامة والنظام الداخلي.'
                : 'Communications officielles, votes en ligne, procès-verbaux d’AG et règlement intérieur.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-xs">
              <button
                onClick={() => setSubTab('notices')}
                className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer ${
                  subTab === 'notices'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <Megaphone className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'الإعلانات والتصويت' : 'Avis & Votes'}</span>
              </button>
              <button
                onClick={() => setSubTab('minutes')}
                className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer ${
                  subTab === 'minutes'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'محاضر الجمعية' : 'Procès-Verbaux AG'}</span>
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

            {canManage && subTab === 'notices' && (
              <>
                <button
                  onClick={() => {
                    setEditingVote(null);
                    setIsNewVoteModal(true);
                  }}
                  className="px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  <Vote className="w-3.5 h-3.5" />
                  <span>{t('newVoteBtn')}</span>
                </button>
                <button
                  onClick={() => {
                    setEditingNotice(null);
                    setIsNewNoticeModal(true);
                  }}
                  className="px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{t('newNoticeBtn')}</span>
                </button>
              </>
            )}

            {canManage && subTab === 'minutes' && (
              <button
                onClick={() => {
                  setEditingMinutes(null);
                  setIsNewMinutesModal(true);
                }}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{lang === 'ar' ? 'محضر جديد' : 'Nouveau PV'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Notices & Votes */}
      {subTab === 'notices' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {data.notices.length === 0 ? (
              <EmptyState
                icon={<Megaphone className="w-7 h-7" />}
                title={lang === 'ar' ? 'لا توجد إعلانات حالياً' : 'Aucun avis publié'}
              />
            ) : (
              data.notices.map((notice) => (
                <div
                  key={notice.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {notice.isPinned && <Pin className="w-3.5 h-3.5 text-emerald-600" />}
                        {getNoticeBadge(notice.type)}
                        <span className="text-[11px] text-slate-400 font-mono">
                          {formatDateFr(notice.date, lang)}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">{notice.title}</h3>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        onClick={() => handleShareNoticeWhatsApp(notice)}
                        title="Partager sur le groupe WhatsApp"
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 rounded-lg border border-emerald-200 dark:border-emerald-800 cursor-pointer"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>WhatsApp</span>
                      </button>
                      <button
                        onClick={() => onPrintNotice(notice)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>{t('printA4')}</span>
                      </button>
                      {canManage && (
                        <>
                          <button
                            onClick={() => updateNotice({ ...notice, isPinned: !notice.isPinned })}
                            title={notice.isPinned ? 'Désépingler' : 'Épingler'}
                            className={`p-1.5 rounded-lg border cursor-pointer ${
                              notice.isPinned
                                ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 border-emerald-200 dark:border-emerald-800'
                                : 'bg-slate-50 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 hover:text-emerald-600'
                            }`}
                          >
                            <Pin className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setEditingNotice(notice);
                              setIsNewNoticeModal(true);
                            }}
                            title={t('edit')}
                            className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={async () => {
                              const ok = await confirm({
                                title: lang === 'ar' ? 'حذف الإعلان' : "Supprimer l'avis",
                                message: `Voulez-vous vraiment supprimer l'avis « ${notice.title} » ?`,
                                confirmLabel: lang === 'ar' ? 'حذف' : 'Supprimer',
                                danger: true,
                              });
                              if (ok) await deleteNotice(notice.id);
                            }}
                            title={lang === 'ar' ? 'حذف' : 'Supprimer'}
                            className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                    {notice.message}
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span>{notice.author}</span>
                    <span>{notice.targetAudience}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
              <Vote className="w-4 h-4 text-emerald-600" />
              <span>{lang === 'ar' ? 'تصويت واستشارات الملاك' : 'Votes & Consultations AG'}</span>
            </div>

            {data.votes.map((vote) => {
              const totalCast = vote.options.reduce((a, o) => a + o.votes, 0);
              const isClosed = vote.status === 'closed';
              return (
                <div
                  key={vote.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">{vote.title}</h4>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                        isClosed
                          ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                      }`}
                    >
                      {isClosed ? (lang === 'ar' ? 'مغلق' : 'Clôturé') : lang === 'ar' ? 'جاري' : 'En cours'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500">{vote.description}</p>
                  <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{vote.endDate}</span>
                  </div>

                  <div className="space-y-2">
                    {vote.options.map((opt) => {
                      const pct = totalCast > 0 ? Math.round((opt.votes / totalCast) * 100) : 0;
                      return (
                        <div key={opt.id} className="space-y-1 text-xs">
                          <div className="flex justify-between font-medium">
                            <span className="text-slate-700 dark:text-slate-200">{opt.label}</span>
                            <span className="font-mono text-slate-500">
                              {opt.votes} ({pct}%)
                            </span>
                          </div>
                          <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {canManage && (
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2 text-xs">
                      {!isClosed && (
                        <>
                          <select
                            value={selectedVotingApt}
                            onChange={(e) => setSelectedVotingApt(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                          >
                            {data.apartments.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.number} - {a.resident.name}{' '}
                                {vote.votedApartments.includes(a.id)
                                  ? lang === 'ar'
                                    ? '(تم التصويت)'
                                    : '(A voté)'
                                  : ''}
                              </option>
                            ))}
                          </select>
                          <div className="grid grid-cols-3 gap-1.5">
                            {vote.options.map((opt) => (
                              <button
                                key={opt.id}
                                onClick={() => castVote(vote.id, opt.id, selectedVotingApt)}
                                className="px-2 py-1.5 rounded-lg text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 hover:text-emerald-700 dark:text-slate-200 cursor-pointer"
                              >
                                {opt.id === 'opt-1'
                                  ? lang === 'ar'
                                    ? 'موافق'
                                    : 'Pour'
                                  : opt.id === 'opt-2'
                                  ? lang === 'ar'
                                    ? 'معارض'
                                    : 'Contre'
                                  : lang === 'ar'
                                  ? 'ممتنع'
                                  : 'Abst.'}
                              </button>
                            ))}
                          </div>
                        </>
                      )}

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[11px] text-slate-400">
                          {totalCast} / {vote.totalEligibleApartments}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleVoteStatus(vote.id)}
                            className="text-[11px] font-semibold text-slate-500 hover:text-emerald-600 flex items-center gap-1 cursor-pointer"
                          >
                            {isClosed ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                            <span>
                              {isClosed
                                ? lang === 'ar'
                                  ? 'إعادة فتح'
                                  : 'Rouvrir'
                                : lang === 'ar'
                                ? 'إغلاق التصويت'
                                : 'Clôturer'}
                            </span>
                          </button>
                          <button
                            onClick={() => {
                              setEditingVote(vote);
                              setIsNewVoteModal(true);
                            }}
                            title={t('edit')}
                            className="p-1 rounded text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={async () => {
                              const ok = await confirm({
                                title: lang === 'ar' ? 'حذف التصويت' : 'Supprimer la consultation',
                                message: `Supprimer définitivement le vote « ${vote.title} » ?`,
                                confirmLabel: lang === 'ar' ? 'حذف' : 'Supprimer',
                                danger: true,
                              });
                              if (ok) await deleteVote(vote.id);
                            }}
                            title={lang === 'ar' ? 'حذف' : 'Supprimer'}
                            className="p-1 rounded text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Assembly Minutes */}
      {subTab === 'minutes' && (
        assemblyMinutes.length === 0 ? (
          <EmptyState
            icon={<FileText className="w-7 h-7" />}
            title={lang === 'ar' ? 'لا توجد محاضر مسجلة بعد' : "Aucun Procès-Verbal d'Assemblée Générale"}
          />
        ) : (
          <div className="space-y-4">
            {assemblyMinutes.map((pv) => {
              const occupied = data.apartments.filter((a) => a.occupancy !== 'vacant').length || 1;
              const presencePct = Math.round((pv.presentApartmentIds.length / occupied) * 100);
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

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => onPrintMinutes(pv)}
                        className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs cursor-pointer"
                      >
                        <Printer className="w-4 h-4" />
                        <span>{t('printA4')}</span>
                      </button>
                      {canManage && (
                        <>
                          <button
                            onClick={() => {
                              setEditingMinutes(pv);
                              setIsNewMinutesModal(true);
                            }}
                            title={t('edit')}
                            className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 cursor-pointer"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={async () => {
                              const ok = await confirm({
                                title: lang === 'ar' ? 'حذف المحضر' : 'Supprimer le Procès-Verbal',
                                message: `Supprimer définitivement le PV « ${pv.title} » ?`,
                                confirmLabel: lang === 'ar' ? 'حذف' : 'Supprimer',
                                danger: true,
                              });
                              if (ok) await deleteAssemblyMinutes(pv.id);
                            }}
                            title={lang === 'ar' ? 'حذف' : 'Supprimer'}
                            className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
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
                        {lang === 'ar' ? 'القرارات المتخذة' : 'Résolutions adoptées'}
                      </h4>
                      <ul className="list-disc list-inside space-y-1 text-slate-800 dark:text-slate-200">
                        {pv.decisions.map((dec, i) => (
                          <li key={i}>{dec}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-emerald-600" />
                      <span>
                        {pv.presentApartmentIds.length} / {occupied} ({presencePct}%)
                      </span>
                    </div>
                    <div>
                      <strong>{pv.presidentName}</strong> · <strong>{pv.secretaryName}</strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* House Rules */}
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
            <div className="flex items-center gap-2">
              {canManage && !isEditingRules && (
                <button
                  onClick={() => {
                    setRulesDraft(houseRules.map((s) => ({ ...s, items: [...s.items] })));
                    setIsEditingRules(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>{t('edit')}</span>
                </button>
              )}
              {canManage && isEditingRules && (
                <>
                  <button
                    onClick={() => setIsEditingRules(false)}
                    className="px-3 py-2 text-xs text-slate-500 cursor-pointer"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    onClick={async () => {
                      await updateHouseRules(rulesDraft);
                      setIsEditingRules(false);
                    }}
                    className="flex items-center gap-1 px-3 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{t('save')}</span>
                  </button>
                </>
              )}
              <button
                onClick={onPrintHouseRules}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>{t('printRulesBtn')}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(isEditingRules ? rulesDraft : houseRules).map((sec, idx) => (
              <div
                key={sec.id}
                className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 space-y-2.5 text-xs"
              >
                {isEditingRules ? (
                  <>
                    <input
                      type="text"
                      value={sec.title}
                      onChange={(e) => {
                        const next = [...rulesDraft];
                        next[idx] = { ...next[idx], title: e.target.value };
                        setRulesDraft(next);
                      }}
                      className="w-full px-2.5 py-1.5 font-bold rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    />
                    <textarea
                      rows={5}
                      value={sec.items.join('\n')}
                      onChange={(e) => {
                        const next = [...rulesDraft];
                        next[idx] = { ...next[idx], items: e.target.value.split('\n') };
                        setRulesDraft(next);
                      }}
                      className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    />
                  </>
                ) : (
                  <>
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm">{sec.title}</h4>
                    <ul className="list-disc list-inside space-y-1.5 text-slate-700 dark:text-slate-300 leading-relaxed">
                      {sec.items.filter(Boolean).map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {isNewNoticeModal && (
        <NewNoticeModal
          initialNotice={editingNotice}
          onClose={() => {
            setIsNewNoticeModal(false);
            setEditingNotice(null);
          }}
          onSubmit={editingNotice ? updateNotice : addNotice}
        />
      )}
      {isNewVoteModal && (
        <NewVoteModal
          eligibleCount={eligibleCount}
          initialVote={editingVote}
          onClose={() => {
            setIsNewVoteModal(false);
            setEditingVote(null);
          }}
          onSubmit={editingVote ? updateVote : addVote}
        />
      )}
      {isNewMinutesModal && (
        <NewMinutesModal
          buildingNumber={data.building.buildingNumber}
          apartments={data.apartments}
          defaultPresident={data.building.committee?.president || data.building.syndicPresident}
          defaultSecretary={data.building.committee?.treasurer || 'Secrétaire'}
          initialMinutes={editingMinutes}
          onClose={() => {
            setIsNewMinutesModal(false);
            setEditingMinutes(null);
          }}
          onSubmit={editingMinutes ? updateAssemblyMinutes : addAssemblyMinutes}
        />
      )}
    </div>
  );
};
