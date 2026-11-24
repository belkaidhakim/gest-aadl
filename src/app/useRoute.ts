import { useCallback, useEffect, useState } from 'react';
import { UserRole } from '../types';
import { canManageSettings, isBureauRole } from '../utils/permissions';

export type AppTab =
  | 'dashboard'
  | 'matrix'
  | 'fees'
  | 'incidents'
  | 'treasury'
  | 'notices'
  | 'directory'
  | 'audit'
  | 'settings';

const PATH_TO_TAB_BUREAU: Record<string, AppTab> = {
  '/bureau': 'dashboard',
  '/bureau/dashboard': 'dashboard',
  '/bureau/matrice': 'matrix',
  '/bureau/cotisations': 'fees',
  '/bureau/maintenance': 'incidents',
  '/bureau/caisse': 'treasury',
  '/bureau/gouvernance': 'notices',
  '/bureau/prestataires': 'directory',
  '/bureau/audit': 'audit',
  '/bureau/parametres': 'settings',
};

const TAB_TO_PATH_BUREAU: Record<AppTab, string> = {
  dashboard: '/bureau',
  matrix: '/bureau/matrice',
  fees: '/bureau/cotisations',
  incidents: '/bureau/maintenance',
  treasury: '/bureau/caisse',
  notices: '/bureau/gouvernance',
  directory: '/bureau/prestataires',
  audit: '/bureau/audit',
  settings: '/bureau/parametres',
};

const PATH_TO_TAB_RESIDENT: Record<string, AppTab> = {
  '/resident': 'dashboard',
  '/resident/pannes': 'incidents',
  '/resident/avis': 'notices',
  '/resident/urgences': 'directory',
};

const TAB_TO_PATH_RESIDENT: Partial<Record<AppTab, string>> = {
  dashboard: '/resident',
  incidents: '/resident/pannes',
  notices: '/resident/avis',
  directory: '/resident/urgences',
};

function parseRoute(pathname: string, role: UserRole): { portal: 'bureau' | 'resident'; tab: AppTab } {
  const clean = pathname.replace(/\/+$/, '') || '/';
  const bureauAllowed = isBureauRole(role);

  if (clean.startsWith('/resident')) {
    return {
      portal: 'resident',
      tab: PATH_TO_TAB_RESIDENT[clean] || 'dashboard',
    };
  }

  if (clean.startsWith('/bureau') && bureauAllowed) {
    const tab = PATH_TO_TAB_BUREAU[clean] || 'dashboard';
    if (tab === 'settings' && !canManageSettings(role)) {
      return { portal: 'bureau', tab: 'dashboard' };
    }
    return { portal: 'bureau', tab };
  }

  if (bureauAllowed && clean === '/') {
    return { portal: 'bureau', tab: 'dashboard' };
  }

  return { portal: 'resident', tab: 'dashboard' };
}

export function useAppRoute(role: UserRole) {
  const [pathname, setPathname] = useState<string>(() =>
    typeof window !== 'undefined' ? window.location.pathname : '/'
  );

  useEffect(() => {
    const onPop = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const parsed = parseRoute(pathname, role);

  const navigate = useCallback(
    (tab: AppTab, forcePortal?: 'bureau' | 'resident') => {
      const targetPortal = forcePortal || (isBureauRole(role) && parsed.portal === 'bureau' ? 'bureau' : 'resident');
      const nextPath =
        targetPortal === 'bureau' && (forcePortal === 'bureau' || isBureauRole(role))
          ? TAB_TO_PATH_BUREAU[tab] || '/bureau'
          : TAB_TO_PATH_RESIDENT[tab] || '/resident';

      if (window.location.pathname !== nextPath) {
        window.history.pushState(null, '', nextPath);
        setPathname(nextPath);
      }
    },
    [role, parsed.portal]
  );

  // Sync URL cleanly on role switch
  useEffect(() => {
    if (!isBureauRole(role) && pathname.startsWith('/bureau')) {
      window.history.replaceState(null, '', '/resident');
      setPathname('/resident');
    } else if (isBureauRole(role) && pathname === '/') {
      window.history.replaceState(null, '', '/bureau');
      setPathname('/bureau');
    } else if (!isBureauRole(role) && pathname === '/') {
      window.history.replaceState(null, '', '/resident');
      setPathname('/resident');
    }
  }, [role, pathname]);

  return {
    portal: parsed.portal,
    currentTab: parsed.tab,
    navigate,
  };
}
