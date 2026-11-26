import React, { useEffect, useState } from 'react';
import {
  Building,
  DoorClosed,
  Check,
  X,
  Phone,
  FileCheck,
  Plus,
  Search,
  Droplet,
  Copy,
  Clock,
  KeyRound,
  Award,
  Share2,
} from 'lucide-react';
import { Apartment, PaymentRecord } from '../../types';
import {
  buildWhatsAppUrl,
  formatDZD,
  formatMonthName,
  generateDefaultPinForApt,
  generateFeeReminderText,
  getAvailableFeePeriods,
  getCurrentMonthStr,
} from '../../utils/helpers';
import { useI18n } from '../../i18n';
import { useAppStore } from '../../stores/AppStore';
import { canManageApartments, canManageFinance } from '../../utils/permissions';
import { SlideOverDrawer } from '../../components/ui/SlideOverDrawer';
import { useToast } from '../../components/ui/ToastProvider';

interface BuildingMatrixPageProps {
  onRecordPaymentForApt: (apt: Apartment) => void;
  onViewReceipt: (payment: PaymentRecord) => void;
  onOpenQuitus?: (apt: Apartment) => void;
}

export const BuildingMatrixPage: React.FC<BuildingMatrixPageProps> = ({
  onRecordPaymentForApt,
  onViewReceipt,
  onOpenQuitus,
}) => {
  const { lang, t } = useI18n();
  const { data, role, updateApartment } = useAppStore();
  const toast = useToast();

  const canEditApt = canManageApartments(role);
  const canCollect = canManageFinance(role);

  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthStr());
  const [filterStatus, setFilterStatus] = useState<'all' | 'paid' | 'partial' | 'unpaid' | 'due' | 'vacant'>('all');
  const [selectedFloorFilter, setSelectedFloorFilter] = useState<number | 'all'>('all');
  const [filterType, setFilterType] = useState<'all' | 'F3' | 'F4'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedApt, setSelectedApt] = useState<Apartment | null>(null);
  const [isEditingResident, setIsEditingResident] = useState<boolean>(false);
  const [editForm, setEditForm] = useState<{
    name: string;
    birthDate: string;
    phone: string;
    folder: string;
    occupancy: 'owner' | 'tenant' | 'vacant';
    tenantName: string;
    tenantPhone: string;
    emergencyName: string;
    emergencyPhone: string;
    badgesCount: number;
    keysNotes: string;
    residentPin: string;
  }>({
    name: '',
    birthDate: '',
    phone: '',
    folder: '',
    occupancy: 'owner',
    tenantName: '',
    tenantPhone: '',
    emergencyName: '',
    emergencyPhone: '',
    badgesCount: 2,
    keysNotes: '',
    residentPin: '',
  });

  const availablePeriods = getAvailableFeePeriods(
    data.building.feeFrequency || 'annuel',
    data.payments,
    data.transactions
  );

  const paymentsForMonth = data.payments.filter((p) => p.month === selectedMonth);
  const paidAmountByAptId = new Map<string, number>();
  paymentsForMonth.forEach((p) => {
    paidAmountByAptId.set(p.apartmentId, (paidAmountByAptId.get(p.apartmentId) || 0) + p.amountDZD);
  });
  const paidAptIds = new Set(paymentsForMonth.map((p) => p.apartmentId));
  const standardFee = data.building.standardMonthlyFeeDZD;

  const maxFloor = Math.max(data.building.totalFloors || 0, ...data.apartments.map((a) => a.floor));
  const floorNumbers = Array.from({ length: maxFloor + 1 }, (_, i) => maxFloor - i);
  const vacantCount = data.apartments.filter((a) => a.occupancy === 'vacant').length;
  const isAnnual = (data.building.feeFrequency || 'annuel') === 'annuel';

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('gest_aadl_matrix_jump');
      if (raw) {
        const parsed = JSON.parse(raw) as {
          floor?: number;
          status?: 'all' | 'paid' | 'partial' | 'unpaid' | 'due' | 'vacant';
        };
        if (typeof parsed.floor === 'number') {
          setSelectedFloorFilter(parsed.floor);
        }
        if (parsed.status) {
          setFilterStatus(parsed.status);
        }
        sessionStorage.removeItem('gest_aadl_matrix_jump');
      }
    } catch {
      // ignore
    }
  }, []);

  const getAptPaidAmount = (aptId: string): number => paidAmountByAptId.get(aptId) || 0;

  const getApartmentStatus = (apt: Apartment): 'paid' | 'partial' | 'unpaid' | 'vacant' => {
    if (apt.occupancy === 'vacant') return 'vacant';
    const paidAmt = getAptPaidAmount(apt.id);
    if (paidAmt <= 0) return 'unpaid';
    if (standardFee > 0 && paidAmt < standardFee) return 'partial';
    return 'paid';
  };

  const getAptPin = (apt: Apartment) => {
    if (apt.residentPin) return apt.residentPin;
    const idx = Math.max(0, data.apartments.findIndex((a) => a.id === apt.id));
    return generateDefaultPinForApt(apt.id, idx);
  };

  const handleOpenAptDetails = (apt: Apartment) => {
    setSelectedApt(apt);
    setEditForm({
      name: apt.resident.name,
      birthDate: apt.resident.birthDate || '',
      phone: apt.resident.phone,
      folder: apt.resident.aadlFolderNumber || '',
      occupancy: apt.occupancy,
      tenantName: apt.tenant?.name || '',
      tenantPhone: apt.tenant?.phone || '',
      emergencyName: apt.resident.emergencyContactName || '',
      emergencyPhone: apt.resident.emergencyContactPhone || '',
      badgesCount: apt.resident.badgesCount ?? 2,
      keysNotes: apt.resident.keysNotes || '',
      residentPin: getAptPin(apt),
    });
    setIsEditingResident(false);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApt) return;
    const cleanPin = editForm.residentPin.replace(/\D/g, '').slice(0, 4);
    const updated: Apartment = {
      ...selectedApt,
      occupancy: editForm.occupancy,
      residentPin: cleanPin.length === 4 ? cleanPin : getAptPin(selectedApt),
      resident: {
        ...selectedApt.resident,
        name: editForm.name,
        birthDate: editForm.birthDate.trim() || undefined,
        phone: editForm.phone,
        aadlFolderNumber: editForm.folder,
        emergencyContactName: editForm.emergencyName.trim() || undefined,
        emergencyContactPhone: editForm.emergencyPhone.trim() || undefined,
        badgesCount: Number(editForm.badgesCount) || 0,
        keysNotes: editForm.keysNotes.trim() || undefined,
      },
      tenant:
        editForm.occupancy === 'tenant' && editForm.tenantName.trim()
          ? { name: editForm.tenantName.trim(), phone: editForm.tenantPhone.trim() || '-' }
          : undefined,
    };
    await updateApartment(updated);
    setSelectedApt(updated);
    setIsEditingResident(false);
  };

  const handleSendPinWhatsApp = (apt: Apartment) => {
    const pin = getAptPin(apt);
    const portalUrl = typeof window !== 'undefined' ? window.location.origin : 'https://gest-aadl.vercel.app';
    const msg = [
      `🔑 *ACCÈS ESPACE RÉSIDENT — ${data.building.buildingNumber}* (${data.building.residenceName})`,
      `Bonjour ${apt.resident.name} (Porte *${apt.number}*),`,
      '',
      `Voici votre Code PIN confidentiel à 4 chiffres pour consulter vos quittances, déclarer un virement BaridiMob/CCP et voter en ligne :`,
      `👉 Logement : *${apt.number}*`,
      `👉 Code PIN : *${pin}*`,
      `🌐 Lien de l'application : ${portalUrl}`,
      '',
      `Syndic ${data.building.syndicPresident}`,
    ].join('\n');
    navigator.clipboard.writeText(msg).catch(() => {});
    const direct = buildWhatsAppUrl(apt.resident.phone, msg);
    toast.success(`Code PIN ${pin} copié et prêt pour WhatsApp`);
    window.open(direct || `https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
  };

  const handleCopyReminder = (apt: Apartment) => {
    const paidAmt = getAptPaidAmount(apt.id);
    const remainingAmt = Math.max(0, standardFee - paidAmt) || standardFee;
    const text = generateFeeReminderText(
      apt.resident.name,
      apt.number,
      data.building.buildingNumber,
      [selectedMonth],
      remainingAmt,
      data.building.syndicPhone,
      data.building.syndicPresident,
      lang
    );
    navigator.clipboard.writeText(text);
    toast.success(t('messageCopied'));
  };

  const isAptVisible = (apt: Apartment) => {
    if (selectedFloorFilter !== 'all' && apt.floor !== selectedFloorFilter) return false;
    const status = getApartmentStatus(apt);
    if (filterStatus === 'due') {
      if (status !== 'unpaid' && status !== 'partial') return false;
    } else if (filterStatus !== 'all' && status !== filterStatus) {
      return false;
    }
    if (filterType !== 'all' && apt.type !== filterType) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const qNoSpace = q.replace(/\s+/g, '');
      const matchNum = apt.number.toLowerCase().includes(q);
      const matchName = apt.resident.name.toLowerCase().includes(q);
      const matchFolder = (apt.resident.aadlFolderNumber || '').toLowerCase().includes(q);
      const matchPhone = (apt.resident.phone || '').replace(/\s+/g, '').toLowerCase().includes(qNoSpace);
      if (!matchNum && !matchName && !matchFolder && !matchPhone) return false;
    }
    return true;
  };

  const aptPaymentsHistory = selectedApt
    ? data.payments.filter((p) => p.apartmentId === selectedApt.id)
    : [];

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Building className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span>{t('matrixTitle')} {data.building.buildingNumber}</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t('matrixSubtitle')}</p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{t('period')}</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            >
              {availablePeriods.map((p) => (
                <option key={p} value={p}>
                  {formatMonthName(p, lang)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-medium">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1.5 rounded-lg cursor-pointer ${
                filterStatus === 'all' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm font-semibold' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {t('all')} ({data.apartments.length})
            </button>
            <button
              onClick={() => setFilterStatus('paid')}
              className={`px-3 py-1.5 rounded-lg cursor-pointer flex items-center gap-1.5 ${
                filterStatus === 'paid' ? 'bg-emerald-600 text-white shadow-sm font-semibold' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>{t('upToDate')} ({data.apartments.filter((a) => getApartmentStatus(a) === 'paid').length})</span>
            </button>
            <button
              onClick={() => setFilterStatus('partial')}
              className={`px-3 py-1.5 rounded-lg cursor-pointer flex items-center gap-1.5 ${
                filterStatus === 'partial' ? 'bg-amber-600 text-white shadow-sm font-semibold' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span>
                {lang === 'ar' ? 'دفع جزئي' : 'Partiel'} ({data.apartments.filter((a) => getApartmentStatus(a) === 'partial').length})
              </span>
            </button>
            <button
              onClick={() => setFilterStatus('unpaid')}
              className={`px-3 py-1.5 rounded-lg cursor-pointer flex items-center gap-1.5 ${
                filterStatus === 'unpaid' ? 'bg-rose-600 text-white shadow-sm font-semibold' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-rose-400" />
              <span>{t('unpaid')} ({data.apartments.filter((a) => getApartmentStatus(a) === 'unpaid').length})</span>
            </button>
            <button
              onClick={() => setFilterStatus('due')}
              className={`px-3 py-1.5 rounded-lg cursor-pointer flex items-center gap-1.5 ${
                filterStatus === 'due' ? 'bg-rose-600 text-white shadow-sm font-semibold' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <span>
                {lang === 'ar' ? 'مستحق التحصيل' : 'À recouvrer'} (
                {data.apartments.filter((a) => {
                  const st = getApartmentStatus(a);
                  return st === 'unpaid' || st === 'partial';
                }).length}
                )
              </span>
            </button>
            <button
              onClick={() => setFilterStatus('vacant')}
              className={`px-3 py-1.5 rounded-lg cursor-pointer ${
                filterStatus === 'vacant' ? 'bg-slate-700 text-white shadow-sm font-semibold' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {t('vacantApts')} ({vacantCount})
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 grow sm:grow-0">
            <select
              value={selectedFloorFilter === 'all' ? 'all' : String(selectedFloorFilter)}
              onChange={(e) => setSelectedFloorFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
            >
              <option value="all">{t('allFloors')}</option>
              <option value="0">{t('rdc')}</option>
              {Array.from({ length: maxFloor }, (_, i) => i + 1).map((f) => (
                <option key={f} value={String(f)}>
                  {t('floor')} {f}
                </option>
              ))}
            </select>

            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as 'all' | 'F3' | 'F4')}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            >
              <option value="all">{t('allTypes')}</option>
              <option value="F3">F3</option>
              <option value="F4">F4</option>
            </select>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute start-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('searchAptPlaceholder')}
                className="text-xs ps-8 pe-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white w-48 sm:w-56"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Floor Matrix */}
      <div className="space-y-3">
        {floorNumbers.map((floor) => {
          const aptsOnFloor = data.apartments.filter((a) => a.floor === floor);
          if (!aptsOnFloor.some(isAptVisible)) return null;

          const floorOccupied = aptsOnFloor.filter((a) => a.occupancy !== 'vacant');
          const floorExpected = floorOccupied.length * standardFee;
          const floorCollected = aptsOnFloor.reduce((sum, a) => sum + getAptPaidAmount(a.id), 0);

          return (
            <div key={`floor-${floor}`} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-100 dark:border-slate-800 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-slate-900 dark:text-white text-sm">
                    {floor === 0 ? t('rdc') : `${t('floor')} ${floor}`}
                  </span>
                  <span className="text-slate-400">·</span>
                  <span className="text-slate-500 dark:text-slate-400">
                    {floor === 0 ? t('hallEntrance') : `${t('landing')} ${floor}`}
                  </span>
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {aptsOnFloor.length}{' '}
                    {lang === 'ar' ? 'شقة' : aptsOnFloor.length > 1 ? 'logements' : 'logement'}
                  </span>
                </div>

                <div className="flex items-center gap-2.5 text-[11px]">
                  <span
                    className={`font-mono font-bold px-2.5 py-0.5 rounded-full border ${
                      floorCollected >= floorExpected && floorExpected > 0
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                        : floorCollected > 0
                        ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                        : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                    }`}
                  >
                    {formatDZD(floorCollected, lang)} / {formatDZD(floorExpected, lang)}
                  </span>
                  <div className="hidden sm:flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                    <span>{t('elevatorLanding')} {floor}</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {aptsOnFloor.map((apt) => {
                  const status = getApartmentStatus(apt);
                  if (!isAptVisible(apt)) return null;
                  const isSelected = selectedApt?.id === apt.id;
                  const paidAmt = getAptPaidAmount(apt.id);
                  const hasPhone = Boolean(apt.resident.phone && apt.resident.phone !== '-');

                  return (
                    <button
                      key={apt.id}
                      onClick={() => handleOpenAptDetails(apt)}
                      className={`text-start p-3 rounded-xl border transition-all cursor-pointer relative ${
                        isSelected
                          ? 'ring-2 ring-emerald-500 border-transparent bg-emerald-50/50 dark:bg-emerald-950/20'
                          : status === 'paid'
                          ? 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/25 dark:bg-emerald-950/10 hover:border-emerald-400'
                          : status === 'partial'
                          ? 'border-amber-300 dark:border-amber-800/70 bg-amber-50/35 dark:bg-amber-950/15 hover:border-amber-400'
                          : status === 'unpaid'
                          ? 'border-rose-200 dark:border-rose-900/60 bg-rose-50/25 dark:bg-rose-950/10 hover:border-rose-400'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 hover:border-slate-400'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <DoorClosed className="w-4 h-4 text-slate-400" />
                          <span className="font-bold text-sm text-slate-900 dark:text-white">{apt.number}</span>
                        </div>
                        <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {apt.type} ({apt.surfaceM2}m²)
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                          {apt.resident.name}
                        </p>
                        {apt.resident.isSyndicMember && (
                          <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            {t('syndic')}
                          </span>
                        )}
                      </div>

                      <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                        <Phone className="w-3 h-3 shrink-0 text-slate-400" />
                        <span className="truncate" dir={hasPhone ? 'ltr' : undefined}>
                          {hasPhone
                            ? apt.resident.phone
                            : lang === 'ar'
                            ? 'الهاتف غير مسجل'
                            : 'Tél. non renseigné'}
                        </span>
                      </div>

                      <div className="mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between gap-1 text-[11px] font-mono">
                        {status === 'paid' && (
                          <span className="text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1">
                            <Check className="w-3.5 h-3.5 shrink-0" />
                            <span>
                              {t('paid')} · {formatDZD(paidAmt, lang)}
                            </span>
                          </span>
                        )}
                        {status === 'partial' && (
                          <span className="text-amber-700 dark:text-amber-400 font-bold flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 shrink-0" />
                            <span>
                              {lang === 'ar' ? 'جزئي' : 'Partiel'} · {formatDZD(paidAmt, lang)}
                            </span>
                          </span>
                        )}
                        {status === 'unpaid' && (
                          <span className="text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1">
                            <X className="w-3.5 h-3.5 shrink-0" />
                            <span>
                              {t('unpaidShort')} · {formatDZD(0, lang)}
                            </span>
                          </span>
                        )}
                        {status === 'vacant' && <span className="text-slate-400">{t('empty')}</span>}

                        {status === 'partial' && (
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                            {lang === 'ar' ? 'الباقي' : 'Reste'} {formatDZD(Math.max(0, standardFee - paidAmt), lang)}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        <div className="bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
                <Droplet className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-slate-900 dark:text-white">{t('basementTitle')}</span>
                <p className="text-slate-500 dark:text-slate-400">{t('basementDesc')} {data.building.buildingNumber}</p>
              </div>
            </div>
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
              {t('activeSupply')}
            </span>
          </div>
        </div>
      </div>

      {/* Slide-Over Drawer for Selected Apartment */}
      <SlideOverDrawer
        open={Boolean(selectedApt)}
        onClose={() => setSelectedApt(null)}
        title={
          selectedApt && (
            <div className="flex items-center gap-2">
              <span>
                {selectedApt.number} — {selectedApt.floor === 0 ? t('rdcShort') : `${t('floor')} ${selectedApt.floor}`}
              </span>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {selectedApt.type} ({selectedApt.surfaceM2} m²)
              </span>
            </div>
          )
        }
        subtitle={`${t('feeFor')} ${isAnnual ? t('annual') : t('monthly')} : ${formatDZD(data.building.standardMonthlyFeeDZD, lang)} / ${isAnnual ? t('perYear') : t('perMonth')}`}
      >
        {selectedApt && (
          <>
            {!isEditingResident ? (
              <div className="space-y-3 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {t('residentInfoTitle')}
                  </span>
                  {canEditApt && (
                    <button onClick={() => setIsEditingResident(true)} className="text-xs text-emerald-600 font-semibold cursor-pointer hover:underline">
                      {t('edit')}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block">{t('owner')}</span>
                    <strong className="text-slate-900 dark:text-white text-sm">{selectedApt.resident.name}</strong>
                    {selectedApt.resident.birthDate && (
                      <span className="text-slate-500 block mt-0.5 font-mono text-[11px]">{selectedApt.resident.birthDate}</span>
                    )}
                  </div>
                  <div>
                    <span className="text-slate-400 block">{t('phone')}</span>
                    {selectedApt.resident.phone && selectedApt.resident.phone !== '-' ? (
                      <a href={`tel:${selectedApt.resident.phone}`} dir="ltr" className="text-emerald-600 font-medium hover:underline inline-flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5" />
                        {selectedApt.resident.phone}
                      </a>
                    ) : (
                      <span className="text-slate-400">{t('notProvided')}</span>
                    )}
                  </div>
                  <div>
                    <span className="text-slate-400 block">{t('aadlFolder')}</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200">
                      {selectedApt.resident.aadlFolderNumber || t('notProvided')}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">{t('occupancyStatus')}</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {selectedApt.occupancy === 'owner' ? t('owner') : selectedApt.occupancy === 'tenant' ? t('tenant') : t('vacant')}
                    </span>
                  </div>
                </div>

                {selectedApt.occupancy === 'tenant' && selectedApt.tenant && (
                  <div className="pt-2.5 border-t border-slate-200 dark:border-slate-700 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-sky-600 font-semibold block">{t('tenantOccupant')}</span>
                      <span className="font-medium text-slate-900 dark:text-white">{selectedApt.tenant.name}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">{t('tenantPhone')}</span>
                      <span className="font-mono text-slate-700 dark:text-slate-300" dir="ltr">
                        {selectedApt.tenant.phone}
                      </span>
                    </div>
                  </div>
                )}

                {(selectedApt.resident.emergencyContactName || selectedApt.resident.badgesCount !== undefined) && (
                  <div className="pt-2.5 border-t border-slate-200 dark:border-slate-700 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 block">{t('emergencyContact')}</span>
                      <span className="text-slate-800 dark:text-slate-200">
                        {selectedApt.resident.emergencyContactName
                          ? `${selectedApt.resident.emergencyContactName} (${selectedApt.resident.emergencyContactPhone || '-'})`
                          : t('notProvided')}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">{t('badgesKeys')}</span>
                      <span className="font-mono text-slate-800 dark:text-slate-200">
                        {selectedApt.resident.badgesCount ?? 2} {selectedApt.resident.keysNotes ? `· ${selectedApt.resident.keysNotes}` : ''}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handleSaveEdit} className="space-y-3 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">{t('editAptTitle')}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-600 dark:text-slate-300 mb-1">{t('ownerFullName')}</label>
                    <input type="text" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white" required />
                  </div>
                  <div>
                    <label className="block text-slate-600 dark:text-slate-300 mb-1">{t('birthDate')}</label>
                    <input type="text" value={editForm.birthDate} onChange={(e) => setEditForm({ ...editForm, birthDate: e.target.value })} className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono" />
                  </div>
                  <div>
                    <label className="block text-slate-600 dark:text-slate-300 mb-1">{t('phone')}</label>
                    <input type="text" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-slate-600 dark:text-slate-300 mb-1">{t('aadlFolder')}</label>
                    <input type="text" value={editForm.folder} onChange={(e) => setEditForm({ ...editForm, folder: e.target.value })} className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono" />
                  </div>
                  <div>
                    <label className="block text-slate-600 dark:text-slate-300 mb-1">{t('occupancyStatus')}</label>
                    <select value={editForm.occupancy} onChange={(e) => setEditForm({ ...editForm, occupancy: e.target.value as 'owner' | 'tenant' | 'vacant' })} className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                      <option value="owner">{t('owner')}</option>
                      <option value="tenant">{t('tenant')}</option>
                      <option value="vacant">{t('vacant')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-600 dark:text-slate-300 mb-1">{t('badgesCountLabel')}</label>
                    <input type="number" min={0} value={editForm.badgesCount} onChange={(e) => setEditForm({ ...editForm, badgesCount: Number(e.target.value) })} className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono" />
                  </div>

                  {editForm.occupancy === 'tenant' && (
                    <>
                      <div>
                        <label className="block text-sky-700 dark:text-sky-300 font-medium mb-1">{t('tenantNameLabel')}</label>
                        <input type="text" value={editForm.tenantName} onChange={(e) => setEditForm({ ...editForm, tenantName: e.target.value })} className="w-full px-2.5 py-1.5 rounded border border-sky-300 dark:border-sky-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white" />
                      </div>
                      <div>
                        <label className="block text-sky-700 dark:text-sky-300 font-medium mb-1">{t('tenantPhoneLabel')}</label>
                        <input type="text" value={editForm.tenantPhone} onChange={(e) => setEditForm({ ...editForm, tenantPhone: e.target.value })} className="w-full px-2.5 py-1.5 rounded border border-sky-300 dark:border-sky-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono" />
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-slate-600 dark:text-slate-300 mb-1">{t('emergencyNameLabel')}</label>
                    <input type="text" value={editForm.emergencyName} onChange={(e) => setEditForm({ ...editForm, emergencyName: e.target.value })} className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-slate-600 dark:text-slate-300 mb-1">{t('emergencyPhoneLabel')}</label>
                    <input type="text" value={editForm.emergencyPhone} onChange={(e) => setEditForm({ ...editForm, emergencyPhone: e.target.value })} className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-emerald-700 dark:text-emerald-300 font-semibold mb-1">
                      {lang === 'ar' ? 'الرمز السري للساكن (4 أرقام — للتصويت وحساب الشقة)' : 'Code PIN Résident (4 chiffres — Espace Mon Logement & Vote)'}
                    </label>
                    <input
                      type="text"
                      maxLength={4}
                      pattern="\d{4}"
                      value={editForm.residentPin}
                      onChange={(e) => setEditForm({ ...editForm, residentPin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                      className="w-full px-2.5 py-1.5 rounded border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono font-bold tracking-widest"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setIsEditingResident(false)} className="px-3 py-1.5 text-xs text-slate-600 cursor-pointer">{t('cancel')}</button>
                  <button type="submit" className="px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md cursor-pointer">{t('save')}</button>
                </div>
              </form>
            )}

            {canEditApt && (
              <div className="p-3.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-800/70 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-emerald-600" />
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block">
                      {lang === 'ar' ? 'رمز الدخول السري للساكن (PIN)' : 'Code PIN « Mon Logement & Vote »'}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {lang === 'ar' ? 'خاص بهذه الشقة فقط' : 'Personnel à cet appartement'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 font-mono font-black text-sm tracking-widest text-emerald-700 dark:text-emerald-300">
                    {getAptPin(selectedApt)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleSendPinWhatsApp(selectedApt)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold cursor-pointer"
                  >
                    <Share2 className="w-3 h-3" />
                    <span>WhatsApp</span>
                  </button>
                </div>
              </div>
            )}

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
              {(() => {
                const selectedPaidAmt = getAptPaidAmount(selectedApt.id);
                const selectedStatus = getApartmentStatus(selectedApt);
                const selectedRemaining = Math.max(0, standardFee - selectedPaidAmt);
                const lastPaymentForPeriod = aptPaymentsHistory.find((p) => p.month === selectedMonth);

                return (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {t('feeFor')} {formatMonthName(selectedMonth, lang)} :
                      </span>
                      {selectedStatus === 'paid' ? (
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                          {t('settled')} ({formatDZD(selectedPaidAmt, lang)})
                        </span>
                      ) : selectedStatus === 'partial' ? (
                        <span className="text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                          {lang === 'ar' ? 'دفع جزئي' : 'PARTIEL'} ({formatDZD(selectedPaidAmt, lang)} ·{' '}
                          {lang === 'ar' ? 'الباقي' : 'Reste'} : {formatDZD(selectedRemaining, lang)})
                        </span>
                      ) : selectedStatus === 'vacant' ? (
                        <span className="text-xs font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                          {t('vacant')}
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-800">
                          {t('pendingStatus')} ({formatDZD(standardFee, lang)})
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 pt-1">
                      {lastPaymentForPeriod && (
                        <button
                          onClick={() => onViewReceipt(lastPaymentForPeriod)}
                          className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 rounded-xl border border-emerald-200 dark:border-emerald-800 cursor-pointer"
                        >
                          <FileCheck className="w-4 h-4" />
                          <span>{t('viewReprintReceipt')}</span>
                        </button>
                      )}

                      {selectedStatus !== 'paid' && selectedStatus !== 'vacant' && canCollect && (
                        <button
                          onClick={() => {
                            const apt = selectedApt;
                            setSelectedApt(null);
                            onRecordPaymentForApt(apt);
                          }}
                          className={`w-full flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-semibold text-white rounded-xl shadow-xs cursor-pointer ${
                            selectedStatus === 'partial'
                              ? 'bg-amber-600 hover:bg-amber-700'
                              : 'bg-emerald-600 hover:bg-emerald-700'
                          }`}
                        >
                          <Plus className="w-4 h-4" />
                          <span>
                            {selectedStatus === 'partial'
                              ? `${lang === 'ar' ? 'تحصيل الباقي' : 'Encaisser le complément'} (${formatDZD(selectedRemaining, lang)})`
                              : `${t('collectCash')} (${formatDZD(standardFee, lang)})`}
                          </span>
                        </button>
                      )}

                      {canCollect && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <button
                            onClick={() => handleCopyReminder(selectedApt)}
                            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            <span>{t('copyWhatsappReminder')}</span>
                          </button>
                          {onOpenQuitus && (
                            <button
                              onClick={() => onOpenQuitus(selectedApt)}
                              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 rounded-xl border border-emerald-200 dark:border-emerald-800 cursor-pointer"
                            >
                              <Award className="w-3.5 h-3.5" />
                              <span>{lang === 'ar' ? 'شهادة براءة الذمة A4' : 'Quitus A4'}</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                {t('paymentHistory')} ({aptPaymentsHistory.length})
              </h4>
              {aptPaymentsHistory.length === 0 ? (
                <p className="text-xs text-slate-400 italic">{t('noPaymentsRecorded')}</p>
              ) : (
                <div className="space-y-1.5">
                  {aptPaymentsHistory.map((p) => (
                    <div key={p.id} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{formatMonthName(p.month, lang)}</span>
                        <span className="text-slate-400 font-mono ms-2">{p.receiptNumber}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{formatDZD(p.amountDZD, lang)}</span>
                        <button onClick={() => onViewReceipt(p)} className="text-[11px] text-slate-500 hover:text-emerald-600 underline cursor-pointer">
                          {t('receipt')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </SlideOverDrawer>
    </div>
  );
};
