export type ApartmentType = 'F3' | 'F4';
export type OccupancyStatus = 'owner' | 'tenant' | 'vacant';
export type PaymentStatus = 'paid' | 'late' | 'pending';
export type PaymentMethod = 'Espèces' | 'Virement CCP' | 'BaridiMob' | 'Chèque' | 'Autre';
export type UserRole = 'president' | 'treasurer' | 'technical' | 'resident';
export type BureauRole = Exclude<UserRole, 'resident'>;
export type TransactionFund = 'courant' | 'reserve';
export type PreventiveFrequency = 'hebdomadaire' | 'mensuel' | 'trimestriel' | 'semestriel' | 'annuel';

export interface AuthUser {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
}

export interface ManagedUser {
  id: string;
  username: string;
  fullName: string;
  role: BureauRole;
  createdAt: string;
}

export interface BuildingSummary {
  id: string;
  buildingNumber: string;
  residenceName: string;
  wilaya: string;
  ilot: string;
}

export interface AuditLogEntry {
  id: string;
  buildingId: string;
  timestamp: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  entityType: string;
  entityId?: string;
  summary: string;
  amountDZD?: number;
}

export type IncidentCategory = 
  | 'ascenseur' 
  | 'surpresseur_eau' 
  | 'electricite_eclairage' 
  | 'porte_interphone' 
  | 'plomberie_evacuation' 
  | 'nettoyage_ordures' 
  | 'securite_gardiennage'
  | 'autre';

export type IncidentPriority = 'urgente' | 'elevee' | 'normale';
export type IncidentStatus = 'signale' | 'en_cours' | 'resolu';

export type TransactionType = 'recette' | 'depense';
export type TransactionCategory = 
  | 'Cotisations Copropriétaires'
  | 'Report à Nouveau (Solde Antérieur)'
  | 'Dotation Fonds de Réserve'
  | 'Maintenance Ascenseurs'
  | 'Facture Électricité Sonelgaz'
  | 'Réparation Bâche à Eau / Surpresseur'
  | 'Agent de Ménage & Entretien'
  | 'Serrurerie & Interphone'
  | 'Achat Fournitures & Ampoules'
  | 'Gros Travaux & Équipements'
  | 'Frais Administratifs / Juridiques'
  | 'Autre';

export interface TenantInfo {
  name: string;
  phone: string;
  startDate?: string;
}

export interface Resident {
  id: string;
  name: string;
  phone: string;
  birthDate?: string; // ex: "16/05/1971"
  email?: string;
  aadlFolderNumber?: string; // ex: 10-042891
  isSyndicMember?: boolean;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  badgesCount?: number;
  keysNotes?: string;
}

export interface Apartment {
  id: string;
  number: string; // ex: "Appt 01", "Appt 14"
  floor: number; // 0 for RDC, 1 to 9
  type: ApartmentType; // F3 (~70m²) or F4 (~85m²)
  surfaceM2: number;
  occupancy: OccupancyStatus;
  resident: Resident;
  tenant?: TenantInfo;
  notes?: string;
  residentPin?: string; // 4-digit PIN (masked on public resident state)
}

export interface PaymentRecord {
  id: string;
  receiptNumber: string; // ex: "REC-2026-11-024"
  apartmentId: string;
  apartmentNumber: string;
  residentName: string;
  month: string; // YYYY or YYYY-MM, ex: "2026"
  amountDZD: number; // ex: 3000
  paymentDate: string; // ISO date string
  paymentMethod: PaymentMethod;
  notes?: string;
  collectedBy: string;
}

export interface VendorQuote {
  id: string;
  vendorName: string;
  amountDZD: number;
  date: string;
  notes?: string;
  selected?: boolean;
}

export interface IncidentMessage {
  id: string;
  senderRole: UserRole;
  senderName: string;
  apartmentNumber?: string;
  text: string;
  photoUrl?: string;
  timestamp: string;
  editedAt?: string;
}

export interface Incident {
  id: string;
  title: string;
  category: IncidentCategory;
  location: string; // ex: "Ascenseur N°1", "Sous-sol Bâche à eau", "Palier 5ème étage"
  floor?: number;
  priority: IncidentPriority;
  status: IncidentStatus;
  description: string;
  photoUrl?: string;
  reportedBy: string;
  reportedDate: string;
  assignedVendor?: string;
  estimatedCostDZD?: number;
  actualCostDZD?: number;
  resolvedDate?: string;
  resolutionNotes?: string;
  quotes?: VendorQuote[];
  messages?: IncidentMessage[];
}

export interface PreventiveTaskHistory {
  date: string;
  performedBy: string;
  costDZD?: number;
  notes?: string;
}

