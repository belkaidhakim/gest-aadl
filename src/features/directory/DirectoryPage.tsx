import React, { useState } from 'react';
import {
  Phone,
  ShieldAlert,
  Plus,
  Wrench,
  Building2,
  MapPin,
  Copy,
  Clock,
  Check,
  X,
  Droplet,
  Layers,
  Zap,
} from 'lucide-react';
import { Vendor } from '../../types';
import { useI18n } from '../../i18n';
import { useAppStore } from '../../stores/AppStore';
import { canManageGovernance } from '../../utils/permissions';
import { useToast } from '../../components/ui/ToastProvider';

export const DirectoryPage: React.FC = () => {
  const { lang, t } = useI18n();
  const { data, role, addVendor } = useAppStore();
  const toast = useToast();
  const canManage = canManageGovernance(role);

  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [newVendor, setNewVendor] = useState({
    name: '',
    specialty: 'Plomberie & Bâche à Eau',
    phone: '',
    secondaryPhone: '',
    address: '',
    is24hEmergency: false,
    notes: '',
  });

  const handleCopyPhone = (vendorId: string, phone: string) => {
    navigator.clipboard.writeText(phone);
    setCopiedId(vendorId);
    toast.success(lang === 'ar' ? `تم نسخ الرقم ${phone}` : `Numéro copié : ${phone}`);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVendor.name.trim() || !newVendor.phone.trim()) return;

    await addVendor({
      id: `ven-${Date.now()}`,
      name: newVendor.name.trim(),
      specialty: newVendor.specialty,
      phone: newVendor.phone.trim(),
      secondaryPhone: newVendor.secondaryPhone.trim() || undefined,
      address: newVendor.address.trim() || undefined,
      is24hEmergency: newVendor.is24hEmergency,
      notes: newVendor.notes.trim() || undefined,
    });
    setIsNewModalOpen(false);
    setNewVendor({
      name: '',
      specialty: 'Plomberie & Bâche à Eau',
      phone: '',
      secondaryPhone: '',
      address: '',
      is24hEmergency: false,
      notes: '',
    });
  };

  const getVendorIcon = (specialty: string) => {
    const low = specialty.toLowerCase();
    if (low.includes('ascenseur')) return <Layers className="w-5 h-5 text-amber-500" />;
    if (low.includes('plomb') || low.includes('eau')) return <Droplet className="w-5 h-5 text-sky-500" />;
    if (low.includes('élec') || low.includes('elec')) return <Zap className="w-5 h-5 text-yellow-500" />;
    if (low.includes('gest') || low.includes('agence')) return <Building2 className="w-5 h-5 text-emerald-600" />;
    return <Wrench className="w-5 h-5 text-slate-500" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Phone className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                {t('directoryTitle')}
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {t('directorySubtitle')}
            </p>
          </div>

          {canManage && (
            <button
              onClick={() => setIsNewModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{t('addVendorBtn')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Emergency Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-rose-800 dark:text-rose-300 block">
              {t('civilProtection')}
            </span>
            <span className="text-2xl font-black font-mono text-rose-700 dark:text-rose-200" dir="ltr">
              14 / 1021
            </span>
            <p className="text-[10px] text-rose-600 dark:text-rose-400 mt-0.5">{t('rescueFire')}</p>
          </div>
          <a href="tel:14" className="p-2.5 rounded-full bg-rose-600 text-white hover:bg-rose-700 shadow-xs">
            <Phone className="w-4 h-4" />
          </a>
        </div>

        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 block">
              {t('sonelgazEmergency')}
            </span>
            <span className="text-2xl font-black font-mono text-amber-700 dark:text-amber-200" dir="ltr">
              3303
            </span>
            <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">{t('elecGas')}</p>
          </div>
          <a href="tel:3303" className="p-2.5 rounded-full bg-amber-600 text-white hover:bg-amber-700 shadow-xs">
            <Phone className="w-4 h-4" />
          </a>
        </div>

        <div className="bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-900/60 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-sky-800 dark:text-sky-300 block">
              {t('policeSecurity')}
            </span>
            <span className="text-2xl font-black font-mono text-sky-700 dark:text-sky-200" dir="ltr">
              17 / 1548
            </span>
            <p className="text-[10px] text-sky-600 dark:text-sky-400 mt-0.5">{t('safetyOrder')}</p>
          </div>
          <a href="tel:17" className="p-2.5 rounded-full bg-sky-600 text-white hover:bg-sky-700 shadow-xs">
            <Phone className="w-4 h-4" />
          </a>
        </div>

        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-2xl p-4 flex items-center justify-between">
          <div className="min-w-0">
            <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 block">
              {t('gestImmoAgencyCard')}
            </span>
            <span className="text-base font-bold font-mono text-emerald-700 dark:text-emerald-200 block truncate" dir="ltr">
              {data.building.syndicPhone}
            </span>
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5 truncate">
              {data.building.buildingNumber} · {data.building.syndicPresident}
            </p>
          </div>
          <a
            href={`tel:${data.building.syndicPhone}`}
            className="p-2.5 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs shrink-0"
          >
            <Phone className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* Vendors Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.vendors.map((v: Vendor) => (
          <div
            key={v.id}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between gap-4 hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                    {getVendorIcon(v.specialty)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">{v.name}</h3>
                    <span className="text-xs text-slate-500 dark:text-slate-400 block truncate">{v.specialty}</span>
                  </div>
                </div>
                {v.is24hEmergency && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50 shrink-0">
                    <ShieldAlert className="w-3 h-3" />
                    24h/7j
                  </span>
                )}
              </div>

              {v.address && (
                <div className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{v.address}</span>
                </div>
              )}

              {v.notes && (
                <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2.5">
                  {v.notes}
                </p>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <a
                  href={`tel:${v.phone}`}
                  dir="ltr"
                  className="text-sm font-bold font-mono text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1.5"
                >
                  <Phone className="w-3.5 h-3.5" />
                  {v.phone}
                </a>
                <button
                  onClick={() => handleCopyPhone(v.id, v.phone)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer"
                  title={lang === 'ar' ? 'نسخ الرقم' : 'Copier le numéro'}
                >
                  {copiedId === v.id ? (
                    <Check className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>

              {v.secondaryPhone && (
                <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                  <span dir="ltr" className="font-mono flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {v.secondaryPhone}
                  </span>
                  <button
                    onClick={() => handleCopyPhone(`${v.id}-sec`, v.secondaryPhone!)}
                    className="text-[11px] text-slate-400 hover:text-emerald-600 cursor-pointer"
                  >
                    {lang === 'ar' ? 'نسخ' : 'Copier'}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add Vendor Modal */}
      {isNewModalOpen && canManage && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 no-print">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {t('addVendorBtn')}
              </h3>
              <button onClick={() => setIsNewModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  {lang === 'ar' ? 'اسم الشركة أو الحرفي' : "Nom de l'entreprise ou artisan"}
                </label>
                <input
                  type="text"
                  required
                  value={newVendor.name}
                  onChange={(e) => setNewVendor({ ...newVendor, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  {lang === 'ar' ? 'التخصص' : 'Spécialité'}
                </label>
                <select
                  value={newVendor.specialty}
                  onChange={(e) => setNewVendor({ ...newVendor, specialty: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="Ascenseurs & Maintenance">Ascenseurs & Maintenance</option>
                  <option value="Plomberie & Bâche à Eau">Plomberie & Bâche à Eau</option>
                  <option value="Électricité Générale & Interphone">Électricité Générale & Interphone</option>
                  <option value="Nettoyage & Hygiène">Nettoyage & Hygiène</option>
                  <option value="Serrurerie & Portes">Serrurerie & Portes</option>
                  <option value="Sécurité & Incendie">Sécurité & Incendie</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    {lang === 'ar' ? 'رقم الهاتف الرئيسي' : 'Téléphone principal'}
                  </label>
                  <input
                    type="text"
                    required
                    dir="ltr"
                    value={newVendor.phone}
                    onChange={(e) => setNewVendor({ ...newVendor, phone: e.target.value })}
                    placeholder="0550 00 00 00"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    {lang === 'ar' ? 'هاتف ثانوي' : 'Tél. secondaire'}
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={newVendor.secondaryPhone}
                    onChange={(e) => setNewVendor({ ...newVendor, secondaryPhone: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  {lang === 'ar' ? 'العنوان أو المنطقة' : 'Adresse / Quartier'}
                </label>
                <input
                  type="text"
                  value={newVendor.address}
                  onChange={(e) => setNewVendor({ ...newVendor, address: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  {lang === 'ar' ? 'ملاحظات (أوقات العمل، رقم العقد...)' : 'Notes (contrat, horaires...)'}
                </label>
                <textarea
                  rows={2}
                  value={newVendor.notes}
                  onChange={(e) => setNewVendor({ ...newVendor, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={newVendor.is24hEmergency}
                  onChange={(e) => setNewVendor({ ...newVendor, is24hEmergency: e.target.checked })}
                  className="rounded border-slate-300 text-emerald-600"
                />
                <span>{lang === 'ar' ? 'متاح لطوارئ 24/7' : 'Disponible urgences 24h/24 et 7j/7'}</span>
              </label>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button type="button" onClick={() => setIsNewModalOpen(false)} className="px-4 py-2 text-slate-500 cursor-pointer">
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer"
                >
                  {t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
