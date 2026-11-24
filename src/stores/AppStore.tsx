import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  Apartment,
  AppData,
  AssemblyMinutes,
  AssemblyVote,
  AuthUser,
  BudgetAllocation,
  BuildingInfo,
  BuildingSummary,
  HouseRuleSection,
  Incident,
  IncidentStatus,
  Notice,
  PaymentRecord,
  PreventiveTask,
  Transaction,
  UserRole,
  Vendor,
  VendorQuote,
} from '../types';
import { createEmptyBuildingData, initialAppData } from '../data/mockData';
import { loadAppData, normalizeAppData, resetAppDataToDefaults, saveAppData } from '../utils/storage';
import { computeNextDueDate } from '../utils/helpers';
import { isBureauRole } from '../utils/permissions';
import {
  addIncidentQuoteRemote,
  addIncidentRemote,
  addMinutesRemote,
  addNoticeRemote,
  addPreventiveRemote,
  addTransactionRemote,
  addVendorRemote,
  addVoteRemote,
  appendLocalAuditLog,
  castVoteRemote,
  completePreventiveRemote,
  createBuildingRemote,
  deleteTransactionRemote,
  fetchRemoteState,
  fetchServerStatus,
  logoutBureau,
  recordPaymentRemote,
  replaceRemoteState,
  reportResidentIncidentRemote,
  ResidentIncidentReportPayload,
  seedRemoteStateIfEmpty,
  selectIncidentQuoteRemote,
  toggleVoteRemote,
  updateApartmentRemote,
  updateBudgetRemote,
  updateBuildingRemote,
  updateHouseRulesRemote,
  updateIncidentStatusRemote,
  uploadAttachmentRemote,
} from '../services/api';
import { useToast } from '../components/ui/ToastProvider';

const LOCAL_BUILDINGS_KEY = 'gest_aadl_multi_buildings_v3';

interface AppStoreValue {
  data: AppData;
  buildings: BuildingSummary[];
  activeBuildingId: string;
  role: UserRole;
  user: AuthUser;
  isBureau: boolean;
  serverConnected: boolean;
  isDefaultPassword: boolean;
  loading: boolean;
  switchBuilding: (buildingId: string) => Promise<void>;
  createNewBuilding: (params: {
    residenceName: string;
    ilot: string;
    buildingNumber: string;
    wilaya: string;
    totalFloors: number;
    apartmentsPerFloor: number;
    standardFeeDZD: number;
  }) => Promise<boolean>;
  refreshFromServer: (buildingIdOverride?: string) => Promise<void>;
  switchToResident: () => Promise<void>;
  savePayment: (payment: PaymentRecord) => Promise<void>;
  addIncident: (incident: Incident) => Promise<void>;
  reportResidentIncident: (payload: ResidentIncidentReportPayload) => Promise<boolean>;
  updateIncidentStatus: (
    incidentId: string,
    newStatus: IncidentStatus,
    actualCost?: number,
    resolutionNotes?: string
  ) => Promise<void>;
  addIncidentQuote: (incidentId: string, quote: VendorQuote) => Promise<void>;
  selectIncidentQuote: (incidentId: string, quoteId: string) => Promise<void>;
  addPreventiveTask: (task: PreventiveTask) => Promise<void>;
  completePreventiveTask: (
    taskId: string,
    performedDate: string,
    performedBy: string,
    costDZD: number,
    notes: string
  ) => Promise<void>;
  addTransaction: (tx: Transaction) => Promise<void>;
  deleteTransaction: (txId: string) => Promise<void>;
  updateBudgetPlan: (plan: BudgetAllocation[]) => Promise<void>;
  uploadAttachment: (filename: string, dataUrl: string) => Promise<{ url: string; name: string }>;
  addNotice: (notice: Notice) => Promise<void>;
  addVote: (vote: AssemblyVote) => Promise<void>;
  toggleVoteStatus: (voteId: string) => Promise<void>;
  castVote: (voteId: string, optionId: string, apartmentId: string) => Promise<void>;
  addAssemblyMinutes: (minutes: AssemblyMinutes) => Promise<void>;
  updateHouseRules: (rules: HouseRuleSection[]) => Promise<void>;
  addVendor: (vendor: Vendor) => Promise<void>;
  updateApartment: (apt: Apartment) => Promise<void>;
  updateBuilding: (building: BuildingInfo) => Promise<void>;
  resetFinancials: () => Promise<void>;
  resetData: () => Promise<void>;
  importData: (imported: AppData) => Promise<void>;
}

