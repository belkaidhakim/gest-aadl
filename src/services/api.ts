import {
  Apartment,
  AppData,
  AssemblyMinutes,
  AssemblyVote,
  AuditLogEntry,
  AuthUser,
  BudgetAllocation,
  BuildingInfo,
  BuildingSummary,
  BureauRole,
  HouseRuleSection,
  Incident,
  IncidentStatus,
  ManagedUser,
  Notice,
  PaymentRecord,
  PreventiveTask,
  Transaction,
  UserRole,
  Vendor,
  VendorQuote,
} from '../types';
import { normalizeAppData } from '../utils/storage';

const TOKEN_KEY = 'gest_aadl_auth_token';
const LOCAL_SESSION_KEY = 'gest_aadl_local_session_v1';
const LOCAL_PASSWORDS_KEY = 'gest_aadl_local_passwords_v1';

export interface ServerStatus {
  connected: boolean;
  role: UserRole;
  user: AuthUser;
  isDefaultPassword: boolean;
}

const LOCAL_BUREAU_ACCOUNTS: Record<
  string,
  { id: string; username: string; fullName: string; role: BureauRole; defaultPassword: string }
> = {
  president: {
    id: 'usr-president',
    username: 'president',
    fullName: 'M. MELLIKECHE FERHAT',
    role: 'president',
    defaultPassword: 'syndic2026',
  },
  tresorier: {
    id: 'usr-tresorier',
    username: 'tresorier',
    fullName: 'M. HAMOUDI NOURDINE',
    role: 'treasurer',
    defaultPassword: 'tresorier2026',
  },
  technique: {
    id: 'usr-technique',
    username: 'technique',
    fullName: 'M. BELKACEMI OMAR',
    role: 'technical',
    defaultPassword: 'tech2026',
  },
};

function getLocalPasswords(): Record<string, string> {
  try {
    const raw = localStorage.getItem(LOCAL_PASSWORDS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed as Record<string, string>;
    }
  } catch {
    // ignore
  }
  return {};
}

function getLocalSessionName(): string {
  try {
    return localStorage.getItem(LOCAL_SESSION_KEY) || 'president';
  } catch {
    return 'president';
  }
}

function getLocalServerStatus(): ServerStatus {
  const sessionName = getLocalSessionName();
  if (sessionName === 'resident') {
    return {
      connected: false,
      role: 'resident',
      user: { id: 'resident', username: 'resident', fullName: 'Résident', role: 'resident' },
      isDefaultPassword: false,
    };
  }
  const acct = LOCAL_BUREAU_ACCOUNTS[sessionName] || LOCAL_BUREAU_ACCOUNTS.president;
  const overrides = getLocalPasswords();
  return {
    connected: false,
    role: acct.role,
    user: { id: acct.id, username: acct.username, fullName: acct.fullName, role: acct.role },
    isDefaultPassword: !overrides[acct.username],
  };
}

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function apiRequest<T>(
  url: string,
  options: RequestInit = {}
): Promise<{ ok: boolean; data?: T; error?: string; offline?: boolean }> {
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        ...getAuthHeaders(),
        ...(options.headers || {}),
      },
      credentials: 'include',
    });
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return { ok: false, offline: true, error: 'Serveur hors ligne' };
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: body.error || `Erreur serveur (${res.status})` };
    }
    return { ok: true, data: body as T };
  } catch {
    return { ok: false, offline: true, error: 'Serveur hors ligne' };
  }
}

export async function fetchServerStatus(): Promise<ServerStatus> {
  try {
    const res = await fetch('/api/auth/status', {
      headers: getAuthHeaders(),
      credentials: 'include',
    });
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok || !contentType.includes('application/json')) {
      return getLocalServerStatus();
    }
    const body = await res.json();
    const role: UserRole =
      body.role === 'president' || body.role === 'treasurer' || body.role === 'technical'
        ? body.role
        : 'resident';
    return {
      connected: true,
      role,
      user: body.user || { id: role, username: role, fullName: role, role },
      isDefaultPassword: Boolean(body.isDefaultPassword),
    };
  } catch {
    return getLocalServerStatus();
  }
}

