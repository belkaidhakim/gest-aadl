import React from 'react';
import {
  Building2,
  Sun,
  Moon,
  Languages,
  Lock,
  ShieldCheck,
  Search,
  Home,
  Wrench,
  Megaphone,
  Phone,
} from 'lucide-react';
import { useAppStore } from '../../stores/AppStore';
import { useI18n } from '../../i18n';
import { AppTab } from '../useRoute';

interface ResidentLayoutProps {
  currentTab: AppTab;
  onNavigate: (tab: AppTab, forcePortal?: 'bureau' | 'resident') => void;
  isDark: boolean;
  onToggleTheme: () => void;
  onOpenAuthModal: () => void;
  onOpenSearch: () => void;
  children: React.ReactNode;
}

export const ResidentLayout: React.FC<ResidentLayoutProps> = ({
  currentTab,
  onNavigate,
  isDark,
  onToggleTheme,
  onOpenAuthModal,
  onOpenSearch,
  children,
}) => {
  const { lang, toggleLang, t } = useI18n();
  const { data, buildings, activeBuildingId, switchBuilding, isBureau } = useAppStore();

  const openIncidentsCount = data.incidents.filter((i) => i.status !== 'resolu').length;
  const hasUrgentIncident = data.incidents.some((i) => i.priority === 'urgente' && i.status !== 'resolu');
  const importantNoticesCount = data.notices.filter(
    (n) => n.isPinned || n.type === 'urgent' || n.type === 'coupure_eau'
  ).length;

  const tabs: Array<{ id: AppTab; label: string; icon: React.ReactNode; badge?: number; urgent?: boolean }> = [
    { id: 'dashboard', label: t('tabEssential'), icon: <Home className="w-4 h-4" /> },
    {
      id: 'incidents',
      label: t('tabIncidentsResident'),
      icon: <Wrench className="w-4 h-4" />,
      badge: openIncidentsCount,
      urgent: hasUrgentIncident,
    },
    {
      id: 'notices',
      label: t('tabNoticesResident'),
      icon: <Megaphone className="w-4 h-4" />,
      badge: importantNoticesCount,
    },
    { id: 'directory', label: t('tabDirectoryResident'), icon: <Phone className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors">
      {/* Sticky Frosted Header */}
      <header className="sticky top-0 z-30 bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
          {/* Brand + Live Status + Multi-Building Selector */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => onNavigate('dashboard', 'resident')}
              className="flex items-center gap-2.5 text-start cursor-pointer min-w-0"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center shadow-sm shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white">
                    {t('appName')}
                  </span>
                  {buildings.length <= 1 && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      {data.building.buildingNumber}
                    </span>
                  )}
                  <span
                    className={`hidden xl:inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      hasUrgentIncident
                        ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        hasUrgentIncident ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
                      }`}
                    />
                    {hasUrgentIncident
                      ? lang === 'ar'
                        ? 'تدخل جاري'
                        : 'Intervention'
                      : lang === 'ar'
                      ? 'العمارة تعمل جيداً'
                      : 'Opérationnel'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[160px] sm:max-w-xs">
                  {data.building.residenceName}
                </p>
              </div>
            </button>

            {buildings.length > 1 && (
              <select
                value={activeBuildingId}
                onChange={(e) => switchBuilding(e.target.value)}
                aria-label={lang === 'ar' ? 'اختيار العمارة' : 'Sélectionner un bâtiment'}
                className="text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100/80 dark:bg-slate-800 text-slate-800 dark:text-white cursor-pointer"
              >
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.buildingNumber}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Segmented Desktop Navigation */}
          <nav
            aria-label={lang === 'ar' ? 'القائمة الرئيسية للساكن' : 'Navigation portail résident'}
            className="hidden md:flex items-center gap-1 bg-slate-100/80 dark:bg-slate-800/70 p-1 rounded-2xl border border-slate-200/70 dark:border-slate-700/70"
          >
            {tabs.map((tab) => {
              const active = currentTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onNavigate(tab.id, 'resident')}
                  className={`px-3.5 py-1.5 text-xs sm:text-[13px] font-medium rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                    active
                      ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 font-bold shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span className={active ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}>
                    {tab.icon}
                  </span>
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none ${
                        tab.urgent
                          ? 'bg-rose-500 text-white'
                          : active
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Controls */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onOpenSearch}
              className="hidden lg:inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs text-slate-500 dark:text-slate-400 bg-slate-100/80 dark:bg-slate-800/80 hover:bg-slate-200/80 dark:hover:bg-slate-800 border border-slate-200/70 dark:border-slate-700 cursor-pointer"
              title="Ctrl+K"
            >
              <Search className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? 'بحث...' : 'Rechercher'}</span>
              <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                Ctrl+K
              </kbd>
            </button>

            <button
              onClick={onOpenSearch}
              aria-label={lang === 'ar' ? 'بحث' : 'Rechercher'}
              className="lg:hidden p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <Search className="w-4 h-4" />
            </button>

            <button
              onClick={toggleLang}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer"
            >
              <Languages className="w-3.5 h-3.5 text-emerald-600" />
              <span>{lang === 'fr' ? 'العربية' : 'FR'}</span>
            </button>

            <button
              onClick={onToggleTheme}
              aria-label={isDark ? t('lightMode') : t('darkMode')}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {isBureau ? (
              <button
                onClick={() => onNavigate('dashboard', 'bureau')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{t('bureauMode')}</span>
              </button>
            ) : (
              <button
                onClick={onOpenAuthModal}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/40 rounded-xl border border-amber-200 dark:border-amber-800 cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t('bureauMode')}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-8">
        {children}
      </main>

      {/* Subtle Resident Footer */}
      <footer className="hidden md:block border-t border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/60 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-emerald-600" />
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              {data.building.buildingNumber} · {data.building.residenceName}
            </span>
            <span>({data.building.wilaya})</span>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <a
              href={`tel:${data.building.syndicPhone}`}
              className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>{data.building.syndicPresident} :</span>
              <span dir="ltr" className="font-mono">
                {data.building.syndicPhone}
              </span>
            </a>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px]">
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
              {lang === 'ar'
                ? 'وضع الساكن — المعطيات الشخصية محمية'
                : 'Portail Résident · Données personnelles protégées'}
            </span>
          </div>
        </div>
      </footer>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 px-2 py-1.5 flex items-center justify-around no-print">
        {tabs.map((tab) => {
          const active = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onNavigate(tab.id, 'resident')}
              className={`relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl text-[10px] font-medium transition-colors cursor-pointer ${
                active
                  ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 font-bold'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span
                  className={`absolute top-1 end-2 min-w-[15px] h-[15px] px-1 rounded-full text-[9px] font-bold flex items-center justify-center ${
                    tab.urgent
                      ? 'bg-rose-500 text-white'
                      : 'bg-emerald-600 text-white'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
};