const AppStoreContext = createContext<AppStoreValue | null>(null);

function loadLocalBuildingsMap(): Record<string, AppData> {
  try {
    const raw = localStorage.getItem(LOCAL_BUILDINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  const primary = loadAppData();
  const id = primary.building.id || 'bldg-e36';
  return { [id]: primary };
}

function saveLocalBuildingsMap(map: Record<string, AppData>, activeId: string) {
  try {
    localStorage.setItem(LOCAL_BUILDINGS_KEY, JSON.stringify(map));
    if (map[activeId]) {
      saveAppData(map[activeId]);
    }
  } catch {
    // ignore
  }
}

export const AppStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const toast = useToast();
  const [data, setData] = useState<AppData>(() => loadAppData());
  const [activeBuildingId, setActiveBuildingId] = useState<string>(() => data.building.id || 'bldg-e36');
  const [buildings, setBuildings] = useState<BuildingSummary[]>(() => {
    const map = loadLocalBuildingsMap();
    return Object.entries(map).map(([id, b]) => ({
      id,
      buildingNumber: b.building.buildingNumber,
      residenceName: b.building.residenceName,
      wilaya: b.building.wilaya,
      ilot: b.building.ilot,
    }));
  });
  const [role, setRole] = useState<UserRole>('president');
  const [user, setUser] = useState<AuthUser>({
    id: 'usr-local',
    username: 'president',
    fullName: initialAppData.building.syndicPresident,
    role: 'president',
  });
  const [serverConnected, setServerConnected] = useState<boolean>(false);
  const [isDefaultPassword, setIsDefaultPassword] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  const isBureau = isBureauRole(role);

  const persistLocal = useCallback((nextData: AppData, bId: string) => {
    setData(nextData);
    const map = loadLocalBuildingsMap();
    map[bId] = nextData;
    saveLocalBuildingsMap(map, bId);
    setBuildings(
      Object.entries(map).map(([id, item]) => ({
        id,
        buildingNumber: item.building.buildingNumber,
        residenceName: item.building.residenceName,
        wilaya: item.building.wilaya,
        ilot: item.building.ilot,
      }))
    );
  }, []);

  const logLocal = useCallback(
    (
      action: string,
      entityType: string,
      summary: string,
      amountDZD?: number,
      actorOverride?: { fullName: string; role: UserRole }
    ) => {
      if (serverConnected) return;
      appendLocalAuditLog(
        activeBuildingId,
        actorOverride || { fullName: user.fullName, role },
        action,
        entityType,
        summary,
        amountDZD
      );
    },
    [serverConnected, activeBuildingId, user.fullName, role]
  );

  const refreshFromServer = useCallback(
    async (buildingIdOverride?: string) => {
      const status = await fetchServerStatus();
      setServerConnected(status.connected);
      setRole(status.role);
      setUser(status.user);
      setIsDefaultPassword(status.isDefaultPassword);

      if (!status.connected) {
        setLoading(false);
        return;
      }

      const targetId = buildingIdOverride || activeBuildingId;
      let remote = await fetchRemoteState(targetId);

      if (!remote) {
        const local = loadAppData();
        await seedRemoteStateIfEmpty(local);
        remote = await fetchRemoteState(targetId);
      }

      if (remote) {
        persistLocal(remote.data, remote.buildingId);
        setActiveBuildingId(remote.buildingId);
        setBuildings(remote.buildings);
      }
      setLoading(false);
    },
    [activeBuildingId, persistLocal]
  );

  useEffect(() => {
    refreshFromServer();
  }, []);

  const switchBuilding = useCallback(
    async (buildingId: string) => {
      setActiveBuildingId(buildingId);
      if (serverConnected) {
        await refreshFromServer(buildingId);
      } else {
        const map = loadLocalBuildingsMap();
        if (map[buildingId]) {
          setData(normalizeAppData(map[buildingId]));
        }
      }
    },
    [serverConnected, refreshFromServer]
  );

  const createNewBuilding = useCallback(
    async (params: {
      residenceName: string;
      ilot: string;
      buildingNumber: string;
      wilaya: string;
      totalFloors: number;
      apartmentsPerFloor: number;
      standardFeeDZD: number;
    }): Promise<boolean> => {
      const id = `bldg-${Date.now()}`;
      const newBuildingData = createEmptyBuildingData({
        id,
        ...params,
        syndicPresident: data.building.syndicPresident,
        syndicPhone: data.building.syndicPhone,
      });

      if (serverConnected) {
        const res = await createBuildingRemote(newBuildingData);
        if (!res.ok) {
          toast.error(res.error || 'Erreur création bâtiment');
          return false;
        }
        await refreshFromServer(res.data?.id || id);
      } else {
        persistLocal(newBuildingData, id);
        setActiveBuildingId(id);
      }
      toast.success(`${params.buildingNumber} créé !`);
      return true;
    },
    [data.building, serverConnected, refreshFromServer, persistLocal, toast]
  );

  const switchToResident = useCallback(async () => {
    await logoutBureau();
    if (serverConnected) {
      await refreshFromServer(activeBuildingId);
    } else {
      setRole('resident');
      setUser({ id: 'resident', username: 'resident', fullName: 'Résident', role: 'resident' });
      setIsDefaultPassword(false);
    }
  }, [serverConnected, refreshFromServer, activeBuildingId]);

  const savePayment = useCallback(
    async (payment: PaymentRecord) => {
      const tx: Transaction = {
        id: `tx-rec-${payment.id}`,
        date: payment.paymentDate.slice(0, 10),
        type: 'recette',
        fund: 'courant',
        category: 'Cotisations Copropriétaires',
        amountDZD: payment.amountDZD,
        description: `Cotisation ${payment.month} - ${payment.apartmentNumber} (${payment.residentName})`,
        referenceDoc: payment.receiptNumber,
        paymentMethod: payment.paymentMethod,
      };
      const next: AppData = {
        ...data,
        payments: [payment, ...data.payments],
        transactions: [tx, ...data.transactions],
      };
      if (serverConnected) {
        const res = await recordPaymentRemote(activeBuildingId, payment);
        if (!res.ok) {
          toast.error(res.error || 'Erreur lors de l’encaissement');
          return;
        }
      }
      persistLocal(next, activeBuildingId);
      logLocal(
        'RECORD_PAYMENT',
        'payment',
        `Encaissement ${payment.receiptNumber} — ${payment.apartmentNumber} (${payment.month})`,
        payment.amountDZD
      );
      toast.success(`${payment.receiptNumber} enregistré`);
    },
    [data, serverConnected, activeBuildingId, persistLocal, logLocal, toast]
  );

  const addIncident = useCallback(
    async (incident: Incident) => {
      if (serverConnected) {
        const res = await addIncidentRemote(activeBuildingId, incident);
        if (!res.ok) {
          toast.error(res.error || 'Erreur');
          return;
        }
      }
      persistLocal({ ...data, incidents: [incident, ...data.incidents] }, activeBuildingId);
      logLocal('REPORT_INCIDENT', 'incident', `Signalement panne : ${incident.title} (${incident.location})`);
      toast.success(incident.title);
    },
    [data, serverConnected, activeBuildingId, persistLocal, logLocal, toast]
  );

  const reportResidentIncident = useCallback(
    async (payload: ResidentIncidentReportPayload): Promise<boolean> => {
      if (serverConnected) {
        const res = await reportResidentIncidentRemote(activeBuildingId, payload);
        if (!res.ok || !res.data?.incident) {
          toast.error(res.error || 'Impossible d’envoyer le signalement');
          return false;
        }
        persistLocal({ ...data, incidents: [res.data.incident, ...data.incidents] }, activeBuildingId);
        toast.success(res.data.incident.title);
        return true;
      }

      const localInc: Incident = {
        id: `inc-res-${Date.now()}`,
        title: payload.title.trim(),
        category: payload.category,
        location: payload.location.trim(),
        floor: Number(payload.floor) || 0,
        priority: payload.priority,
        status: 'signale',
        description: payload.description.trim(),
        reportedBy: payload.reportedBy.trim() || 'Résident du bâtiment',
        reportedDate: new Date().toISOString(),
        estimatedCostDZD: 0,
        quotes: [],
      };
      persistLocal({ ...data, incidents: [localInc, ...data.incidents] }, activeBuildingId);
      logLocal(
        'REPORT_INCIDENT',
        'incident',
        `Signalement panne : ${localInc.title} (${localInc.location})`,
        undefined,
        { fullName: localInc.reportedBy, role: 'resident' }
      );
      toast.success(localInc.title);
      return true;
    },
    [data, serverConnected, activeBuildingId, persistLocal, logLocal, toast]
  );

  const updateIncidentStatus = useCallback(
    async (incidentId: string, newStatus: IncidentStatus, actualCost?: number, resolutionNotes?: string) => {
      if (serverConnected) {
        const res = await updateIncidentStatusRemote(activeBuildingId, incidentId, newStatus, actualCost, resolutionNotes);
        if (!res.ok) {
          toast.error(res.error || 'Erreur');
          return;
        }
      }
      const targetInc = data.incidents.find((i) => i.id === incidentId);
      const updatedIncidents = data.incidents.map((inc) =>
        inc.id === incidentId
          ? {
              ...inc,
              status: newStatus,
              actualCostDZD: actualCost !== undefined ? actualCost : inc.actualCostDZD,
              resolvedDate: newStatus === 'resolu' ? new Date().toISOString() : inc.resolvedDate,
              resolutionNotes: resolutionNotes || inc.resolutionNotes,
            }
          : inc
      );

      let updatedTransactions = [...data.transactions];
      if (newStatus === 'resolu' && actualCost && actualCost > 0) {
        const inc = targetInc;
        const newTx: Transaction = {
          id: `tx-inc-${incidentId}-${Date.now()}`,
          date: new Date().toISOString().slice(0, 10),
          type: 'depense',
          fund: 'courant',
          category:
            inc?.category === 'ascenseur'
              ? 'Maintenance Ascenseurs'
              : inc?.category === 'surpresseur_eau'
              ? 'Réparation Bâche à Eau / Surpresseur'
              : 'Achat Fournitures & Ampoules',
          amountDZD: actualCost,
          description: `Réparation clôturée : ${inc?.title || 'Maintenance'}`,
          paymentMethod: 'Espèces',
        };
        updatedTransactions = [newTx, ...updatedTransactions];
      }

      persistLocal({ ...data, incidents: updatedIncidents, transactions: updatedTransactions }, activeBuildingId);
      logLocal(
        newStatus === 'resolu' ? 'RESOLVE_INCIDENT' : 'UPDATE_INCIDENT',
        'incident',
        `Incident "${targetInc?.title || incidentId}" -> ${newStatus}`,
        actualCost
      );
      toast.success(newStatus === 'resolu' ? 'Incident clôturé' : 'Statut mis à jour');
    },
    [data, serverConnected, activeBuildingId, persistLocal, logLocal, toast]
  );

  const addIncidentQuote = useCallback(
    async (incidentId: string, quote: VendorQuote) => {
      if (serverConnected) {
        const res = await addIncidentQuoteRemote(activeBuildingId, incidentId, quote);
        if (!res.ok) {
          toast.error(res.error || 'Erreur');
          return;
        }
      }
      persistLocal(
        {
          ...data,
          incidents: data.incidents.map((inc) =>
            inc.id === incidentId ? { ...inc, quotes: [...(inc.quotes || []), quote] } : inc
          ),
        },
        activeBuildingId
      );
      toast.success(`Devis ${quote.vendorName} ajouté`);
    },
    [data, serverConnected, activeBuildingId, persistLocal, toast]
  );

  const selectIncidentQuote = useCallback(
    async (incidentId: string, quoteId: string) => {
      if (serverConnected) {
        const res = await selectIncidentQuoteRemote(activeBuildingId, incidentId, quoteId);
        if (!res.ok) {
          toast.error(res.error || 'Erreur');
          return;
        }
      }
      persistLocal(
        {
          ...data,
          incidents: data.incidents.map((inc) => {
            if (inc.id !== incidentId) return inc;
            const quotes = (inc.quotes || []).map((q) => ({ ...q, selected: q.id === quoteId }));
            const picked = quotes.find((q) => q.id === quoteId);
            return {
              ...inc,
              quotes,
              assignedVendor: picked ? picked.vendorName : inc.assignedVendor,
              estimatedCostDZD: picked ? picked.amountDZD : inc.estimatedCostDZD,
            };
          }),
        },
        activeBuildingId
      );
      toast.success('Devis retenu');
    },
    [data, serverConnected, activeBuildingId, persistLocal, toast]
  );

  const addPreventiveTask = useCallback(
    async (task: PreventiveTask) => {
      if (serverConnected) {
        const res = await addPreventiveRemote(activeBuildingId, task);
        if (!res.ok) {
          toast.error(res.error || 'Erreur');
          return;
        }
      }
      persistLocal({ ...data, preventiveTasks: [task, ...(data.preventiveTasks || [])] }, activeBuildingId);
      toast.success(task.title);
    },
    [data, serverConnected, activeBuildingId, persistLocal, toast]
  );

  const completePreventiveTask = useCallback(
    async (taskId: string, performedDate: string, performedBy: string, costDZD: number, notes: string) => {
      if (serverConnected) {
        const res = await completePreventiveRemote(activeBuildingId, taskId, performedDate, performedBy, costDZD, notes);
        if (!res.ok) {
          toast.error(res.error || 'Erreur');
          return;
        }
      }
      const target = (data.preventiveTasks || []).find((t) => t.id === taskId);
      const updatedTasks = (data.preventiveTasks || []).map((task) =>
        task.id === taskId
          ? {
              ...task,
              lastDoneDate: performedDate,
              nextDueDate: computeNextDueDate(performedDate, task.frequency),
              history: [{ date: performedDate, performedBy, costDZD, notes }, ...(task.history || [])],
            }
          : task
      );

      let updatedTransactions = [...data.transactions];
      if (costDZD > 0 && target) {
        const tx: Transaction = {
          id: `tx-prev-${taskId}-${Date.now()}`,
          date: performedDate,
          type: 'depense',
          fund: 'courant',
          category:
            target.equipment === 'ascenseur'
              ? 'Maintenance Ascenseurs'
              : target.equipment === 'surpresseur_eau'
              ? 'Réparation Bâche à Eau / Surpresseur'
              : target.equipment === 'porte_interphone'
              ? 'Serrurerie & Interphone'
              : 'Achat Fournitures & Ampoules',
          amountDZD: costDZD,
          description: `Entretien préventif : ${target.title} (${performedBy})`,
          paymentMethod: 'Espèces',
        };
        updatedTransactions = [tx, ...updatedTransactions];
      }

      persistLocal({ ...data, preventiveTasks: updatedTasks, transactions: updatedTransactions }, activeBuildingId);
      toast.success('Entretien préventif validé');
    },
    [data, serverConnected, activeBuildingId, persistLocal, toast]
  );

  const addTransaction = useCallback(
    async (tx: Transaction) => {
      if (serverConnected) {
        const res = await addTransactionRemote(activeBuildingId, tx);
        if (!res.ok) {
          toast.error(res.error || 'Erreur');
          return;
        }
      }
      persistLocal({ ...data, transactions: [tx, ...data.transactions] }, activeBuildingId);
      logLocal(
        tx.type === 'recette' ? 'ADD_INCOME' : 'ADD_EXPENSE',
        'transaction',
        `${tx.category} : ${tx.description}`,
        tx.amountDZD
      );
      toast.success(tx.description);
    },
    [data, serverConnected, activeBuildingId, persistLocal, logLocal, toast]
  );

  const deleteTransaction = useCallback(
    async (txId: string) => {
      if (serverConnected) {
        const res = await deleteTransactionRemote(activeBuildingId, txId);
        if (!res.ok) {
          toast.error(res.error || 'Erreur');
          return;
        }
      }
      const deletedTx = data.transactions.find((t) => t.id === txId);
      persistLocal({ ...data, transactions: data.transactions.filter((t) => t.id !== txId) }, activeBuildingId);
      logLocal(
        'DELETE_TRANSACTION',
        'transaction',
        `Suppression écriture : ${deletedTx?.description || txId}`,
        deletedTx?.amountDZD
      );
      toast.info('Écriture supprimée');
    },
    [data, serverConnected, activeBuildingId, persistLocal, logLocal, toast]
  );

  const updateBudgetPlan = useCallback(
    async (budgetPlan: BudgetAllocation[]) => {
      if (serverConnected) {
        const res = await updateBudgetRemote(activeBuildingId, budgetPlan);
        if (!res.ok) {
          toast.error(res.error || 'Erreur');
          return;
        }
      }
      persistLocal({ ...data, budgetPlan }, activeBuildingId);
      logLocal('UPDATE_BUDGET', 'budget', 'Mise à jour du budget prévisionnel annuel');
      toast.success('Budget mis à jour');
    },
    [data, serverConnected, activeBuildingId, persistLocal, logLocal, toast]
  );

  const uploadAttachment = useCallback(
    async (filename: string, dataUrl: string): Promise<{ url: string; name: string }> => {
      if (serverConnected) {
        const res = await uploadAttachmentRemote(filename, dataUrl);
        if (res.ok && res.data?.url) {
          return { url: res.data.url, name: res.data.name || filename };
        }
      }
      return { url: dataUrl, name: filename };
    },
    [serverConnected]
  );

  const addNotice = useCallback(
    async (notice: Notice) => {
      if (serverConnected) {
        const res = await addNoticeRemote(activeBuildingId, notice);
        if (!res.ok) {
          toast.error(res.error || 'Erreur');
          return;
        }
      }
      persistLocal({ ...data, notices: [notice, ...data.notices] }, activeBuildingId);
      toast.success(notice.title);
    },
    [data, serverConnected, activeBuildingId, persistLocal, toast]
  );

  const addVote = useCallback(
    async (vote: AssemblyVote) => {
      if (serverConnected) {
        const res = await addVoteRemote(activeBuildingId, vote);
        if (!res.ok) {
          toast.error(res.error || 'Erreur');
          return;
        }
      }
      persistLocal({ ...data, votes: [vote, ...data.votes] }, activeBuildingId);
      toast.success(vote.title);
    },
    [data, serverConnected, activeBuildingId, persistLocal, toast]
  );

  const toggleVoteStatus = useCallback(
    async (voteId: string) => {
      if (serverConnected) {
        const res = await toggleVoteRemote(activeBuildingId, voteId);
        if (!res.ok) {
          toast.error(res.error || 'Erreur');
          return;
        }
      }
      persistLocal(
        {
          ...data,
          votes: data.votes.map((v) =>
            v.id === voteId ? { ...v, status: v.status === 'active' ? ('closed' as const) : ('active' as const) } : v
          ),
        },
        activeBuildingId
      );
    },
    [data, serverConnected, activeBuildingId, persistLocal, toast]
  );

  const castVote = useCallback(
    async (voteId: string, optionId: string, apartmentId: string) => {
      const targetVote = data.votes.find((v) => v.id === voteId);
      if (targetVote?.votedApartments.includes(apartmentId)) {
        toast.error('Ce logement a déjà exprimé son vote pour cette consultation.');
        return;
      }
      if (serverConnected) {
        const res = await castVoteRemote(activeBuildingId, voteId, optionId, apartmentId);
        if (!res.ok) {
          toast.error(res.error || 'Erreur');
          return;
        }
      }
      persistLocal(
        {
          ...data,
          votes: data.votes.map((v) =>
            v.id === voteId
              ? {
                  ...v,
                  votedApartments: [...v.votedApartments, apartmentId],
                  options: v.options.map((opt) => (opt.id === optionId ? { ...opt, votes: opt.votes + 1 } : opt)),
                }
              : v
          ),
        },
        activeBuildingId
      );
      toast.success('Vote enregistré');
    },
    [data, serverConnected, activeBuildingId, persistLocal, toast]
  );

  const addAssemblyMinutes = useCallback(
    async (minutes: AssemblyMinutes) => {
      if (serverConnected) {
        const res = await addMinutesRemote(activeBuildingId, minutes);
        if (!res.ok) {
          toast.error(res.error || 'Erreur');
          return;
        }
      }
      persistLocal({ ...data, assemblyMinutes: [minutes, ...(data.assemblyMinutes || [])] }, activeBuildingId);
      toast.success(minutes.title);
    },
    [data, serverConnected, activeBuildingId, persistLocal, toast]
  );

  const updateHouseRules = useCallback(
    async (houseRules: HouseRuleSection[]) => {
      if (serverConnected) {
        const res = await updateHouseRulesRemote(activeBuildingId, houseRules);
        if (!res.ok) {
          toast.error(res.error || 'Erreur');
          return;
        }
      }
      persistLocal({ ...data, houseRules }, activeBuildingId);
      toast.success('Règlement mis à jour');
    },
    [data, serverConnected, activeBuildingId, persistLocal, toast]
  );

  const addVendor = useCallback(
    async (vendor: Vendor) => {
      if (serverConnected) {
        const res = await addVendorRemote(activeBuildingId, vendor);
        if (!res.ok) {
          toast.error(res.error || 'Erreur');
          return;
        }
      }
      persistLocal({ ...data, vendors: [...data.vendors, vendor] }, activeBuildingId);
      toast.success(vendor.name);
    },
    [data, serverConnected, activeBuildingId, persistLocal, toast]
  );

  const updateApartment = useCallback(
    async (apt: Apartment) => {
      if (serverConnected) {
        const res = await updateApartmentRemote(activeBuildingId, apt);
        if (!res.ok) {
          toast.error(res.error || 'Erreur');
          return;
        }
      }
      persistLocal(
        { ...data, apartments: data.apartments.map((a) => (a.id === apt.id ? apt : a)) },
        activeBuildingId
      );
      logLocal('UPDATE_APARTMENT', 'apartment', `Fiche ${apt.number} (${apt.resident.name}) modifiée`);
      toast.success(`${apt.number} mis à jour`);
    },
    [data, serverConnected, activeBuildingId, persistLocal, logLocal, toast]
  );

  const updateBuilding = useCallback(
    async (building: BuildingInfo) => {
      const nextBuilding = { ...building, id: activeBuildingId };
      if (serverConnected) {
        const res = await updateBuildingRemote(activeBuildingId, nextBuilding);
        if (!res.ok) {
          toast.error(res.error || 'Erreur');
          return;
        }
      }
      persistLocal({ ...data, building: nextBuilding }, activeBuildingId);
      logLocal('UPDATE_BUILDING', 'building', `Mise à jour paramètres ${nextBuilding.buildingNumber}`);
      toast.success('Paramètres enregistrés');
    },
    [data, serverConnected, activeBuildingId, persistLocal, logLocal, toast]
  );

  const resetFinancials = useCallback(async () => {
    const zeroed: AppData = {
      ...data,
      payments: [],
      transactions: [],
      budgetPlan: (data.budgetPlan || []).map((b) => ({ ...b, plannedAnnualDZD: 0 })),
      incidents: data.incidents.map(({ actualCostDZD: _ignored, ...rest }) => rest),
      preventiveTasks: (data.preventiveTasks || []).map((t) => ({ ...t, history: [] })),
    };
    if (serverConnected) {
      const res = await replaceRemoteState(activeBuildingId, zeroed);
      if (!res.ok) {
        toast.error(res.error || 'Erreur');
        return;
      }
    }
    persistLocal(zeroed, activeBuildingId);
    logLocal('RESET_FINANCIALS', 'building', 'Remise à zéro comptable (0 DZD)');
    toast.success('Recettes, dépenses et exercices remis à 0 DZD');
  }, [data, serverConnected, activeBuildingId, persistLocal, logLocal, toast]);

  const resetData = useCallback(async () => {
    const reset = resetAppDataToDefaults();
    if (serverConnected) {
      const res = await replaceRemoteState(activeBuildingId, reset);
      if (!res.ok) {
        toast.error(res.error || 'Erreur');
        return;
      }
    }
    persistLocal(reset, activeBuildingId);
    toast.info('Données réinitialisées');
  }, [serverConnected, activeBuildingId, persistLocal, toast]);

  const importData = useCallback(
    async (imported: AppData) => {
      const normalized = normalizeAppData(imported);
      if (serverConnected) {
        const res = await replaceRemoteState(activeBuildingId, normalized);
        if (!res.ok) {
          toast.error(res.error || 'Erreur');
          return;
        }
      }
      persistLocal(normalized, activeBuildingId);
      toast.success('Sauvegarde restaurée');
    },
    [serverConnected, activeBuildingId, persistLocal, toast]
  );

  return (
    <AppStoreContext.Provider
      value={{
        data,
        buildings,
        activeBuildingId,
        role,
        user,
        isBureau,
        serverConnected,
        isDefaultPassword,
        loading,
        switchBuilding,
        createNewBuilding,
        refreshFromServer,
        switchToResident,
        savePayment,
        addIncident,
        reportResidentIncident,
        updateIncidentStatus,
        addIncidentQuote,
        selectIncidentQuote,
        addPreventiveTask,
        completePreventiveTask,
        addTransaction,
        deleteTransaction,
        updateBudgetPlan,
        uploadAttachment,
        addNotice,
        addVote,
        toggleVoteStatus,
        castVote,
        addAssemblyMinutes,
        updateHouseRules,
        addVendor,
        updateApartment,
        updateBuilding,
        resetFinancials,
        resetData,
        importData,
      }}
    >
      {children}
    </AppStoreContext.Provider>
  );
};

export function useAppStore(): AppStoreValue {
  const ctx = useContext(AppStoreContext);
  if (!ctx) throw new Error('useAppStore must be used inside AppStoreProvider');
  return ctx;
}