export async function fetchBuildingsRemote(): Promise<BuildingSummary[] | null> {
  const res = await apiRequest<{ buildings: BuildingSummary[] }>('/api/buildings');
  return res.ok && res.data ? res.data.buildings : null;
}

export async function createBuildingRemote(data: AppData) {
  return apiRequest<{ ok: boolean; id: string; buildings: BuildingSummary[] }>('/api/buildings', {
    method: 'POST',
    body: JSON.stringify({ data }),
  });
}

export async function fetchRemoteState(buildingId?: string): Promise<{
  data: AppData;
  buildingId: string;
  buildings: BuildingSummary[];
} | null> {
  const qs = buildingId ? `?buildingId=${encodeURIComponent(buildingId)}` : '';
  const res = await apiRequest<{ data: Partial<AppData> | null; buildingId: string; buildings: BuildingSummary[] }>(
    `/api/state${qs}`
  );
  if (!res.ok || !res.data?.data) return null;
  return {
    data: normalizeAppData(res.data.data),
    buildingId: res.data.buildingId,
    buildings: res.data.buildings || [],
  };
}

export async function seedRemoteStateIfEmpty(data: AppData): Promise<boolean> {
  const res = await apiRequest('/api/state/init', {
    method: 'POST',
    body: JSON.stringify({ data }),
  });
  return res.ok;
}

export async function replaceRemoteState(buildingId: string, data: AppData) {
  return apiRequest(`/api/state?buildingId=${encodeURIComponent(buildingId)}`, {
    method: 'PUT',
    body: JSON.stringify({ buildingId, data }),
  });
}

// Granular domain API calls
export const updateBuildingRemote = (buildingId: string, building: BuildingInfo) =>
  apiRequest(`/api/building?buildingId=${encodeURIComponent(buildingId)}`, {
    method: 'PUT',
    body: JSON.stringify({ building }),
  });

export const updateApartmentRemote = (buildingId: string, apartment: Apartment) =>
  apiRequest(`/api/apartments/${encodeURIComponent(apartment.id)}?buildingId=${encodeURIComponent(buildingId)}`, {
    method: 'PUT',
    body: JSON.stringify({ apartment }),
  });

export const recordPaymentRemote = (buildingId: string, payment: PaymentRecord) =>
  apiRequest(`/api/payments?buildingId=${encodeURIComponent(buildingId)}`, {
    method: 'POST',
    body: JSON.stringify({ payment }),
  });

export const addTransactionRemote = (buildingId: string, transaction: Transaction) =>
  apiRequest(`/api/transactions?buildingId=${encodeURIComponent(buildingId)}`, {
    method: 'POST',
    body: JSON.stringify({ transaction }),
  });

export const deleteTransactionRemote = (buildingId: string, txId: string) =>
  apiRequest(`/api/transactions/${encodeURIComponent(txId)}?buildingId=${encodeURIComponent(buildingId)}`, {
    method: 'DELETE',
  });

export const updateBudgetRemote = (buildingId: string, budgetPlan: BudgetAllocation[]) =>
  apiRequest(`/api/budget?buildingId=${encodeURIComponent(buildingId)}`, {
    method: 'PUT',
    body: JSON.stringify({ budgetPlan }),
  });

export const uploadAttachmentRemote = (filename: string, dataUrl: string) =>
  apiRequest<{ ok: boolean; url: string; name: string }>('/api/uploads', {
    method: 'POST',
    body: JSON.stringify({ filename, dataUrl }),
  });

export interface ResidentIncidentReportPayload {
  title: string;
  category: Incident['category'];
  location: string;
  floor: number;
  priority: Incident['priority'];
  description: string;
  reportedBy: string;
}

