import React, { useMemo, useState } from 'react';
import {
  Phone,
  ShieldAlert,
  Wrench,
  Building2,
  MapPin,
  Copy,
  Clock,
  Check,
  Droplet,
  Layers,
  Zap,
  Search,
  Siren,
  Users,
} from 'lucide-react';
import { Vendor } from '../../types';
import { useI18n } from '../../i18n';
import { useAppStore } from '../../stores/AppStore';
import { useToast } from '../../components/ui/ToastProvider';
import { EmptyState } from '../../components/ui/EmptyState';

export const ResidentEmergenciesPage: React.FC = () => {
  const { lang, t } = useI18n();
  const { data } = useAppStore();
  const toast = useToast();

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<'all' | '24h' | 'ascenseur' | 'plomberie' | 'electricite'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const handleCopy = (key: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedKey(key);
    toast.success(lang === 'ar' ? `تم نسخ الرقم ${value}` : `Numéro copié : ${value}`);
    setTimeout(() => setCopiedKey(null), 2200);
  };

  const getVendorIcon = (specialty: string) => {
    const low = specialty.toLowerCase();
    if (low.includes('ascenseur')) return <Layers className="w-5 h-5 text-amber-500" />;
    if (low.includes('plomb') || low.includes('eau')) return <Droplet className="w-5 h-5 text-sky-500" />;
    if (low.includes('élec') || low.includes('elec')) return <Zap className="w-5 h-5 text-yellow-500" />;
    if (low.includes('gest') || low.includes('agence')) return <Building2 className="w-5 h-5 text-emerald-600" />;
    return <Wrench className="w-5 h-5 text-slate-500" />;
  };

  const filteredVendors = useMemo(() => {
    return data.vendors.filter((v: Vendor) => {
      const spec = v.specialty.toLowerCase();
      if (filterMode === '24h' && !v.is24hEmergency) return false;
      if (filterMode === 'ascenseur' && !spec.includes('ascenseur')) return false;
      if (filterMode === 'plomberie' && !spec.includes('plomb') && !spec.includes('eau')) return false;
      if (filterMode === 'electricite' && !spec.includes('élec') && !spec.includes('elec')) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const hay = `${v.name} ${v.specialty} ${v.address || ''} ${v.notes || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [data.vendors, filterMode, searchQuery]);

  const emergencyServices = [
    {
      id: 'civil',
      label: t('civilProtection'),
      sub: t('rescueFire'),
      display: '14 / 1021',
      tel: '14',
      cardCls: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60',
      labelCls: 'text-rose-800 dark:text-rose-300',
      numCls: 'text-rose-700 dark:text-rose-200',
      subCls: 'text-rose-600 dark:text-rose-400',
      btnCls: 'bg-rose-600 hover:bg-rose-700 text-white',
    },
    {
      id: 'sonelgaz',
      label: t('sonelgazEmergency'),
      sub: t('elecGas'),
      display: '3303',
      tel: '3303',
      cardCls: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60',
      labelCls: 'text-amber-800 dark:text-amber-300',
      numCls: 'text-amber-700 dark:text-amber-200',
      subCls: 'text-amber-600 dark:text-amber-400',
      btnCls: 'bg-amber-600 hover:bg-amber-700 text-white',
    },
    {
      id: 'police',
      label: t('policeSecurity'),
      sub: t('safetyOrder'),
      display: '17 / 1548',
      tel: '17',
      cardCls: 'bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-900/60',
      labelCls: 'text-sky-800 dark:text-sky-300',
      numCls: 'text-sky-700 dark:text-sky-200',
      subCls: 'text-sky-600 dark:text-sky-400',
      btnCls: 'bg-sky-600 hover:bg-sky-700 text-white',
    },
    {
      id: 'seaal',
      label: lang === 'ar' ? 'المياه والتطهير (SEAAL)' : 'Eau & Assainissement (SEAAL)',
      sub: lang === 'ar' ? 'تسربات المياه والصرف' : 'Fuites réseau & coupures',
      display: '1594',
      tel: '1594',
      cardCls: 'bg-cyan-50 dark:bg-cyan-950/40 border-cyan-200 dark:border-cyan-900/60',
      labelCls: 'text-cyan-800 dark:text-cyan-300',
      numCls: 'text-cyan-700 dark:text-cyan-200',
      subCls: 'text-cyan-600 dark:text-cyan-400',
      btnCls: 'bg-cyan-600 hover:bg-cyan-700 text-white',
    },
  ];

  const safetyReflexes = [
    {
      icon: <Layers className="w-5 h-5 text-amber-500" />,
      title: lang === 'ar' ? 'توقف المصعد وبداخله أشخاص' : 'Ascenseur bloqué avec passager',
      desc:
        lang === 'ar'
          ? 'حافظ على الهدوء، لا تحاول فتح الباب بالقوة. اضغط على جرس التنبيه واتصل بمصلحة المصاعد 24/7 وبمكتب السانديك.'
          : "Gardez votre calme et ne forcez jamais les portes. Appuyez sur l'alarme et appelez le mainteneur 24h/7j + le Syndic.",
    },
    {
      icon: <Droplet className="w-5 h-5 text-sky-500" />,
      title: lang === 'ar' ? 'تسرب مائي أو انقطاع التزويد' : "Fuite importante ou panne d'eau",
      desc:
        lang === 'ar'
          ? 'أغلق صمام الشقة أولاً. إذا كان العطل في العمود المشترك أو الخزان، أعلم السانديك أو السباك المعتمد.'
          : 'Fermez votre vanne palière. Pour une fuite en colonne montante ou bâche à eau, contactez le Syndic et le plombier.',
    },
    {
      icon: <Zap className="w-5 h-5 text-rose-500" />,
      title: lang === 'ar' ? 'رائحة غاز أو شرار كهربائي' : 'Odeur de gaz ou incident électrique',
      desc:
        lang === 'ar'
          ? 'افتح النوافذ، لا تلمس المفاتيح الكهربائية، أغلق صمام الغاز واتصل فوراً بالرقم 3303 والحماية المدنية 14.'
          : 'Aérez immédiatement sans actionner d’interrupteur, fermez le robinet de gaz et appelez Sonelgaz (3303) / Pompiers (14).',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
        <div className="flex items-center gap-2">
          <Siren className="w-5 h-5 text-rose-600 dark:text-rose-400" />
          <h1 className="text-lg font-extrabold text-slate-900 dark:text-white">
            {lang === 'ar' ? 'أرقام الطوارئ 24/7 والمقاولون المعتمدون' : 'Urgences 24/7 & Contacts Utiles'}
          </h1>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          {lang === 'ar'
            ? 'اتصال مباشر بضغطة زر بمصالح الإنقاذ، مكتب السانديك والتقنيين المكلفين بصيانة العمارة.'
            : 'Appelez directement en un clic les secours nationaux, le Bureau Syndic et les prestataires agréés de votre cage.'}
        </p>
      </div>

      {/* National Vital Emergencies */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {emergencyServices.map((srv) => (
          <div
            key={srv.id}
            className={`border rounded-2xl p-4 flex flex-col justify-between gap-3 ${srv.cardCls}`}
          >
            <div>
              <span className={`text-[11px] font-bold block ${srv.labelCls}`}>{srv.label}</span>
              <span className={`text-2xl font-black font-mono block mt-1 ${srv.numCls}`} dir="ltr">
                {srv.display}
              </span>
              <p className={`text-[11px] mt-0.5 ${srv.subCls}`}>{srv.sub}</p>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={`tel:${srv.tel}`}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold shadow-xs ${srv.btnCls}`}
              >
                <Phone className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'اتصال' : 'Appeler'}</span>
              </a>
              <button
                type="button"
                onClick={() => handleCopy(srv.id, srv.tel)}
                className="p-2 rounded-xl bg-white/80 dark:bg-slate-900/70 text-slate-700 dark:text-slate-200 hover:bg-white cursor-pointer"
                title={lang === 'ar' ? 'نسخ' : 'Copier'}
              >
                {copiedKey === srv.id ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Syndic Bureau & Building Governance Card (Public Resident Contacts Only) */}
      <div className="bg-white dark:bg-slate-900 border border-emerald-200/80 dark:border-emerald-900/50 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              {t('gestImmoAgencyCard')} — {data.building.buildingNumber}
            </h2>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {data.building.gestImmoAgency} · {data.building.ilot} · {data.building.wilaya}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          {/* Président */}
          <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/50 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-300 block">
                {lang === 'ar' ? 'رئيس مكتب السانديك' : 'Président du Syndic'}
              </span>
              <span className="font-bold text-sm text-slate-900 dark:text-white block truncate mt-0.5">
                {data.building.syndicPresident}
              </span>
              <span dir="ltr" className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                {data.building.syndicPhone}
              </span>
            </div>
            <div className="flex flex-col gap-1.5 shrink-0">
              <a
                href={`tel:${data.building.syndicPhone}`}
                className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                title={lang === 'ar' ? 'اتصال' : 'Appeler'}
              >
                <Phone className="w-4 h-4" />
              </a>
              <button
                type="button"
                onClick={() => handleCopy('syndic', data.building.syndicPhone)}
                className="p-2 rounded-xl bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer"
                title={lang === 'ar' ? 'نسخ' : 'Copier'}
              >
                {copiedKey === 'syndic' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Trésorier */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">
                {lang === 'ar' ? 'أمين المال' : 'Trésorier'}
              </span>
              <span className="font-bold text-sm text-slate-900 dark:text-white block truncate mt-0.5">
                {data.building.committee?.treasurer || (lang === 'ar' ? 'لجنة المال' : 'Bureau Finances')}
              </span>
              {data.building.committee?.treasurerPhone && (
                <span dir="ltr" className="font-mono text-slate-600 dark:text-slate-300">
                  {data.building.committee.treasurerPhone}
                </span>
              )}
            </div>
            {data.building.committee?.treasurerPhone && (
              <a
                href={`tel:${data.building.committee.treasurerPhone}`}
                className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs shrink-0"
              >
                <Phone className="w-4 h-4" />
              </a>
            )}
          </div>

          {/* Technique */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">
                {lang === 'ar' ? 'المسؤول التقني' : 'Responsable Technique'}
              </span>
              <span className="font-bold text-sm text-slate-900 dark:text-white block truncate mt-0.5">
                {data.building.committee?.technicalLead || (lang === 'ar' ? 'خلية الصيانة' : 'Cellule Technique')}
              </span>
              {data.building.committee?.technicalLeadPhone && (
                <span dir="ltr" className="font-mono text-slate-600 dark:text-slate-300">
                  {data.building.committee.technicalLeadPhone}
                </span>
              )}
            </div>
            {data.building.committee?.technicalLeadPhone && (
              <a
                href={`tel:${data.building.committee.technicalLeadPhone}`}
                className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs shrink-0"
              >
                <Phone className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Quick Reflex Safety Guide */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {safetyReflexes.map((tip, idx) => (
          <div
            key={idx}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-2"
          >
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
              {tip.icon}
              <span>{tip.title}</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{tip.desc}</p>
          </div>
        ))}
      </div>

      {/* Accredited Vendors Filter + Cards */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'all' as const, label: lang === 'ar' ? 'كل المقاولين' : 'Tous' },
              { id: '24h' as const, label: '24h/7j' },
              { id: 'ascenseur' as const, label: lang === 'ar' ? 'المصاعد' : 'Ascenseurs' },
              { id: 'plomberie' as const, label: lang === 'ar' ? 'السباكة والمياه' : 'Plomberie & Eau' },
              { id: 'electricite' as const, label: lang === 'ar' ? 'الكهرباء' : 'Électricité' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilterMode(f.id)}
                className={`px-3 py-1.5 rounded-xl font-semibold cursor-pointer ${
                  filterMode === f.id
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="relative min-w-[220px] grow sm:grow-0">
            <Search className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={lang === 'ar' ? 'بحث عن تقني أو شركة...' : 'Rechercher un prestataire...'}
              className="w-full ps-9 pe-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
            />
          </div>
        </div>

        {filteredVendors.length === 0 ? (
          <EmptyState
            icon={<Phone className="w-7 h-7" />}
            title={lang === 'ar' ? 'لا يوجد مقاولون مطابقون' : 'Aucun contact trouvé'}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredVendors.map((v: Vendor) => (
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
                        <span className="text-xs text-slate-500 dark:text-slate-400 block truncate">
                          {v.specialty}
                        </span>
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
                    <div className="flex items-center gap-1.5">
                      <a
                        href={`tel:${v.phone}`}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold"
                      >
                        {lang === 'ar' ? 'اتصال' : 'Appeler'}
                      </a>
                      <button
                        type="button"
                        onClick={() => handleCopy(v.id, v.phone)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer"
                        title={lang === 'ar' ? 'نسخ' : 'Copier'}
                      >
                        {copiedKey === v.id ? (
                          <Check className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {v.secondaryPhone && (
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                      <a href={`tel:${v.secondaryPhone}`} dir="ltr" className="font-mono flex items-center gap-1 hover:underline">
                        <Clock className="w-3 h-3" />
                        {v.secondaryPhone}
                      </a>
                      <button
                        type="button"
                        onClick={() => handleCopy(`${v.id}-sec`, v.secondaryPhone!)}
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
        )}
      </div>
    </div>
  );
};
