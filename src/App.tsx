import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Apartment, AssemblyMinutes, HouseRuleSection, Notice, PaymentRecord } from './types';
import { ToastProvider } from './components/ui/ToastProvider';
import { ConfirmProvider } from './components/ui/ConfirmDialog';
import { AppStoreProvider, useAppStore } from './stores/AppStore';
import { useAppRoute } from './app/useRoute';
import { BureauLayout } from './app/layouts/BureauLayout';
import { ResidentLayout } from './app/layouts/ResidentLayout';
import { CommandPalette } from './app/CommandPalette';
import { AuthModal } from './components/AuthModal';
import { RecordPaymentModal } from './features/fees/RecordPaymentModal';
import { ReceiptModal } from './features/fees/ReceiptModal';
import { NoticePrintModal } from './features/governance/NoticePrintModal';
import { canManageFinance, canManageSettings } from './utils/permissions';

const AdminDashboard = lazy(() =>
  import('./features/dashboard/AdminDashboard').then((m) => ({ default: m.AdminDashboard }))
);
const ResidentEssentialPage = lazy(() =>
  import('./features/resident/ResidentEssentialPage').then((m) => ({ default: m.ResidentEssentialPage }))
);
const ResidentIncidentsPage = lazy(() =>
  import('./features/resident/ResidentIncidentsPage').then((m) => ({ default: m.ResidentIncidentsPage }))
);
const ResidentNoticesPage = lazy(() =>
  import('./features/resident/ResidentNoticesPage').then((m) => ({ default: m.ResidentNoticesPage }))
);
const ResidentEmergenciesPage = lazy(() =>
  import('./features/resident/ResidentEmergenciesPage').then((m) => ({ default: m.ResidentEmergenciesPage }))
);
const BuildingMatrixPage = lazy(() =>
  import('./features/building/BuildingMatrixPage').then((m) => ({ default: m.BuildingMatrixPage }))
);
const FeesPage = lazy(() =>
  import('./features/fees/FeesPage').then((m) => ({ default: m.FeesPage }))
);
const MaintenancePage = lazy(() =>
  import('./features/maintenance/MaintenancePage').then((m) => ({ default: m.MaintenancePage }))
);
const TreasuryPage = lazy(() =>
  import('./features/treasury/TreasuryPage').then((m) => ({ default: m.TreasuryPage }))
);
const GovernancePage = lazy(() =>
  import('./features/governance/GovernancePage').then((m) => ({ default: m.GovernancePage }))
);
const DirectoryPage = lazy(() =>
  import('./features/directory/DirectoryPage').then((m) => ({ default: m.DirectoryPage }))
);
const AuditLogPage = lazy(() =>
  import('./features/settings/AuditLogPage').then((m) => ({ default: m.AuditLogPage }))
);
const SettingsPage = lazy(() =>
  import('./features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage }))
);

const PageLoader: React.FC = () => (
  <div className="min-h-[45vh] flex items-center justify-center">
    <Loader2 className="w-7 h-7 text-emerald-600 animate-spin" />
  </div>
);

const AppShell: React.FC = () => {
  const {
    data,
    role,
    isBureau,
    isDefaultPassword,
    loading,
    refreshFromServer,
    savePayment,
  } = useAppStore();

  const { portal, currentTab, navigate } = useAppRoute(role);

  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      return localStorage.getItem('gest_aadl_theme') === 'dark';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    try {
      localStorage.setItem('gest_aadl_theme', isDark ? 'dark' : 'light');
    } catch {
      // ignore
    }
  }, [isDark]);

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [payDefaultApt, setPayDefaultApt] = useState<Apartment | null>(null);
  const [receiptPayment, setReceiptPayment] = useState<PaymentRecord | null>(null);
  const [printNotice, setPrintNotice] = useState<Notice | null>(null);
  const [printUnpaid, setPrintUnpaid] = useState<{ month: string; unpaidApts: Apartment[] } | null>(null);
  const [printMinutes, setPrintMinutes] = useState<AssemblyMinutes | null>(null);
  const [printRules, setPrintRules] = useState<HouseRuleSection[] | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleOpenNewPayment = useCallback(
    (apt?: Apartment) => {
      if (!canManageFinance(role)) return;
      setPayDefaultApt(apt || null);
      setIsPayModalOpen(true);
    },
    [role]
  );

  const handleSavePayment = async (payment: PaymentRecord, openReceipt: boolean) => {
    await savePayment(payment);
    setIsPayModalOpen(false);
    setPayDefaultApt(null);
    if (openReceipt) {
      setReceiptPayment(payment);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
      </div>
    );
  }

  const renderPage = () => {
    if (portal !== 'bureau' || !isBureau) {
      switch (currentTab) {
        case 'incidents':
          return <ResidentIncidentsPage onNavigateTab={(tab) => navigate(tab, 'resident')} />;
        case 'notices':
          return (
            <ResidentNoticesPage
              onPrintNotice={(n) => setPrintNotice(n)}
              onPrintMinutes={(pv) => setPrintMinutes(pv)}
              onPrintHouseRules={() => setPrintRules(data.houseRules || [])}
            />
          );
        case 'directory':
          return <ResidentEmergenciesPage />;
        default:
          return <ResidentEssentialPage onNavigateTab={(tab) => navigate(tab, 'resident')} />;
      }
    }

    switch (currentTab) {
      case 'dashboard':
        return (
          <AdminDashboard
            onNavigateTab={(tab) => navigate(tab)}
            onOpenNewPayment={() => handleOpenNewPayment()}
            onSelectReceipt={(p) => setReceiptPayment(p)}
          />
        );
      case 'matrix':
        return (
          <BuildingMatrixPage
            onRecordPaymentForApt={(apt) => handleOpenNewPayment(apt)}
            onViewReceipt={(p) => setReceiptPayment(p)}
          />
        );
      case 'fees':
        return (
          <FeesPage
            onOpenNewPayment={(apt) => handleOpenNewPayment(apt)}
            onViewReceipt={(p) => setReceiptPayment(p)}
            onPrintUnpaidNotice={(month, unpaidApts) => setPrintUnpaid({ month, unpaidApts })}
          />
        );
      case 'incidents':
        return <MaintenancePage />;
      case 'treasury':
        return <TreasuryPage onPrintFinancialReport={() => window.print()} />;
      case 'notices':
        return (
          <GovernancePage
            onPrintNotice={(n) => setPrintNotice(n)}
            onPrintMinutes={(pv) => setPrintMinutes(pv)}
            onPrintHouseRules={() => setPrintRules(data.houseRules || [])}
          />
        );
      case 'directory':
        return <DirectoryPage />;
      case 'audit':
        return <AuditLogPage />;
      case 'settings':
        return canManageSettings(role) ? (
          <SettingsPage />
        ) : (
          <AdminDashboard
            onNavigateTab={(tab) => navigate(tab)}
            onOpenNewPayment={() => handleOpenNewPayment()}
            onSelectReceipt={(p) => setReceiptPayment(p)}
          />
        );
      default:
        return (
          <AdminDashboard
            onNavigateTab={(tab) => navigate(tab)}
            onOpenNewPayment={() => handleOpenNewPayment()}
            onSelectReceipt={(p) => setReceiptPayment(p)}
          />
        );
    }
  };

  return (
    <>
      {portal === 'bureau' && isBureau ? (
        <BureauLayout
          currentTab={currentTab}
          onNavigate={navigate}
          isDark={isDark}
          onToggleTheme={() => setIsDark((p) => !p)}
          onOpenNewPayment={() => handleOpenNewPayment()}
          onOpenSearch={() => setIsSearchOpen(true)}
        >
          <Suspense fallback={<PageLoader />}>{renderPage()}</Suspense>
        </BureauLayout>
      ) : (
        <ResidentLayout
          currentTab={currentTab}
          onNavigate={navigate}
          isDark={isDark}
          onToggleTheme={() => setIsDark((p) => !p)}
          onOpenAuthModal={() => setIsAuthOpen(true)}
          onOpenSearch={() => setIsSearchOpen(true)}
        >
          <Suspense fallback={<PageLoader />}>{renderPage()}</Suspense>
        </ResidentLayout>
      )}

      <CommandPalette
        open={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onNavigate={(tab) => navigate(tab)}
        onSelectReceipt={(p) => setReceiptPayment(p)}
      />

      {isAuthOpen && (
        <AuthModal
          isDefaultPassword={isDefaultPassword}
          onClose={() => setIsAuthOpen(false)}
          onAuthenticated={async () => {
            await refreshFromServer();
            navigate('dashboard', 'bureau');
          }}
        />
      )}

      {isPayModalOpen && canManageFinance(role) && (
        <RecordPaymentModal
          data={data}
          defaultApt={payDefaultApt}
          onClose={() => {
            setIsPayModalOpen(false);
            setPayDefaultApt(null);
          }}
          onSavePayment={handleSavePayment}
        />
      )}

      <ReceiptModal
        payment={receiptPayment}
        building={data.building}
        onClose={() => setReceiptPayment(null)}
      />

      <NoticePrintModal
        notice={printNotice}
        unpaidNotice={printUnpaid}
        minutes={printMinutes}
        houseRules={printRules}
        apartments={data.apartments}
        building={data.building}
        vendors={data.vendors}
        onClose={() => {
          setPrintNotice(null);
          setPrintUnpaid(null);
          setPrintMinutes(null);
          setPrintRules(null);
        }}
      />
    </>
  );
};

export function App() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <AppStoreProvider>
          <AppShell />
        </AppStoreProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}

export default App;