export const reportResidentIncidentRemote = (
  buildingId: string,
  report: ResidentIncidentReportPayload
) =>
  apiRequest<{ ok: boolean; incident: Incident }>(
    `/api/incidents/report?buildingId=${encodeURIComponent(buildingId)}`,
    {
      method: 'POST',
      body: JSON.stringify({ report }),
    }
  );

export const addIncidentRemote = (buildingId: string, incident: Incident) =>
  apiRequest(`/api/incidents?buildingId=${encodeURIComponent(buildingId)}`, {
    method: 'POST',
    body: JSON.stringify({ incident }),
  });

export const updateIncidentStatusRemote = (
  buildingId: string,
  incidentId: string,
  status: IncidentStatus,
  actualCost?: number,
  resolutionNotes?: string
) =>
  apiRequest(`/api/incidents/${encodeURIComponent(incidentId)}?buildingId=${encodeURIComponent(buildingId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ status, actualCost, resolutionNotes }),
  });

export const addIncidentQuoteRemote = (buildingId: string, incidentId: string, quote: VendorQuote) =>
  apiRequest(`/api/incidents/${encodeURIComponent(incidentId)}/quotes?buildingId=${encodeURIComponent(buildingId)}`, {
    method: 'POST',
    body: JSON.stringify({ quote }),
  });

export const selectIncidentQuoteRemote = (buildingId: string, incidentId: string, quoteId: string) =>
  apiRequest(
    `/api/incidents/${encodeURIComponent(incidentId)}/quotes/${encodeURIComponent(quoteId)}/select?buildingId=${encodeURIComponent(buildingId)}`,
    { method: 'PATCH' }
  );

export const addPreventiveRemote = (buildingId: string, task: PreventiveTask) =>
  apiRequest(`/api/preventive?buildingId=${encodeURIComponent(buildingId)}`, {
    method: 'POST',
    body: JSON.stringify({ task }),
  });

export const completePreventiveRemote = (
  buildingId: string,
  taskId: string,
  performedDate: string,
  performedBy: string,
  costDZD: number,
  notes: string
) =>
  apiRequest(`/api/preventive/${encodeURIComponent(taskId)}/complete?buildingId=${encodeURIComponent(buildingId)}`, {
    method: 'POST',
    body: JSON.stringify({ performedDate, performedBy, costDZD, notes }),
  });

export const addNoticeRemote = (buildingId: string, notice: Notice) =>
  apiRequest(`/api/notices?buildingId=${encodeURIComponent(buildingId)}`, {
    method: 'POST',
    body: JSON.stringify({ notice }),
  });

export const addVoteRemote = (buildingId: string, vote: AssemblyVote) =>
  apiRequest(`/api/votes?buildingId=${encodeURIComponent(buildingId)}`, {
    method: 'POST',
    body: JSON.stringify({ vote }),
  });

export const toggleVoteRemote = (buildingId: string, voteId: string) =>
  apiRequest(`/api/votes/${encodeURIComponent(voteId)}/toggle?buildingId=${encodeURIComponent(buildingId)}`, {
    method: 'PATCH',
  });

export const castVoteRemote = (buildingId: string, voteId: string, optionId: string, apartmentId: string) =>
  apiRequest(`/api/votes/${encodeURIComponent(voteId)}/cast?buildingId=${encodeURIComponent(buildingId)}`, {
    method: 'POST',
    body: JSON.stringify({ optionId, apartmentId }),
  });

export const addMinutesRemote = (buildingId: string, minutes: AssemblyMinutes) =>
  apiRequest(`/api/minutes?buildingId=${encodeURIComponent(buildingId)}`, {
    method: 'POST',
    body: JSON.stringify({ minutes }),
  });

export const updateHouseRulesRemote = (buildingId: string, houseRules: HouseRuleSection[]) =>
  apiRequest(`/api/rules?buildingId=${encodeURIComponent(buildingId)}`, {
    method: 'PUT',
    body: JSON.stringify({ houseRules }),
  });

export const addVendorRemote = (buildingId: string, vendor: Vendor) =>
  apiRequest(`/api/vendors?buildingId=${encodeURIComponent(buildingId)}`, {
    method: 'POST',
    body: JSON.stringify({ vendor }),
  });

export const fetchAuditLogsRemote = async (buildingId: string, limit = 150): Promise<AuditLogEntry[]> => {
  const res = await apiRequest<{ logs: AuditLogEntry[] }>(
    `/api/audit-logs?buildingId=${encodeURIComponent(buildingId)}&limit=${limit}`
  );
  return res.ok && res.data ? res.data.logs : [];
};

// Auth & RBAC Users
export async function loginBureau(username: string, password: string): Promise<{ ok: boolean; error?: string }> {
  const cleanUser = String(username || 'president').trim().toLowerCase();
  const res = await apiRequest<{ token?: string }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: cleanUser, password }),
  });
  if (!res.ok) {
    if (res.offline) {
      const acct = LOCAL_BUREAU_ACCOUNTS[cleanUser];
      const overrides = getLocalPasswords();
      const expectedPassword = acct ? overrides[cleanUser] || acct.defaultPassword : null;
      if (acct && password === expectedPassword) {
        try {
          localStorage.setItem(LOCAL_SESSION_KEY, cleanUser);
        } catch {
          // ignore
        }
        return { ok: true };
      }
      return { ok: false, error: 'Identifiant ou mot de passe incorrect.' };
    }
    return { ok: false, error: res.error };
  }
  try {
    localStorage.setItem(LOCAL_SESSION_KEY, cleanUser);
  } catch {
    // ignore
  }
  if (res.data?.token) localStorage.setItem(TOKEN_KEY, res.data.token);
  return { ok: true };
}

export async function logoutBureau(): Promise<void> {
  localStorage.removeItem(TOKEN_KEY);
  try {
    localStorage.setItem(LOCAL_SESSION_KEY, 'resident');
  } catch {
    // ignore
  }
  await apiRequest('/api/auth/logout', { method: 'POST' });
}

export async function changeBureauPassword(
  currentPassword: string,
  newPassword: string
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiRequest('/api/auth/password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  if (!res.ok && res.offline) {
    const sessionName = getLocalSessionName();
    const acct = LOCAL_BUREAU_ACCOUNTS[sessionName];
    if (!acct) {
      return { ok: false, error: 'Accès réservé aux membres du Bureau.' };
    }
    const overrides = getLocalPasswords();
    const expected = overrides[acct.username] || acct.defaultPassword;
    if (currentPassword !== expected) {
      return { ok: false, error: 'Mot de passe actuel incorrect.' };
    }
    if (!newPassword || newPassword.trim().length < 6) {
      return { ok: false, error: 'Le nouveau mot de passe doit contenir au moins 6 caractères.' };
    }
    try {
      localStorage.setItem(
        LOCAL_PASSWORDS_KEY,
        JSON.stringify({ ...overrides, [acct.username]: newPassword.trim() })
      );
    } catch {
      // ignore
    }
    return { ok: true };
  }
  return res;
}

export const fetchUsersRemote = async (): Promise<ManagedUser[]> => {
  const res = await apiRequest<{ users: ManagedUser[] }>('/api/users');
  return res.ok && res.data ? res.data.users : [];
};

export const createUserRemote = (
  buildingId: string,
  payload: { username: string; fullName: string; role: BureauRole; password: string }
) =>
  apiRequest<{ user: ManagedUser }>(`/api/users?buildingId=${encodeURIComponent(buildingId)}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const deleteUserRemote = (buildingId: string, userId: string) =>
  apiRequest(`/api/users/${encodeURIComponent(userId)}?buildingId=${encodeURIComponent(buildingId)}`, {
    method: 'DELETE',
  });
