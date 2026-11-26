import React, { useCallback, useEffect, useState } from 'react';
import {
  Settings,
  Building2,
  Users,
  Database,
  ShieldCheck,
  Check,
  Plus,
  Trash2,
  Download,
  Upload,
  RotateCcw,
  KeyRound,
  QrCode,
} from 'lucide-react';
import { AppData, BuildingInfo, BureauRole, ManagedUser } from '../../types';
import { HallQrPosterModal } from '../../components/HallQrPosterModal';
import { exportAppDataJSON } from '../../utils/storage';
import {
  changeBureauPassword,
  createUserRemote,
  deleteUserRemote,
  fetchUsersRemote,
} from '../../services/api';
import { useAppStore } from '../../stores/AppStore';
import { useI18n } from '../../i18n';
import { useToast } from '../../components/ui/ToastProvider';
import { useConfirm } from '../../components/ui/ConfirmDialog';

export const SettingsPage: React.FC = () => {
  const { lang, t } = useI18n();
  const toast = useToast();
  const { confirm } = useConfirm();
  const {
    data,
    buildings,
    activeBuildingId,
    refreshFromServer,
    switchBuilding,
    createNewBuilding,
    updateBuilding,
    resetFinancials,
    resetData,
    importData,
  } = useAppStore();

  const [subTab, setSubTab] = useState<'building' | 'rbac' | 'buildings' | 'backup'>('building');
  const [isHallQrOpen, setIsHallQrOpen] = useState(false);

  const [form, setForm] = useState<BuildingInfo>(() => ({
    ...data.building,
    quoteThresholdDZD: data.building.quoteThresholdDZD ?? 20000,
    reserveTargetDZD: data.building.reserveTargetDZD ?? 150000,
    committee: {
      president: data.building.committee?.president || data.building.syndicPresident,
      presidentPhone: data.building.committee?.presidentPhone || data.building.syndicPhone,
      treasurer: data.building.committee?.treasurer || '',
      treasurerPhone: data.building.committee?.treasurerPhone || '',
      technicalLead: data.building.committee?.technicalLead || '',
      technicalLeadPhone: data.building.committee?.technicalLeadPhone || '',
    },
  }));

  useEffect(() => {
    setForm({
      ...data.building,
      quoteThresholdDZD: data.building.quoteThresholdDZD ?? 20000,
      reserveTargetDZD: data.building.reserveTargetDZD ?? 150000,
      committee: {
        president: data.building.committee?.president || data.building.syndicPresident,
        presidentPhone: data.building.committee?.presidentPhone || data.building.syndicPhone,
        treasurer: data.building.committee?.treasurer || '',
        treasurerPhone: data.building.committee?.treasurerPhone || '',
        technicalLead: data.building.committee?.technicalLead || '',
        technicalLeadPhone: data.building.committee?.technicalLeadPhone || '',
      },
    });
  }, [data.building]);

  // Password update
  const [pwdForm, setPwdForm] = useState({ current: '', next: '' });

  // RBAC Users
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [newUser, setNewUser] = useState({
    username: '',
    fullName: '',
    role: 'treasurer' as BureauRole,
    password: '',
  });

  // Multi-Building Create Form
  const [newBldg, setNewBldg] = useState({
    residenceName: data.building.residenceName,
    ilot: data.building.ilot || 'Îlot 02',
    buildingNumber: 'Bâtiment E37',
    wilaya: data.building.wilaya,
    totalFloors: 9,
    apartmentsPerFloor: 4,
    standardFeeDZD: data.building.standardMonthlyFeeDZD || 12000,
  });

  const loadUsers = useCallback(async () => {
    const rows = await fetchUsersRemote();
    setUsers(rows);
  }, []);

  useEffect(() => {
    if (subTab === 'rbac') loadUsers();
  }, [subTab, loadUsers]);

  const handleSaveBuilding = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateBuilding({
      ...form,
      committee: {
        ...(form.committee || {
          president: form.syndicPresident,
          presidentPhone: form.syndicPhone,
          treasurer: '',
          technicalLead: '',
        }),
        president: form.syndicPresident,
        presidentPhone: form.syndicPhone,
      },
    });
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await changeBureauPassword(pwdForm.current, pwdForm.next);
    if (res.ok) {
      await refreshFromServer();
      toast.success(
        lang === 'ar' ? 'تم تحديث كلمة المرور بنجاح' : 'Mot de passe mis à jour avec succès'
      );
      setPwdForm({ current: '', next: '' });
    } else {
      toast.error(res.error || 'Erreur');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await createUserRemote(activeBuildingId, newUser);
    if (res.ok) {
      toast.success(
        lang === 'ar' ? `تم إنشاء حساب ${newUser.username}` : `Compte ${newUser.username} créé`
      );
      setNewUser({ username: '', fullName: '', role: 'treasurer', password: '' });
      loadUsers();
    } else {
      toast.error(res.error || 'Erreur');
    }
  };

  const handleDeleteUser = async (u: ManagedUser) => {
    const ok = await confirm({
      title: lang === 'ar' ? 'حذف حساب عضو' : 'Supprimer ce compte ?',
      message:
        lang === 'ar'
          ? `هل تريد حذف المستخدم ${u.username} (${u.fullName})؟`
          : `Supprimer l'accès Bureau de ${u.fullName} (${u.username}) ?`,
      confirmLabel: lang === 'ar' ? 'حذف' : 'Supprimer',
      cancelLabel: t('cancel'),
      danger: true,
    });
    if (!ok) return;
    const res = await deleteUserRemote(activeBuildingId, u.id);
    if (res.ok) {
      toast.info(lang === 'ar' ? 'تم حذف الحساب' : 'Compte supprimé');
      loadUsers();
    } else {
      toast.error(res.error || 'Erreur');
    }
  };

  const handleCreateBuilding = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await createNewBuilding({
      residenceName: newBldg.residenceName.trim(),
      ilot: newBldg.ilot.trim(),
      buildingNumber: newBldg.buildingNumber.trim(),
      wilaya: newBldg.wilaya.trim(),
      totalFloors: Number(newBldg.totalFloors) || 9,
      apartmentsPerFloor: Number(newBldg.apartmentsPerFloor) || 4,
      standardFeeDZD: Number(newBldg.standardFeeDZD) || 12000,
    });
    if (ok) {
      setNewBldg((prev) => ({ ...prev, buildingNumber: '' }));
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const parsed = JSON.parse(String(evt.target?.result || '')) as AppData;
        if (parsed && parsed.building && Array.isArray(parsed.apartments)) {
          await importData(parsed);
        } else {
          toast.error(
            lang === 'ar'
              ? 'ملف JSON غير صالح.'
              : 'Fichier JSON invalide : structure non reconnue.'
          );
        }
      } catch {
        toast.error(
          lang === 'ar' ? 'خطأ في قراءة ملف JSON.' : 'Erreur lors de la lecture du fichier JSON.'
        );
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleReset = async () => {
    const ok = await confirm({
      title: lang === 'ar' ? 'إعادة ضبط البيانات' : 'Réinitialiser la base ?',
      message: t('confirmResetText'),
      confirmLabel: t('yesReset'),
      cancelLabel: t('no'),
      danger: true,
    });
    if (ok) {
      await resetData();
    }
  };

  const handleResetFinancials = async () => {
    const ok = await confirm({
      title: lang === 'ar' ? 'تصفير المداخيل والمصاريف والتمارين' : 'Remise à zéro comptable (0 DZD) ?',
      message:
        lang === 'ar'
          ? `سيتم مسح جميع الإيصالات والمداخيل والمصاريف وتصفير الميزانية إلى 0 دج، مع الاحتفاظ بكل السكان (${data.apartments.length} شقة)، الإعلانات والإعدادات.`
          : `Toutes les cotisations, recettes, dépenses et prévisions budgétaires de ce bâtiment seront remises à 0 DZD. Les ${data.apartments.length} résidents, avis et paramètres du bâtiment restent intactes.`,
      confirmLabel: lang === 'ar' ? 'تصفير إلى 0 دج' : 'Remettre à 0 DZD',
      cancelLabel: t('cancel'),
      danger: true,
    });
    if (ok) {
      await resetFinancials();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                {t('settingsTitle')}
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {data.building.buildingNumber} — {data.building.residenceName}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsHallQrOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800 cursor-pointer"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? 'طباعة ملصق QR للبهو' : 'Affiche QR Hall A4'}</span>
            </button>

            <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-xs">
            {[
              { id: 'building' as const, icon: <Building2 className="w-3.5 h-3.5" />, label: lang === 'ar' ? 'العمارة واللجنة' : 'Bâtiment & Comité' },
              { id: 'rbac' as const, icon: <Users className="w-3.5 h-3.5" />, label: lang === 'ar' ? 'الحسابات والصلاحيات' : 'Comptes & Rôles RBAC' },
              { id: 'buildings' as const, icon: <Building2 className="w-3.5 h-3.5" />, label: lang === 'ar' ? 'تعدد العمارات' : `Multi-Bâtiments (${buildings.length})` },
              { id: 'backup' as const, icon: <Database className="w-3.5 h-3.5" />, label: lang === 'ar' ? 'النسخ الاحتياطي' : 'Sauvegardes JSON' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSubTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer ${
                  subTab === tab.id
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
            </div>
          </div>
        </div>
      </div>

      {/* TAB 1: Building & Committee */}
      {subTab === 'building' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form
            onSubmit={handleSaveBuilding}
            className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4 text-xs"
          >
            <h3 className="text-sm font-bold text-slate-900 dark:text-white pb-3 border-b border-slate-100 dark:border-slate-800">
              {t('buildingIdentitySection')}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">
                  {lang === 'ar' ? 'اسم الإقامة / الحي' : 'Nom de la Cité'}
                </label>
                <input
                  type="text"
                  required
                  value={form.residenceName}
                  onChange={(e) => setForm({ ...form, residenceName: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">
                  {lang === 'ar' ? 'رقم العمارة' : 'Numéro du Bâtiment / Bloc'}
                </label>
                <input
                  type="text"
                  required
                  value={form.buildingNumber}
                  onChange={(e) => setForm({ ...form, buildingNumber: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">
                  {lang === 'ar' ? 'الجزيرة والولاية' : 'Îlot & Wilaya'}
                </label>
                <input
                  type="text"
                  value={form.wilaya}
                  onChange={(e) => setForm({ ...form, wilaya: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">
                  {lang === 'ar' ? 'وكالة التسيير GEST-IMMO' : 'Direction Déléguée GEST-IMMO'}
                </label>
                <input
                  type="text"
                  value={form.gestImmoAgency}
                  onChange={(e) => setForm({ ...form, gestImmoAgency: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">
                  {lang === 'ar' ? 'الدورية' : 'Périodicité'}
                </label>
                <select
                  value={form.feeFrequency || 'annuel'}
                  onChange={(e) => setForm({ ...form, feeFrequency: e.target.value as 'annuel' | 'mensuel' })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="annuel">{lang === 'ar' ? 'سنوية' : 'Annuelle'}</option>
                  <option value="mensuel">{lang === 'ar' ? 'شهرية' : 'Mensuelle'}</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">
                  {lang === 'ar' ? 'مبلغ الاشتراك (دج)' : 'Cotisation (DZD)'}
                </label>
                <input
                  type="number"
                  required
                  value={form.standardMonthlyFeeDZD}
                  onChange={(e) => setForm({ ...form, standardMonthlyFeeDZD: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold"
                />
              </div>
              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">
                  {lang === 'ar' ? 'كود الباب الرئيسي' : 'Digicode Hall'}
                </label>
                <input
                  type="text"
                  value={form.doorCode}
                  onChange={(e) => setForm({ ...form, doorCode: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">
                  {lang === 'ar' ? 'عدد الطوابق' : 'Étages'}
                </label>
                <input
                  type="number"
                  value={form.totalFloors}
                  onChange={(e) => setForm({ ...form, totalFloors: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">
                  {lang === 'ar' ? 'رئيس مكتب السانديك' : 'Président du Bureau Syndic'}
                </label>
                <input
                  type="text"
                  value={form.syndicPresident}
                  onChange={(e) => setForm({ ...form, syndicPresident: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">
                  {lang === 'ar' ? 'هاتف السانديك' : 'Téléphone Syndic'}
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={form.syndicPhone}
                  onChange={(e) => setForm({ ...form, syndicPhone: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">
                  {lang === 'ar' ? 'أمين المال' : 'Trésorier'}
                </label>
                <input
                  type="text"
                  value={form.committee?.treasurer || ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      committee: { ...(form.committee!), treasurer: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">
                  {lang === 'ar' ? 'المسؤول التقني' : 'Responsable Technique'}
                </label>
                <input
                  type="text"
                  value={form.committee?.technicalLead || ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      committee: { ...(form.committee!), technicalLead: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">
                  {lang === 'ar' ? 'عتبة مقارنة عرضي الأسعار (دج)' : 'Seuil 2 Devis Comparatifs (DZD)'}
                </label>
                <input
                  type="number"
                  value={form.quoteThresholdDZD ?? 20000}
                  onChange={(e) => setForm({ ...form, quoteThresholdDZD: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">
                  {lang === 'ar' ? 'هدف صندوق الاحتياط (دج)' : 'Objectif Fonds de Réserve (DZD)'}
                </label>
                <input
                  type="number"
                  value={form.reserveTargetDZD ?? 150000}
                  onChange={(e) => setForm({ ...form, reserveTargetDZD: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="submit"
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer shadow-xs"
              >
                <Check className="w-4 h-4" />
                <span>{t('save')}</span>
              </button>
            </div>
          </form>

          {/* Own Password Card */}
          <form
            onSubmit={handleChangePassword}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4 text-xs h-fit"
          >
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <KeyRound className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {lang === 'ar' ? 'أمان كلمة المرور' : 'Sécurité & Mot de passe'}
              </h3>
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">
                {lang === 'ar' ? 'كلمة المرور الحالية' : 'Mot de passe actuel'}
              </label>
              <input
                type="password"
                required
                value={pwdForm.current}
                onChange={(e) => setPwdForm({ ...pwdForm, current: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-slate-600 dark:text-slate-300 font-semibold mb-1">
                {lang === 'ar' ? 'كلمة المرور الجديدة (6 أحرف على الأقل)' : 'Nouveau mot de passe (min 6 car.)'}
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={pwdForm.next}
                onChange={(e) => setPwdForm({ ...pwdForm, next: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 text-white font-semibold cursor-pointer"
            >
              {t('changePasswordBtn')}
            </button>
          </form>
        </div>
      )}

      {/* TAB 2: RBAC Users */}
      {subTab === 'rbac' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white pb-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>{lang === 'ar' ? 'أعضاء المكتب المسجلون' : 'Comptes du Bureau Syndic (RBAC)'}</span>
            </h3>

            <div className="space-y-2.5">
              {users.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/70 text-xs"
                >
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white">{u.fullName}</div>
                    <div className="text-slate-500 font-mono mt-0.5">
                      @{u.username} ·{' '}
                      <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold">
                        {u.role}
                      </span>
                    </div>
                  </div>

                  {u.username !== 'president' && (
                    <button
                      onClick={() => handleDeleteUser(u)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <form
            onSubmit={handleCreateUser}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-3.5 text-xs h-fit"
          >
            <h3 className="text-sm font-bold text-slate-900 dark:text-white pb-2 border-b border-slate-100 dark:border-slate-800">
              {lang === 'ar' ? 'إضافة عضو مكتب جديد' : 'Nouveau compte Bureau'}
            </h3>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {lang === 'ar' ? 'اسم المستخدم' : "Identifiant (username)"}
              </label>
              <input
                type="text"
                required
                dir="ltr"
                value={newUser.username}
                onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                placeholder="ex: adj_technique"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {lang === 'ar' ? 'الاسم الكامل' : 'Nom complet'}
              </label>
              <input
                type="text"
                required
                value={newUser.fullName}
                onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {lang === 'ar' ? 'الصلاحية (الدور)' : 'Rôle RBAC'}
              </label>
              <select
                value={newUser.role}
                onChange={(e) => setNewUser({ ...newUser, role: e.target.value as BureauRole })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value="treasurer">{t('roleTreasurer')}</option>
                <option value="technical">{t('roleTechnical')}</option>
                <option value="president">{t('rolePresident')}</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {lang === 'ar' ? 'كلمة المرور' : 'Mot de passe (min 6 car.)'}
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{lang === 'ar' ? 'إنشاء الحساب' : 'Créer le compte'}</span>
            </button>
          </form>
        </div>
      )}

      {/* TAB 3: Multi-Building */}
      {subTab === 'buildings' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white pb-3 border-b border-slate-100 dark:border-slate-800">
              {lang === 'ar' ? 'العمارات المسيرة في المنصة' : 'Cages & Bâtiments configurés'}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {buildings.map((b) => {
                const isActive = b.id === activeBuildingId;
                return (
                  <div
                    key={b.id}
                    className={`p-4 rounded-xl border flex flex-col justify-between gap-3 text-xs ${
                      isActive
                        ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700'
                        : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-sm text-slate-900 dark:text-white">
                          {b.buildingNumber}
                        </span>
                        {isActive && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                            {lang === 'ar' ? 'نشط' : 'Actif'}
                          </span>
                        )}
                      </div>
                      <div className="text-slate-600 dark:text-slate-300 mt-1">{b.residenceName}</div>
                      <div className="text-slate-400 mt-0.5">
                        {b.ilot} · {b.wilaya}
                      </div>
                    </div>

                    {!isActive && (
                      <button
                        onClick={() => switchBuilding(b.id)}
                        className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:border-emerald-500 font-semibold text-slate-800 dark:text-white cursor-pointer"
                      >
                        {lang === 'ar' ? 'التبديل لهذه العمارة' : 'Basculer sur ce bâtiment'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <form
            onSubmit={handleCreateBuilding}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-3 text-xs h-fit"
          >
            <h3 className="text-sm font-bold text-slate-900 dark:text-white pb-2 border-b border-slate-100 dark:border-slate-800">
              {lang === 'ar' ? 'إضافة عمارة جديدة' : 'Ajouter un bâtiment AADL'}
            </h3>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {lang === 'ar' ? 'اسم العمارة / البلوك' : 'Numéro de bâtiment'}
              </label>
              <input
                type="text"
                required
                value={newBldg.buildingNumber}
                onChange={(e) => setNewBldg({ ...newBldg, buildingNumber: e.target.value })}
                placeholder="ex: Bâtiment E37"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {lang === 'ar' ? 'الحي / الإقامة' : 'Cité / Résidence'}
              </label>
              <input
                type="text"
                required
                value={newBldg.residenceName}
                onChange={(e) => setNewBldg({ ...newBldg, residenceName: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {lang === 'ar' ? 'الجزيرة' : 'Îlot'}
                </label>
                <input
                  type="text"
                  value={newBldg.ilot}
                  onChange={(e) => setNewBldg({ ...newBldg, ilot: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {lang === 'ar' ? 'الولاية' : 'Wilaya'}
                </label>
                <input
                  type="text"
                  value={newBldg.wilaya}
                  onChange={(e) => setNewBldg({ ...newBldg, wilaya: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {lang === 'ar' ? 'الطوابق' : 'Étages'}
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={newBldg.totalFloors}
                  onChange={(e) => setNewBldg({ ...newBldg, totalFloors: Number(e.target.value) })}
                  className="w-full px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {lang === 'ar' ? 'شقة/طابق' : 'Apts/Étage'}
                </label>
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={newBldg.apartmentsPerFloor}
                  onChange={(e) => setNewBldg({ ...newBldg, apartmentsPerFloor: Number(e.target.value) })}
                  className="w-full px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {lang === 'ar' ? 'الاشتراك' : 'Cotisation'}
                </label>
                <input
                  type="number"
                  min={500}
                  value={newBldg.standardFeeDZD}
                  onChange={(e) => setNewBldg({ ...newBldg, standardFeeDZD: Number(e.target.value) })}
                  className="w-full px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{lang === 'ar' ? 'إنشاء العمارة' : 'Créer le bâtiment'}</span>
            </button>
          </form>
        </div>
      )}

      {/* TAB 4: Backups & Reset */}
      {subTab === 'backup' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-5 text-xs">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white pb-3 border-b border-slate-100 dark:border-slate-800">
            {t('backupSectionTitle')}
          </h3>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => exportAppDataJSON(data)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer shadow-xs"
            >
              <Download className="w-4 h-4" />
              <span>{t('exportJsonBtn')}</span>
            </button>

            <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 font-semibold border border-slate-200 dark:border-slate-700 cursor-pointer">
              <Upload className="w-4 h-4" />
              <span>{t('restoreJsonBtn')}</span>
              <input type="file" accept=".json" onChange={handleImportFile} className="hidden" />
            </label>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleResetFinancials}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 border border-amber-200 dark:border-amber-900/50 font-semibold cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>
                {lang === 'ar'
                  ? 'تصفير المداخيل، المصاريف والتمارين (0 دج)'
                  : 'Remettre recettes, dépenses & exercices à 0 DZD'}
              </span>
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-rose-600 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 border border-rose-200 dark:border-rose-900/50 font-semibold cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{t('resetDefaultBtn')}</span>
            </button>
          </div>
        </div>
      )}
      {isHallQrOpen && (
        <HallQrPosterModal building={data.building} onClose={() => setIsHallQrOpen(false)} />
      )}
    </div>
  );
};