export interface PreventiveTask {
  id: string;
  title: string;
  equipment: IncidentCategory;
  frequency: PreventiveFrequency;
  lastDoneDate: string; // YYYY-MM-DD
  nextDueDate: string; // YYYY-MM-DD
  assignedVendor?: string;
  estimatedCostDZD?: number;
  notes?: string;
  history?: PreventiveTaskHistory[];
}

export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD
  type: TransactionType;
  category: TransactionCategory;
  amountDZD: number;
  description: string;
  referenceDoc?: string; // N° facture ou N° reçu
  paymentMethod: PaymentMethod;
  fund?: TransactionFund; // 'courant' (default) or 'reserve'
  attachmentName?: string;
  attachmentDataUrl?: string;
}

export interface BudgetAllocation {
  category: TransactionCategory;
  plannedAnnualDZD: number;
  fund: TransactionFund;
}

export interface Notice {
  id: string;
  title: string;
  type: 'info' | 'urgent' | 'coupure_eau' | 'assemblee' | 'travaux';
  date: string;
  author: string;
  message: string;
  isPinned: boolean;
  targetAudience: string; // "Tous les résidents", "Propriétaires", "Étage 1 à 4"
}

export interface AssemblyVote {
  id: string;
  title: string;
  description: string;
  dateCreated: string;
  endDate: string;
  status: 'active' | 'closed';
  options: {
    id: string;
    label: string;
    votes: number;
  }[];
  totalEligibleApartments: number;
  votedApartments: string[]; // apartment IDs
}

export interface AssemblyMinutes {
  id: string;
  title: string;
  type: 'ordinaire' | 'extraordinaire';
  date: string; // YYYY-MM-DD
  time: string;
  location: string;
  agenda: string[];
  decisions: string[];
  presentApartmentIds: string[];
  presidentName: string;
  secretaryName: string;
  notes?: string;
}

export interface HouseRuleSection {
  id: string;
  title: string;
  items: string[];
}

export interface Vendor {
  id: string;
  name: string;
  specialty: string;
  phone: string;
  secondaryPhone?: string;
  is24hEmergency: boolean;
  address?: string;
  notes?: string;
}

export interface SyndicCommittee {
  president: string;
  presidentPhone: string;
  treasurer: string;
  treasurerPhone?: string;
  technicalLead: string;
  technicalLeadPhone?: string;
}

export interface BuildingInfo {
  id?: string;
  residenceName: string; // ex: "Cité 2000 Logements AADL"
  ilot: string; // ex: "Ilot E"
  buildingNumber: string; // ex: "Bâtiment E 36"
  wilaya: string; // ex: "Bouira"
  postalCode: string; // ex: "10000"
  totalFloors: number; // ex: 9
  apartmentsPerFloor: number; // ex: 4
  hasElevator: boolean;
  elevatorCount: number;
  elevatorStatus: 'operational' | 'partial' | 'out_of_order';
  hasWaterBooster: boolean; // Bâche à eau & surpresseur
  waterBoosterStatus: 'operational' | 'alert' | 'maintenance';
  doorCode: string;
  standardMonthlyFeeDZD: number;
  feeFrequency?: 'annuel' | 'mensuel';
  syndicPresident: string;
  syndicPhone: string;
  syndicEmail: string;
  gestImmoAgency: string; // ex: "Direction GEST-IMMO Wilaya de Bouira"
  quoteThresholdDZD?: number; // Seuil exigeant 2 devis comparatifs
  reserveTargetDZD?: number; // Objectif fonds de réserve
  committee?: SyndicCommittee;
}

export interface PaymentDeclaration {
  id: string;
  apartmentId: string;
  apartmentNumber: string;
  residentName?: string;
  month: string;
  specialCallId?: string;
  specialCallTitle?: string;
  amountDZD: number;
  paymentMethod: PaymentMethod;
  reference?: string;
  proofDataUrl?: string;
  notes?: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
}

export interface SpecialCallContribution {
  id: string;
  receiptNumber: string;
  apartmentId: string;
  apartmentNumber: string;
  residentName: string;
  amountDZD: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  collectedBy: string;
  notes?: string;
}

export interface SpecialCall {
  id: string;
  title: string;
  description?: string;
  amountPerApartmentDZD: number;
  dueDate: string;
  fund: TransactionFund;
  status: 'active' | 'closed';
  createdAt: string;
  contributions: SpecialCallContribution[];
}

export interface AppData {
  building: BuildingInfo;
  apartments: Apartment[];
  payments: PaymentRecord[];
  incidents: Incident[];
  transactions: Transaction[];
  notices: Notice[];
  votes: AssemblyVote[];
  vendors: Vendor[];
  budgetPlan: BudgetAllocation[];
  preventiveTasks: PreventiveTask[];
  assemblyMinutes: AssemblyMinutes[];
  houseRules: HouseRuleSection[];
  paymentDeclarations?: PaymentDeclaration[];
  specialCalls?: SpecialCall[];
}
