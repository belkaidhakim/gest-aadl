import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Send,
  MessageSquare,
  ShieldCheck,
  User,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Phone,
  Wrench,
  Pencil,
  Trash2,
  Check,
} from 'lucide-react';
import { Apartment, Incident, UserRole } from '../types';
import { useAppStore } from '../stores/AppStore';
import { useI18n } from '../i18n';
import { canManageMaintenance } from '../utils/permissions';
import { useConfirm } from './ui/ConfirmDialog';

export const RESIDENT_CHAT_ID_KEY = 'gest_aadl_resident_chat_id';

interface SavedResidentIdentity {
  apartmentNumber: string;
  name: string;
}

export function loadSavedResidentIdentity(defaultApt = ''): SavedResidentIdentity {
  try {
    const raw = localStorage.getItem(RESIDENT_CHAT_ID_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        apartmentNumber: String(parsed.apartmentNumber || defaultApt),
        name: String(parsed.name || ''),
      };
    }
  } catch {
    // ignore
  }
  return { apartmentNumber: defaultApt, name: '' };
}

export function saveResidentIdentity(apartmentNumber: string, name: string): void {
  try {
    localStorage.setItem(
      RESIDENT_CHAT_ID_KEY,
      JSON.stringify({ apartmentNumber: apartmentNumber.trim(), name: name.trim() })
    );
  } catch {
    // ignore
  }
}

interface IncidentChatDrawerProps {
  incident: Incident | null;
  apartments: Apartment[];
  syndicPresident: string;
  syndicPhone: string;
  onClose: () => void;
}

