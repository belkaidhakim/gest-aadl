import React, { useState } from 'react';
import {
  Building2,
  LayoutDashboard,
  Grid3X3,
  Receipt,
  Wrench,
  Wallet,
  Megaphone,
  Phone,
  ClipboardList,
  Settings,
  Search,
  Bell,
  Sun,
  Moon,
  Languages,
  PlusCircle,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  Eye,
  Menu,
  X,
  Cloud,
  HardDrive,
  MessageSquare,
  CreditCard,
} from 'lucide-react';
import { useAppStore } from '../../stores/AppStore';
import { useI18n } from '../../i18n';
import { canManageFinance, canManageSettings } from '../../utils/permissions';
import { AppTab } from '../useRoute';
import { PwaInstallButton } from '../../components/PwaInstallButton';

interface BureauLayoutProps {
  currentTab: AppTab;
  onNavigate: (tab: AppTab, forcePortal?: 'bureau' | 'resident') => void;
  isDark: boolean;
  onToggleTheme: () => void;
  onOpenNewPayment: () => void;
  onOpenSearch: () => void;
  children: React.ReactNode;
}

export const BureauLayout: React.FC<BureauLayoutProps> = ({
  currentTab,
  onNavigate,
  isDark,
  onToggleTheme,
  onOpenNewPayment,
  onOpenSearch,
  children,
}) => {
  const { lang, toggleLang, t } = useI18n();
  const {
    data,
    buildings,
    activeBuildingId,
    switchBuilding,
    role,
    user,
    serverConnected,
    switchToResident,
  } = useAppStore();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);

  const urgentIncidents = data.incidents.filter((i) => i.priority === 'urgente' && i.status !== 'resolu');
  const awaitingChatIncidents = data.incidents.filter(
    (i) =>
      i.status !== 'resolu' &&
      i.messages &&
      i.messages.length > 0 &&
      i.messages[i.messages.length - 1].senderRole === 'resident'
  );
  const pendingDeclarations = (data.paymentDeclarations || []).filter((d) => d.status === 'pending');
  const incidentAlerts = urgentIncidents.length + awaitingChatIncidents.length;
  const totalAlerts = incidentAlerts + pendingDeclarations.length;

  const roleBadgeLabel =
    role === 'president'
      ? t('rolePresident')
      : role === 'treasurer'
      ? t('roleTreasurer')
      : t('roleTechnical');

  const navGroups: Array<{
    title: string;
    items: Array<{ id: AppTab; label: string; icon: React.ReactNode; badge?: number }>;
  }> = [
    {
      title: t('navGroupPilotage'),
      items: [
        { id: 'dashboard', label: t('tabDashboard'), icon: <LayoutDashboard className="w-4 h-4" /> },
        { id: 'matrix', label: t('tabMatrix'), icon: <Grid3X3 className="w-4 h-4" /> },
      ],
    },
    {
      title: t('navGroupFinance'),
      items: [
        {
          id: 'fees',
          label: t('tabFees'),
          icon: <Receipt className="w-4 h-4" />,
          badge: pendingDeclarations.length > 0 ? pendingDeclarations.length : undefined,
        },
        { id: 'treasury', label: t('tabTreasury'), icon: <Wallet className="w-4 h-4" /> },
        { id: 'audit', label: t('tabAudit'), icon: <ClipboardList className="w-4 h-4" /> },
      ],
    },
    {
      title: t('navGroupTechnical'),
      items: [
        {
          id: 'incidents',
          label: t('tabIncidents'),
          icon: <Wrench className="w-4 h-4" />,
          badge: incidentAlerts > 0 ? incidentAlerts : undefined,
        },
        { id: 'directory', label: t('tabDirectory'), icon: <Phone className="w-4 h-4" /> },
      ],
    },
    {
      title: t('navGroupGovernance'),
      items: [
        { id: 'notices', label: t('tabNotices'), icon: <Megaphone className="w-4 h-4" /> },
        ...(canManageSettings(role)
          ? [{ id: 'settings' as AppTab, label: t('tabSettings'), icon: <Settings className="w-4 h-4" /> }]
          : []),
      ],
    },
  ];

  const activeTitle =
    navGroups.flatMap((g) => g.items).find((item) => item.id === currentTab)?.label || t('tabDashboard');

  const renderSidebarContent = (isMobile = false) => (
    <div className="flex flex-col h-full">
      {/* Brand + Collapse */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 shrink-0">
        <button
          onClick={() => {
            onNavigate('dashboard');
            if (isMobile) setMobileMenuOpen(false);
          }}
          className="flex items-center gap-2.5 text-start cursor-pointer min-w-0"
        >
          <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          {(!collapsed || isMobile) && (
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-sm tracking-tight text-slate-900 dark:text-white">
                  {t('appName')}
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  v2
                </span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-slate-400">
                {serverConnected ? <Cloud className="w-3 h-3 text-emerald-500" /> : <HardDrive className="w-3 h-3" />}
                <span>{serverConnected ? t('sharedMode') : t('localMode')}</span>
              </div>
            </div>
          )}
        </button>

        {isMobile ? (
          <button onClick={() => setMobileMenuOpen(false)} className="p-1.5 text-slate-400 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        ) : (
          <button
            onClick={() => setCollapsed((p) => !p)}
            title={collapsed ? t('expandSidebar') : t('collapseSidebar')}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Building Switcher */}
      {(!collapsed || isMobile) && (
        <div className="px-3 pt-3 pb-2 border-b border-slate-100 dark:border-slate-800/70">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 px-1">
            {t('buildingSwitcherLabel')}
          </label>
          <select
            value={activeBuildingId}
            onChange={(e) => switchBuilding(e.target.value)}
            className="w-full text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white cursor-pointer"
          >
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.buildingNumber} — {b.wilaya}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Navigation Sections */}
      <nav className="grow overflow-y-auto px-3 py-4 space-y-5">
        {navGroups.map((group) => (
          <div key={group.title} className="space-y-1">
            {(!collapsed || isMobile) && (
              <div className="px-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {group.title}
              </div>
            )}
            {group.items.map((item) => {
              const active = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onNavigate(item.id);
                    if (isMobile) setMobileMenuOpen(false);
                  }}
                  title={collapsed && !isMobile ? item.label : undefined}
                  className={`w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                    active
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 font-semibold'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80'
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <span className="shrink-0">{item.icon}</span>
                    {(!collapsed || isMobile) && <span className="truncate">{item.label}</span>}
                  </span>
                  {item.badge !== undefined && (!collapsed || isMobile) && (
                    <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-bold shrink-0">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Bottom User Card + Resident Preview */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-2 shrink-0">
        {(!collapsed || isMobile) && (
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 text-xs">
            <div className="font-bold text-slate-900 dark:text-white truncate">{user.fullName}</div>
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
              {roleBadgeLabel}
            </div>
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              onNavigate('dashboard', 'resident');
              if (isMobile) setMobileMenuOpen(false);
            }}
            title={t('switchToResidentPortal')}
            className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2 text-[11px] font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
            {(!collapsed || isMobile) && <span>{t('switchToResidentPortal')}</span>}
          </button>

          <button
            onClick={switchToResident}
            title={t('logoutBtn')}
            className="p-2 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 rounded-lg cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex font-sans transition-colors">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col sticky top-0 h-screen bg-white dark:bg-slate-900 border-e border-slate-200 dark:border-slate-800 transition-all duration-200 shrink-0 no-print ${
          collapsed ? 'w-[76px]' : 'w-64'
        }`}
      >
        {renderSidebarContent(false)}
      </aside>

      {/* Mobile Drawer Sidebar */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex no-print">
          <div onClick={() => setMobileMenuOpen(false)} className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs" />
          <aside className="relative z-10 w-72 max-w-[85vw] bg-white dark:bg-slate-900 h-full border-e border-slate-200 dark:border-slate-800 shadow-2xl">
            {renderSidebarContent(true)}
          </aside>
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="sticky top-0 z-30 h-16 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between gap-3 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <div className="text-xs text-slate-400 truncate hidden sm:block">
                {data.building.residenceName} · {data.building.buildingNumber}
              </div>
              <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                {activeTitle}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <PwaInstallButton />
            {/* Search Ctrl+K Trigger */}
            <button
              onClick={onOpenSearch}
              className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl border border-slate-200/80 dark:border-slate-700 cursor-pointer"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden md:inline">{t('quickSearchShortcut')}</span>
              <kbd className="hidden sm:inline px-1.5 py-0.5 text-[10px] font-mono bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700">
                Ctrl+K
              </kbd>
            </button>

            {/* Alerts Popover */}
            <div className="relative">
              <button
                onClick={() => setAlertsOpen((p) => !p)}
                className="relative p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                {totalAlerts > 0 && (
                  <span className="absolute top-1.5 end-1.5 w-2 h-2 rounded-full bg-rose-500" />
                )}
              </button>

              {alertsOpen && (
                <div className="absolute end-0 mt-2 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-3 space-y-2 text-xs z-40">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
                    <span>{t('alertsTitle')} ({totalAlerts})</span>
                    <button onClick={() => setAlertsOpen(false)} className="text-slate-400 cursor-pointer">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {totalAlerts === 0 ? (
                    <p className="text-slate-500 py-2">{t('noAlertsText')}</p>
                  ) : (
                    <div className="space-y-1.5 max-h-56 overflow-y-auto">
                      {pendingDeclarations.map((decl) => (
                        <button
                          key={`decl-${decl.id}`}
                          onClick={() => {
                            onNavigate('fees');
                            setAlertsOpen(false);
                          }}
                          className="w-full text-start p-2 rounded-lg bg-sky-50 dark:bg-sky-950/50 text-sky-900 dark:text-sky-200 hover:bg-sky-100 cursor-pointer"
                        >
                          <div className="font-bold truncate flex items-center gap-1">
                            <CreditCard className="w-3 h-3 shrink-0" />
                            <span className="truncate">
                              {decl.paymentMethod} — {decl.apartmentNumber}
                            </span>
                          </div>
                          <div className="text-[10px] opacity-85 truncate">
                            {decl.residentName} · {decl.amountDZD} DZD à valider
                          </div>
                        </button>
                      ))}
                      {awaitingChatIncidents.map((inc) => {
                        const last = inc.messages![inc.messages!.length - 1];
                        return (
                          <button
                            key={`chat-${inc.id}`}
                            onClick={() => {
                              try {
                                sessionStorage.setItem('gest_aadl_open_chat_inc', inc.id);
                              } catch {
                                // ignore
                              }
                              onNavigate('incidents');
                              setAlertsOpen(false);
                            }}
                            className="w-full text-start p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-200 hover:bg-emerald-100 cursor-pointer"
                          >
                            <div className="font-bold truncate flex items-center gap-1">
                              <MessageSquare className="w-3 h-3 shrink-0" />
                              <span className="truncate">{inc.title}</span>
                            </div>
                            <div className="text-[10px] opacity-85 truncate">
                              {last.senderName} : « {last.text} »
                            </div>
                          </button>
                        );
                      })}
                      {urgentIncidents.map((inc) => (
                        <button
                          key={inc.id}
                          onClick={() => {
                            onNavigate('incidents');
                            setAlertsOpen(false);
                          }}
                          className="w-full text-start p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 hover:bg-rose-100 cursor-pointer"
                        >
                          <div className="font-bold truncate">{inc.title}</div>
                          <div className="text-[10px] opacity-80">{inc.location}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bilingual Toggle */}
            <button
              onClick={toggleLang}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer"
            >
              <Languages className="w-3.5 h-3.5 text-emerald-600" />
              <span>{lang === 'fr' ? 'العربية' : 'FR'}</span>
            </button>

            {/* Theme Toggle */}
            <button
              onClick={onToggleTheme}
              aria-label={isDark ? t('lightMode') : t('darkMode')}
              className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Primary CTA */}
            {canManageFinance(role) && (
              <button
                onClick={onOpenNewPayment}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span className="hidden sm:inline">{t('collectFeeBtn')}</span>
              </button>
            )}
          </div>
        </header>

        {/* Main Viewport */}
        <main className="grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-8">
          {children}
        </main>

        {/* Mobile Bottom Bar */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-2 py-1.5 flex items-center justify-around no-print">
          {[
            { id: 'dashboard' as AppTab, label: t('tabDashboard'), icon: <LayoutDashboard className="w-4 h-4" /> },
            { id: 'matrix' as AppTab, label: t('tabMatrix'), icon: <Grid3X3 className="w-4 h-4" /> },
            { id: 'fees' as AppTab, label: t('tabFees'), icon: <Receipt className="w-4 h-4" /> },
            { id: 'incidents' as AppTab, label: t('curativeTab'), icon: <Wrench className="w-4 h-4" /> },
            { id: 'treasury' as AppTab, label: t('tabTreasury'), icon: <Wallet className="w-4 h-4" /> },
          ].map((tab) => {
            const active = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onNavigate(tab.id)}
                className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] font-medium cursor-pointer ${
                  active ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {tab.icon}
                <span className="truncate max-w-[60px]">{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
};
