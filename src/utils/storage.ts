import { AppData } from '../types';
import { initialAppData } from '../data/mockData';

const STORAGE_KEY = 'gest_aadl_app_state_v6';

export function normalizeAppData(parsed: Partial<AppData> | null | undefined): AppData {
  if (!parsed) return initialAppData;
  const building = {
    ...initialAppData.building,
    ...(parsed.building || {}),
    id: parsed.building?.id || initialAppData.building.id || 'bldg-e36',
    committee: {
      ...(initialAppData.building.committee || {
        president: initialAppData.building.syndicPresident,
        presidentPhone: initialAppData.building.syndicPhone,
        treasurer: '',
        technicalLead: '',
      }),
      ...(parsed.building?.committee || {}),
    },
  };

  return {
    building,
    apartments: Array.isArray(parsed.apartments) && parsed.apartments.length > 0
      ? parsed.apartments
      : initialAppData.apartments,
    payments: Array.isArray(parsed.payments) ? parsed.payments : initialAppData.payments,
    incidents: Array.isArray(parsed.incidents) ? parsed.incidents : initialAppData.incidents,
    transactions: Array.isArray(parsed.transactions) ? parsed.transactions : initialAppData.transactions,
    notices: Array.isArray(parsed.notices) ? parsed.notices : initialAppData.notices,
    votes: Array.isArray(parsed.votes) ? parsed.votes : initialAppData.votes,
    vendors: Array.isArray(parsed.vendors) ? parsed.vendors : initialAppData.vendors,
    budgetPlan: Array.isArray(parsed.budgetPlan) && parsed.budgetPlan.length > 0
      ? parsed.budgetPlan
      : initialAppData.budgetPlan,
    preventiveTasks: Array.isArray(parsed.preventiveTasks)
      ? parsed.preventiveTasks
      : initialAppData.preventiveTasks,
    assemblyMinutes: Array.isArray(parsed.assemblyMinutes)
      ? parsed.assemblyMinutes
      : initialAppData.assemblyMinutes,
    houseRules: Array.isArray(parsed.houseRules) && parsed.houseRules.length > 0
      ? parsed.houseRules
      : initialAppData.houseRules,
  };
}

export function loadAppData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      saveAppData(initialAppData);
      return initialAppData;
    }
    const parsed = JSON.parse(raw);
    return normalizeAppData(parsed);
  } catch (error) {
    console.error('Failed to load AppData from localStorage, using defaults', error);
    return initialAppData;
  }
}

export function saveAppData(data: AppData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save AppData to localStorage', error);
  }
}

export function resetAppDataToDefaults(): AppData {
  try {
    localStorage.removeItem(STORAGE_KEY);
    saveAppData(initialAppData);
    return initialAppData;
  } catch (error) {
    console.error('Error resetting AppData', error);
    return initialAppData;
  }
}

export function exportAppDataJSON(data: AppData): void {
  const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
    JSON.stringify(data, null, 2)
  )}`;
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', jsonString);
  const dateStr = new Date().toISOString().slice(0, 10);
  downloadAnchor.setAttribute(
    'download',
    `gest_aadl_${data.building.buildingNumber.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${dateStr}.json`
  );
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}