export const IncidentChatDrawer: React.FC<IncidentChatDrawerProps> = ({
  incident,
  apartments,
  syndicPresident,
  syndicPhone,
  onClose,
}) => {
  const { lang, t } = useI18n();
  const { confirm } = useConfirm();
  const {
    data,
    role,
    isBureau,
    serverConnected,
    sendIncidentMessage,
    updateIncidentMessage,
    deleteIncidentMessage,
    clearIncidentMessages,
    deleteIncident,
    canEditOwnMessage,
    syncIncidentMessages,
    updateIncidentStatus,
  } = useAppStore();

  const liveIncident = incident
    ? data.incidents.find((i) => i.id === incident.id) || incident
    : null;

  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [residentIdentity, setResidentIdentity] = useState<SavedResidentIdentity>(() =>
    loadSavedResidentIdentity(apartments[0]?.number || '')
  );

  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!liveIncident) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [liveIncident, onClose]);

  useEffect(() => {
    if (!liveIncident) return;
    setResidentIdentity(loadSavedResidentIdentity(apartments[0]?.number || ''));
  }, [liveIncident?.id, apartments]);

  // Live polling every 8 seconds while chat drawer is open
  useEffect(() => {
    if (!liveIncident?.id || !serverConnected) return;
    syncIncidentMessages(liveIncident.id);
    const timer = window.setInterval(() => {
      syncIncidentMessages(liveIncident.id);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [liveIncident?.id, serverConnected, syncIncidentMessages]);

  const messages = liveIncident?.messages || [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, liveIncident?.id]);

  if (!liveIncident) return null;

  const isResolved = liveIncident.status === 'resolu';
  const canModerate = isBureau && canManageMaintenance(role);
  const canTakeCharge = canModerate && liveIncident.status === 'signale';

  const handleSaveMsgEdit = async (msgId: string) => {
    const clean = editingText.trim();
    if (!clean || savingEdit) return;
    setSavingEdit(true);
    try {
      const ok = await updateIncidentMessage(liveIncident.id, msgId, clean);
      if (ok) {
        setEditingMsgId(null);
        setEditingText('');
      }
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteMsg = async (msgId: string, preview: string) => {
    const ok = await confirm({
      title: lang === 'ar' ? 'حذف الرسالة' : 'Supprimer ce message ?',
      message:
        lang === 'ar'
          ? `هل تريد حذف الرسالة: "${preview.slice(0, 80)}"؟`
          : `Confirmez-vous la suppression du message « ${preview.slice(0, 80)} » ?`,
      confirmLabel: lang === 'ar' ? 'حذف' : 'Supprimer',
      cancelLabel: t('cancel'),
      danger: true,
    });
    if (ok) {
      await deleteIncidentMessage(liveIncident.id, msgId);
      if (editingMsgId === msgId) {
        setEditingMsgId(null);
        setEditingText('');
      }
    }
  };

  const handleClearDiscussion = async () => {
    const ok = await confirm({
      title: lang === 'ar' ? 'مسح المحادثة بالكامل' : 'Vider toute la discussion ?',
      message:
        lang === 'ar'
          ? `سيتم حذف جميع الرسائل (${messages.length}) المرتبطة بهذا العطل مع الإبقاء على البلاغ.`
          : `Tous les messages (${messages.length}) de cette discussion seront supprimés. Le signalement de panne sera conservé.`,
      confirmLabel: lang === 'ar' ? 'مسح المحادثة' : 'Vider la discussion',
      cancelLabel: t('cancel'),
      danger: true,
    });
    if (ok) {
      await clearIncidentMessages(liveIncident.id);
    }
  };

  const handleDeleteEntireIncident = async () => {
    const ok = await confirm({
      title: lang === 'ar' ? 'حذف البلاغ والمحادثة' : 'Supprimer ce signalement et sa discussion ?',
      message:
        lang === 'ar'
          ? `سيتم حذف العطل "${liveIncident.title}" وجميع رسائله نهائياً.`
          : `Le signalement « ${liveIncident.title} » ainsi que toute sa discussion seront définitivement supprimés.`,
      confirmLabel: lang === 'ar' ? 'حذف نهائي' : 'Supprimer',
      cancelLabel: t('cancel'),
      danger: true,
    });
    if (ok) {
      await deleteIncident(liveIncident.id);
      onClose();
    }
  };

  const formatTime = (iso: string) => {
    try {
      return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-DZ' : 'fr-FR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(iso));
    } catch {
      return iso.slice(0, 16);
    }
  };

  const getRoleBadge = (senderRole: UserRole) => {
    if (senderRole === 'president') {
      return {
        label: lang === 'ar' ? 'رئيس السانديك' : 'Président du Syndic',
        cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
      };
    }
    if (senderRole === 'technical') {
      return {
        label: lang === 'ar' ? 'المسؤول التقني' : 'Resp. Technique',
        cls: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border-sky-200 dark:border-sky-800',
      };
    }
    if (senderRole === 'treasurer') {
      return {
        label: lang === 'ar' ? 'أمين المال' : 'Trésorier',
        cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-800',
      };
    }
    return {
      label: lang === 'ar' ? 'ساكن' : 'Résident',
      cls: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    };
  };

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      await syncIncidentMessages(liveIncident.id);
    } finally {
      setSyncing(false);
    }
  };

  const handleSend = async (customText?: string) => {
    const content = (customText ?? text).trim();
    if (!content || sending) return;

    const cleanName = residentIdentity.name.trim();
    const aptNum = residentIdentity.apartmentNumber.trim();
    if (!isBureau) {
      saveResidentIdentity(aptNum, cleanName);
    }

    const composedSender = cleanName
      ? `${cleanName}${aptNum ? ` (${aptNum})` : ''}`
      : aptNum
      ? `${lang === 'ar' ? 'ساكن' : 'Résident'} (${aptNum})`
      : lang === 'ar'
      ? 'ساكن بالعمارة'
      : 'Résident';

    setSending(true);
    try {
      const sent = await sendIncidentMessage(liveIncident.id, {
        text: content,
        senderName: isBureau ? undefined : composedSender,
        apartmentNumber: isBureau ? undefined : aptNum || undefined,
      });
      if (sent && customText === undefined) {
        setText('');
      }
    } finally {
      setSending(false);
    }
  };

  const quickReplies = isBureau
    ? lang === 'ar'
      ? [
          'تم استلام البلاغ، سنتحقق فوراً.',
          'تم الاتصال بشركة الصيانة المختصة.',
          'التقني بصدد التدخل حالياً في العمارة.',
          'تم إصلاح العطل، شكراً على التبليغ.',
        ]
      : [
          'Bien reçu, je vérifie immédiatement.',
          'La société de maintenance a été contactée.',
          'Le technicien est en cours d’intervention.',
          'Panne réparée, merci pour votre signalement.',
        ]
    : lang === 'ar'
    ? ['العطل لا يزال مستمراً حالياً', 'التقني متواجد في عين المكان', 'تم حل المشكلة، شكراً لكم']
    : ['Le problème persiste actuellement', 'Le technicien est sur place', 'C’est réglé, merci pour votre réactivité !'];

  return (
    <div className="fixed inset-0 z-[60] flex justify-end no-print">
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
      />

      <aside className="relative z-10 w-full max-w-lg bg-white dark:bg-slate-900 border-s border-slate-200 dark:border-slate-800 h-full shadow-2xl flex flex-col">
        {/* Top Chat Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900 space-y-2.5 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
                    {lang === 'ar' ? 'قناة تواصل مباشر — متابعة العطل' : 'Canal Direct Président — Suivi Panne'}
                  </h3>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {serverConnected
                      ? lang === 'ar'
                        ? 'مباشر'
                        : 'En direct'
                      : lang === 'ar'
                      ? 'محلي'
                      : 'Local'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  {isBureau
                    ? `${lang === 'ar' ? 'مبلّغ من طرف:' : 'Signalé par :'} ${liveIncident.reportedBy}`
                    : `${lang === 'ar' ? 'مباشرة مع الرئيس:' : 'Avec'} ${syndicPresident}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {canModerate && messages.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearDiscussion}
                  title={lang === 'ar' ? 'مسح جميع الرسائل' : 'Vider la discussion'}
                  className="px-2 py-1 rounded-lg text-[11px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 border border-amber-200 dark:border-amber-800 cursor-pointer"
                >
                  {lang === 'ar' ? 'مسح الرسائل' : 'Vider'}
                </button>
              )}
              {canModerate && (
                <button
                  type="button"
                  onClick={handleDeleteEntireIncident}
                  title={lang === 'ar' ? 'حذف البلاغ والمحادثة' : 'Supprimer le signalement et la discussion'}
                  className="p-1.5 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              {serverConnected && (
                <button
                  type="button"
                  onClick={handleManualSync}
                  title={lang === 'ar' ? 'تحديث المحادثة' : 'Actualiser la discussion'}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin text-emerald-600' : ''}`} />
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Incident Context Strip */}
          <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/70 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="min-w-0">
              <div className="font-bold text-slate-900 dark:text-white truncate">{liveIncident.title}</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {liveIncident.location}
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {isResolved ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  <CheckCircle2 className="w-3 h-3" />
                  {lang === 'ar' ? 'تم الحل' : 'Résolu'}
                </span>
              ) : liveIncident.status === 'en_cours' ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                  <Clock className="w-3 h-3" />
                  {lang === 'ar' ? 'قيد الإصلاح' : 'En cours'}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  <AlertTriangle className="w-3 h-3" />
                  {lang === 'ar' ? 'مُبلّغ' : 'Signalé'}
                </span>
              )}

              {canTakeCharge && (
                <button
                  type="button"
                  onClick={() => updateIncidentStatus(liveIncident.id, 'en_cours')}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-semibold cursor-pointer"
                >
                  <Wrench className="w-3 h-3" />
                  <span>{lang === 'ar' ? 'تكفل' : 'Prendre en charge'}</span>
                </button>
              )}

              {!isBureau && syndicPhone && syndicPhone !== '-' && (
                <a
                  href={`tel:${syndicPhone}`}
                  title={lang === 'ar' ? 'اتصال هاتفي عاجل' : 'Appeler le Président'}
                  className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                >
                  <Phone className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Messages Scroll Area */}
        <div className="grow overflow-y-auto px-4 py-4 space-y-3 bg-slate-50/50 dark:bg-slate-950/40">
          {/* Initial Report Summary Card if no messages yet or as context */}
          {liveIncident.description && messages.length === 0 && (
            <div className="p-3 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/50 text-xs space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                {lang === 'ar' ? 'تفاصيل البلاغ الأولي' : 'Description initiale du signalement'}
              </div>
              <p className="text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-line">
                {liveIncident.description}
              </p>
            </div>
          )}

          {messages.length === 0 ? (
            <div className="py-10 text-center space-y-2 text-xs text-slate-500 dark:text-slate-400">
              <MessageSquare className="w-8 h-8 text-emerald-500/70 mx-auto" />
              <p className="font-semibold text-slate-700 dark:text-slate-200">
                {lang === 'ar'
                  ? 'ابدأ المحادثة حول هذا العطل'
                  : 'Aucun message dans ce fil pour le moment'}
              </p>
              <p className="max-w-xs mx-auto text-[11px]">
                {isBureau
                  ? lang === 'ar'
                    ? 'أرسل رداً لطمأنة السكان وإعلامهم بتقدم التدخل التقني.'
                    : 'Écrivez un message pour informer les résidents de la prise en charge ou de l’avancement.'
                  : lang === 'ar'
                  ? 'اكتب رسالتك هنا للتواصل مباشرة مع رئيس مكتب السانديك بخصوص هذا العطل.'
                  : 'Écrivez un message ci-dessous pour échanger directement avec le Président du Syndic.'}
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const msgIsBureau =
                msg.senderRole === 'president' ||
                msg.senderRole === 'treasurer' ||
                msg.senderRole === 'technical';
              const isOwnSide = isBureau ? msgIsBureau : !msgIsBureau;
              const badge = getRoleBadge(msg.senderRole);
              const canEditMsg = canModerate || (!msgIsBureau && canEditOwnMessage(msg.id));
              const isEditingThis = editingMsgId === msg.id;

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isOwnSide ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] flex-wrap">
                    {msgIsBureau ? (
                      <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    ) : (
                      <User className="w-3 h-3 text-slate-400 shrink-0" />
                    )}
                    <span className="font-bold text-slate-700 dark:text-slate-300">{msg.senderName}</span>
                    <span className={`px-1.5 py-0.2 rounded border text-[9px] font-semibold ${badge.cls}`}>
                      {badge.label}
                    </span>
                    <span className="font-mono text-slate-400">
                      {formatTime(msg.timestamp)}
                      {msg.editedAt ? (lang === 'ar' ? ' (معدّل)' : ' (modifié)') : ''}
                    </span>
                    {canEditMsg && !isEditingThis && (
                      <span className="inline-flex items-center gap-1 ms-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingMsgId(msg.id);
                            setEditingText(msg.text);
                          }}
                          title={lang === 'ar' ? 'تعديل الرسالة' : 'Modifier ce message'}
                          className="p-0.5 rounded text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 cursor-pointer"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteMsg(msg.id, msg.text)}
                          title={lang === 'ar' ? 'حذف الرسالة' : 'Supprimer ce message'}
                          className="p-0.5 rounded text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </span>
                    )}
                  </div>

                  {isEditingThis ? (
                    <div className="w-full max-w-[90%] rounded-2xl p-2.5 bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 shadow-xs space-y-2">
                      <textarea
                        rows={2}
                        maxLength={800}
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSaveMsgEdit(msg.id);
                          } else if (e.key === 'Escape') {
                            setEditingMsgId(null);
                            setEditingText('');
                          }
                        }}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-white resize-none"
                      />
                      <div className="flex items-center justify-end gap-1.5 text-[11px]">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingMsgId(null);
                            setEditingText('');
                          }}
                          className="px-2.5 py-1 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                        >
                          {t('cancel')}
                        </button>
                        <button
                          type="button"
                          disabled={savingEdit || !editingText.trim()}
                          onClick={() => handleSaveMsgEdit(msg.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold cursor-pointer"
                        >
                          <Check className="w-3 h-3" />
                          <span>{t('save')}</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`max-w-[86%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-line shadow-2xs ${
                        msgIsBureau
                          ? isOwnSide
                            ? 'bg-emerald-600 text-white rounded-ee-sm'
                            : 'bg-emerald-50 dark:bg-emerald-950/60 text-slate-900 dark:text-emerald-50 border border-emerald-200 dark:border-emerald-800/80 rounded-es-sm'
                          : isOwnSide
                          ? 'bg-slate-900 dark:bg-emerald-600 text-white rounded-ee-sm'
                          : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-es-sm'
                      }`}
                    >
                      {msg.text}
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Composer Footer */}
        <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2.5 shrink-0">
          {/* Quick Reply Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {quickReplies.map((qr) => (
              <button
                key={qr}
                type="button"
                disabled={sending}
                onClick={() => handleSend(qr)}
                className="shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 hover:text-emerald-700 dark:hover:text-emerald-300 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 transition-colors cursor-pointer"
              >
                {qr}
              </button>
            ))}
          </div>

          {/* Resident Apartment / Name compact bar */}
          {!isBureau && (
            <div className="grid grid-cols-5 gap-2 text-[11px]">
              <select
                value={residentIdentity.apartmentNumber}
                onChange={(e) => {
                  const next = { ...residentIdentity, apartmentNumber: e.target.value };
                  setResidentIdentity(next);
                  saveResidentIdentity(next.apartmentNumber, next.name);
                }}
                aria-label={lang === 'ar' ? 'رقم الشقة' : "N° d'appartement"}
                className="col-span-2 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold"
              >
                <option value="">{lang === 'ar' ? 'الشقة...' : 'Logement...'}</option>
                {apartments.map((apt) => (
                  <option key={apt.id} value={apt.number}>
                    {apt.number}
                  </option>
                ))}
              </select>
              <input
                type="text"
                maxLength={50}
                value={residentIdentity.name}
                onChange={(e) => {
                  const next = { ...residentIdentity, name: e.target.value };
                  setResidentIdentity(next);
                  saveResidentIdentity(next.apartmentNumber, next.name);
                }}
                placeholder={lang === 'ar' ? 'اسمك (اختياري)' : 'Votre nom (optionnel)'}
                className="col-span-3 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          )}

          {/* Input + Send */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-end gap-2"
          >
            <textarea
              rows={2}
              maxLength={800}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={
                isBureau
                  ? lang === 'ar'
                    ? 'اكتب رد المكتب للسكان (Enter للإرسال)...'
                    : 'Répondre aux résidents en tant que Bureau Syndic (Entrée pour envoyer)...'
                  : lang === 'ar'
                  ? 'اكتب رسالتك لرئيس السانديك (Enter للإرسال)...'
                  : 'Écrire au Président du Syndic (Entrée pour envoyer)...'
              }
              className="grow px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            />
            <button
              type="submit"
              disabled={sending || !text.trim()}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-xs inline-flex items-center gap-1.5 cursor-pointer shrink-0 shadow-xs"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? 'إرسال' : 'Envoyer'}</span>
            </button>
          </form>
        </div>
      </aside>
    </div>
  );
};
