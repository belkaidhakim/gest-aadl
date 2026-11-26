import { AppData, Apartment, PaymentRecord, Transaction } from '../types';

interface ResidentSeedRow {
  num: string;
  floor: number;
  name: string;
  birth: string;
  phone: string;
  folder: string;
  paidDZD: number;
  isSyndic?: boolean;
  notes?: string;
}

const SPECIFIC_RESIDENTS: ResidentSeedRow[] = [
  { num: 'Appt 01', floor: 0, name: 'GHARBI MADJID', birth: '16/05/1971', phone: '-', folder: '10-019801', paidDZD: 3000 },
  { num: 'Appt 02', floor: 1, name: 'KHADRAOUI CHAHRAZED', birth: '25/08/1977', phone: '-', folder: '10-025814', paidDZD: 0 },
  { num: 'Appt 03', floor: 1, name: 'RABCHI SAID', birth: '01/10/1977', phone: '0558 25 71 76', folder: '10-041289', paidDZD: 5000 },
  { num: 'Appt 04', floor: 1, name: 'OUCHEM SLIMANE', birth: '30/12/1968', phone: '-', folder: '10-009124', paidDZD: 5000 },
  { num: 'Appt 05', floor: 1, name: 'SEMMAR KAMEL', birth: '15/09/1968', phone: '0559 76 48 07', folder: '10-055102', paidDZD: 5000 },
  { num: 'Appt 06', floor: 2, name: 'DAOUD LYNDA', birth: '26/08/1980', phone: '-', folder: '10-033871', paidDZD: 5000 },
  { num: 'Appt 07', floor: 2, name: 'AOUES HADHIR', birth: '03/03/1971', phone: '-', folder: '10-048220', paidDZD: 5000 },
  { num: 'Appt 08', floor: 2, name: 'AKSAS ALI', birth: '-', phone: '0655 56 26 56', folder: '10-019821', paidDZD: 2000 },
  { num: 'Appt 09', floor: 2, name: 'ALLALOU HACENE', birth: '19/08/1971', phone: '0560 99 40 37', folder: '10-061294', paidDZD: 0 },
  { num: 'Appt 10', floor: 3, name: 'GHARBI SAMIR', birth: '-', phone: '-', folder: '10-074128', paidDZD: 5000 },
  { num: 'Appt 11', floor: 3, name: 'HAMOUDI NOURDINE', birth: '15/10/1983', phone: '0782 33 77 84', folder: '10-022941', paidDZD: 5000, isSyndic: true, notes: 'Trésorier du Syndic' },
  { num: 'Appt 12', floor: 3, name: 'GHADBANE ABDELHAFID', birth: '-', phone: '0661 49 61 91', folder: '10-039104', paidDZD: 5000 },
  { num: 'Appt 13', floor: 3, name: 'BELKACEMI OMAR', birth: '07/02/1972', phone: '0554 13 60 42', folder: '10-081290', paidDZD: 5000, isSyndic: true, notes: 'Responsable Technique du Syndic' },
  { num: 'Appt 14', floor: 4, name: 'BELARABI AKRAM', birth: '19/06/1987', phone: '0661 12 19 87', folder: '10-019482', paidDZD: 5000 },
  { num: 'Appt 15', floor: 4, name: 'MELLIKECHE FERHAT', birth: '19/09/1987', phone: '0661 60 19 87', folder: '10-050182', paidDZD: 5000, isSyndic: true, notes: 'Responsable du Bâtiment / Président du Syndic' },
  { num: 'Appt 16', floor: 4, name: 'MADJBER MOHAMED', birth: '18/10/1975', phone: '-', folder: '10-062839', paidDZD: 5000 },
  { num: 'Appt 17', floor: 4, name: 'RECHAM OUARDIA', birth: '03/09/1975', phone: '-', folder: '10-031029', paidDZD: 5000 },
  { num: 'Appt 18', floor: 5, name: 'TOUBAL MAAMER YACINE', birth: '19/08/1973', phone: '0557 04 12 83', folder: '10-044810', paidDZD: 0 },
  { num: 'Appt 19', floor: 5, name: 'NADIA MAZIDI', birth: '15/12/1973', phone: '-', folder: '10-071923', paidDZD: 5000 },
  { num: 'Appt 20', floor: 5, name: 'SLIMANI RACHID', birth: '19/06/1976', phone: '0549 58 03 18', folder: '10-028491', paidDZD: 5000 },
  { num: 'Appt 21', floor: 5, name: 'AHRES BRAHIM', birth: '-', phone: '0540 85 47 37', folder: '10-089124', paidDZD: 5000 },
  { num: 'Appt 22', floor: 6, name: 'NEHAL IDIR', birth: '-', phone: '0661 13 44 31', folder: '10-015829', paidDZD: 5000 },
  { num: 'Appt 23', floor: 6, name: 'KHIRI FATIMA ZOHRA', birth: '-', phone: '0655 03 90 03', folder: '10-053910', paidDZD: 5000 },
  { num: 'Appt 24', floor: 6, name: 'FERRADJI KACI', birth: '-', phone: '0662 28 45 69', folder: '10-042890', paidDZD: 5000 },
  { num: 'Appt 25', floor: 6, name: 'BEKHTI EL HADJ', birth: '-', phone: '-', folder: '10-067812', paidDZD: 4000 },
  { num: 'Appt 26', floor: 7, name: 'MSAID MALIKA', birth: '-', phone: '0549 50 98 36', folder: '10-038104', paidDZD: 5000 },
  { num: 'Appt 27', floor: 7, name: 'HANNACHE ABDELHAMID YACINE', birth: '-', phone: '0655 19 82 49', folder: '10-079234', paidDZD: 5000 },
  { num: 'Appt 28', floor: 7, name: 'MAAREF ABDELKADER', birth: '-', phone: '0541 38 42 76', folder: '10-020941', paidDZD: 5000 },
  { num: 'Appt 29', floor: 7, name: 'TAOUARI YAZID', birth: '-', phone: '0670 32 32 22', folder: '10-058204', paidDZD: 5000 },
  { num: 'Appt 30', floor: 8, name: 'SIAD SAID', birth: '-', phone: '0657 56 07 88', folder: '10-049102', paidDZD: 5000 },
  { num: 'Appt 31', floor: 8, name: 'LAOUADI BOUZID', birth: '-', phone: '0795 24 83 56', folder: '10-083419', paidDZD: 5000 },
  { num: 'Appt 32', floor: 8, name: 'KARI FOUAD', birth: '-', phone: '0661 64 48 82', folder: '10-014902', paidDZD: 5000 },
  { num: 'Appt 33', floor: 8, name: 'CHABANE OMAR', birth: '-', phone: '0661 21 70 93', folder: '10-069120', paidDZD: 5000 },
  { num: 'Appt 34', floor: 9, name: 'BENSADIA ADEL', birth: '-', phone: '0670 20 89 20', folder: '10-034812', paidDZD: 5000 },
  { num: 'Appt 35', floor: 9, name: 'OUCIF TAREK', birth: '-', phone: '0661 89 36 05', folder: '-', paidDZD: 5000 },
  { num: 'Appt 36', floor: 9, name: 'MEZINE NASSIM', birth: '-', phone: '-', folder: '10-076192', paidDZD: 5000 },
  { num: 'Appt 37', floor: 9, name: 'CHELALI NOUAR', birth: '-', phone: '-', folder: '10-091237', paidDZD: 0 },
];

function generateApartments(): Apartment[] {
  return SPECIFIC_RESIDENTS.map((item, idx) => {
    const isF4 = (idx % 4 === 1) || (idx % 4 === 2);
    return {
      id: `apt-${idx + 1}`,
      number: item.num,
      floor: item.floor,
      type: isF4 ? 'F4' : 'F3',
      surfaceM2: isF4 ? 85.5 : 71.0,
      occupancy: 'owner',
      resident: {
        id: `res-${idx + 1}`,
        name: item.name,
        birthDate: item.birth !== '-' ? item.birth : undefined,
        phone: item.phone,
        email: item.phone !== '-' ? `${item.name.toLowerCase().replace(/[^a-z]/g, '')}@gmail.com` : undefined,
        aadlFolderNumber: item.folder !== '-' ? item.folder : undefined,
        isSyndicMember: item.isSyndic || false,
      },
      notes: item.notes,
    };
  });
}

function generateInitialPayments(): PaymentRecord[] {
  let seq = 1;
  const list: PaymentRecord[] = [];
  SPECIFIC_RESIDENTS.forEach((item, idx) => {
    if (item.paidDZD <= 0) return;
    const receiptNumber = `REC-2026-${String(seq).padStart(3, '0')}`;
    list.push({
      id: `pay-2026-${idx + 1}`,
      receiptNumber,
      apartmentId: `apt-${idx + 1}`,
      apartmentNumber: item.num,
      residentName: item.name,
      month: '2026',
      amountDZD: item.paidDZD,
      paymentDate: '2026-11-24T09:00:00.000Z',
      paymentMethod: 'Espèces',
      collectedBy: 'M. MELLIKECHE FERHAT',
      notes: item.paidDZD < 5000 ? 'Paiement partiel (avance cotisation 2026)' : 'Cotisation annuelle 2026 réglée',
    });
    seq += 1;
  });
  return list;
}

const initialPayments = generateInitialPayments();

const REPORT_2025_TRANSACTION: Transaction = {
  id: 'tx-ran-2025',
  date: '2026-01-01',
  type: 'depense',
  fund: 'courant',
  category: 'Report à Nouveau (Solde Antérieur)',
  amountDZD: 50250,
  description: 'Report à nouveau débiteur — Solde Exercice 2025 (-50 250 DZD)',
  referenceDoc: 'RAN-2025',
  paymentMethod: 'Espèces',
};

const initialTransactions: Transaction[] = [
  ...initialPayments.map((payment): Transaction => ({
    id: `tx-rec-${payment.id}`,
    date: '2026-11-24',
    type: 'recette',
    fund: 'courant',
    category: 'Cotisations Copropriétaires',
    amountDZD: payment.amountDZD,
    description: `Cotisation ${payment.month} - ${payment.apartmentNumber} (${payment.residentName})`,
    referenceDoc: payment.receiptNumber,
    paymentMethod: payment.paymentMethod,
  })),
  REPORT_2025_TRANSACTION,
];

export const initialAppData: AppData = {
  building: {
    id: 'bldg-e36',
    residenceName: 'Cité 2000 Logements AADL',
    ilot: 'Ilot E',
    buildingNumber: 'Bâtiment E 36',
    wilaya: 'Bouira',
    postalCode: '10000',
    totalFloors: 9,
    apartmentsPerFloor: 4,
    hasElevator: true,
    elevatorCount: 2,
    elevatorStatus: 'partial', // 1 running, 1 under maintenance
    hasWaterBooster: true,
    waterBoosterStatus: 'operational',
    doorCode: '3609E',
    standardMonthlyFeeDZD: 5000,
    feeFrequency: 'annuel',
    syndicPresident: 'M. MELLIKECHE FERHAT',
    syndicPhone: '0661 60 19 87',
    syndicEmail: 'mellikeche.ferhat@gmail.com',
    gestImmoAgency: 'Direction GEST-IMMO Wilaya de Bouira',
    quoteThresholdDZD: 20000,
    reserveTargetDZD: 150000,
    committee: {
      president: 'M. MELLIKECHE FERHAT',
      presidentPhone: '0661 60 19 87',
      treasurer: 'M. HAMOUDI NOURDINE',
      treasurerPhone: '0782 33 77 84',
      technicalLead: 'M. BELKACEMI OMAR',
      technicalLeadPhone: '0554 13 60 42',
    },
  },
  apartments: generateApartments(),
  payments: initialPayments,
  incidents: [
    {
      id: 'inc-01',
      title: "Panne Ascenseur N°1 (Blocage au 4ème étage)",
      category: 'ascenseur',
      location: 'Ascenseur Gauche (N°1) - Cage A',
      floor: 4,
      priority: 'urgente',
      status: 'en_cours',
      description: "Le contacteur de porte de l'ascenseur N°1 s'est bloqué. La cabine est immobilisée au 4ème étage, portes fermées mais hors service. Société de maintenance avisée.",
      reportedBy: 'GHARBI MADJID (Appt 01)',
      reportedDate: '2026-11-10T08:30:00Z',
      assignedVendor: 'SARL Ascenseurs Service Algérie',
      estimatedCostDZD: 18000,
      resolutionNotes: "Technicien sur place avec pièces de rechange (contact de sécurité et galet de guidage). Réparation en cours.",
    },
    {
      id: 'inc-02',
      title: "Vibration anormale surpresseur d'eau bâche à eau",
      category: 'surpresseur_eau',
      location: 'Local technique sous-sol (-1)',
      floor: 0,
      priority: 'elevee',
      status: 'en_cours',
      description: "La pompe N°2 du groupe de surpression émet un bruit de cavitation et des vibrations lors du remplissage des étages supérieurs (7 à 9) après 21h.",
      reportedBy: 'MELLIKECHE FERHAT (Syndic)',
      reportedDate: '2026-11-09T19:00:00Z',
      assignedVendor: 'EURL Plomberie & Pompes Zéralda',
      estimatedCostDZD: 12500,
      resolutionNotes: "Diagnostic : clapet anti-retour et purge d'air requis.",
    },
    {
      id: 'inc-03',
      title: "Éclairage palier 7ème étage défectueux",
      category: 'electricite_eclairage',
      location: 'Palier 7ème étage',
      floor: 7,
      priority: 'normale',
      status: 'resolu',
      description: "Deux réglettes LED du couloir ne s'allument plus lors de la détection de mouvement.",
      reportedBy: 'HANNACHE ABDELHAMID YACINE (Appt 27)',
      reportedDate: '2026-11-06T14:00:00Z',
      assignedVendor: 'Électricien Bâtiment (M. Farid)',
      estimatedCostDZD: 3500,
      resolvedDate: '2026-11-08T11:00:00Z',
      resolutionNotes: "Remplacement du détecteur crépusculaire et des deux réglettes LED 18W. Test effectué avec succès.",
    },
    {
      id: 'inc-04',
      title: "Fermeture groom porte d'entrée principale désaxée",
      category: 'porte_interphone',
      location: "Hall d'entrée Bâtiment E 36",
      floor: 0,
      priority: 'normale',
      status: 'resolu',
      description: "La porte d'accès vitrée claquait violemment et le système ventouse magnétique restait ouvert par moment.",
      reportedBy: 'ALLALOU HACENE (Appt 09)',
      reportedDate: '2026-11-01T10:15:00Z',
      assignedVendor: 'Serrurerie Moderne',
      estimatedCostDZD: 4500,
      resolvedDate: '2026-11-02T16:00:00Z',
      resolutionNotes: "Réglage de la force du ferme-porte hydraulique et repositionnement de la ventouse magnétique 300kg.",
    },
  ],
  transactions: initialTransactions,
  notices: [
    {
      id: 'not-01',
      title: "Remise en service de l'Ascenseur N°1 (Gauche)",
      type: 'info',
      date: '2026-11-23',
      author: 'Le Bureau du Syndic',
      message: "Suite au remplacement du contacteur de porte et du galet de guidage par la société de maintenance, l'ascenseur N°1 (Gauche) est de nouveau pleinement opérationnel. Les 2 cabines sont en service normal.",
      isPinned: true,
      targetAudience: 'Tous les résidents',
    },
    {
      id: 'not-02',
      title: "Nettoyage et Désinfection Semestrielle de la Bâche à Eau",
      type: 'coupure_eau',
      date: '2026-11-08',
      author: 'Le Bureau du Syndic & GEST-IMMO',
      message: "Nous informons l'ensemble des copropriétaires et locataires qu'une opération de vidange, récurage et javellisation des réservoirs d'eau du sous-sol sera réalisée ce Samedi de 08h00 à 13h00. Une coupure d'eau temporaire de surpression sera observée durant ces heures. Prière de constituer des réserves suffisantes.",
      isPinned: true,
      targetAudience: 'Tous les résidents',
    },
    {
      id: 'not-03',
      title: "Rappel de Civisme : Propreté des Paliers et Dépôt des Déchets",
      type: 'info',
      date: '2026-11-04',
      author: 'Le Bureau du Syndic',
      message: "Il est strictement interdit de laisser des sacs poubelles ou des encombrants (cartons, meubles usagés, gravats) sur les paliers ou dans les cages d'escalier. Les déchets doivent être déposés directement dans les bacs extérieurs prévus à cet effet entre 19h00 et 22h00.",
      isPinned: false,
      targetAudience: 'Tous les résidents',
    },
    {
      id: 'not-04',
      title: "Convocation à l'Assemblée Générale Extraordinaire",
      type: 'assemblee',
      date: '2026-11-02',
      author: 'Le Bureau du Syndic',
      message: "Tous les copropriétaires du Bâtiment E 36 sont conviés à l'Assemblée Générale qui se tiendra le Vendredi 20 Novembre 2026 à 18h30 dans le hall d'entrée. Ordre du jour : 1) Bilan financier trimestriel, 2) Vote pour l'installation d'un système de vidéosurveillance 8 caméras, 3) Renouvellement du contrat d'entretien du surpresseur.",
      isPinned: false,
      targetAudience: 'Propriétaires',
    },
  ],
  votes: [
    {
      id: 'vote-01',
      title: "Installation d'un système de vidéosurveillance (8 caméras HD)",
      description: "Devis sélectionné pour la sécurisation des 2 accès principaux, du hall d'entrée et des abords des ascenseurs. Montant total : 140 000 DZD (soit 3 888 DZD / appartement sur 2 mensualités).",
      dateCreated: '2026-11-05',
      endDate: '2026-11-20',
      status: 'active',
      options: [
        { id: 'opt-1', label: 'Pour (Favorable au projet)', votes: 21 },
        { id: 'opt-2', label: 'Contre (Défavorable)', votes: 4 },
        { id: 'opt-3', label: 'Abstention / Besoin de précisions', votes: 2 },
      ],
      totalEligibleApartments: 37,
      votedApartments: [
        'apt-1', 'apt-2', 'apt-3', 'apt-4', 'apt-5', 'apt-6', 'apt-7', 'apt-8', 'apt-9',
        'apt-10', 'apt-11', 'apt-12', 'apt-13', 'apt-14', 'apt-15', 'apt-16', 'apt-17', 'apt-18',
        'apt-19', 'apt-20', 'apt-21', 'apt-22', 'apt-23', 'apt-24', 'apt-25', 'apt-26', 'apt-27',
      ],
    },
  ],
  vendors: [
    {
      id: 'ven-01',
      name: 'SARL Ascenseurs Service Bouira',
      specialty: 'Maintenance Ascenseurs & Dépannage',
      phone: '026 71 40 22',
      secondaryPhone: '0560 30 20 10',
      is24hEmergency: true,
      address: 'Zone des Activités, Bouira',
      notes: "Contrat de maintenance N° 2026/E36. Astreinte 24h/24 en cas d'incident en cabine.",
    },
    {
      id: 'ven-02',
      name: 'EURL Plomberie & Pompes Bouira',
      specialty: 'Bâche à Eau, Surpresseur & Colonnes',
      phone: '0552 19 44 80',
      is24hEmergency: true,
      address: 'Avenue Principale, Bouira',
      notes: "Intervention sur groupes motopompes, pressostats et clapets de bâche à eau.",
    },
    {
      id: 'ven-03',
      name: 'Dépannage Sonelgaz Bouira',
      specialty: 'Électricité & Gaz Réseau',
      phone: '3303',
      is24hEmergency: true,
      address: 'Direction de Distribution Sonelgaz Bouira',
      notes: 'Numéro d’urgence gratuit Sonelgaz pour coupures réseau ou compteurs communs.',
    },
    {
      id: 'ven-04',
      name: 'Direction GEST-IMMO Wilaya de Bouira',
      specialty: 'Gestionnaire Immobilier AADL',
      phone: '026 72 15 30',
      is24hEmergency: false,
      address: 'Direction de Wilaya GEST-IMMO, Bouira',
      notes: 'Agence de tutelle pour la cité 2000 logements AADL.',
    },
    {
      id: 'ven-05',
      name: 'Protection Civile (Unité Principale Bouira)',
      specialty: 'Secours & Urgences',
      phone: '14',
      secondaryPhone: '1021',
      is24hEmergency: true,
      address: 'Bouira Centre',
      notes: 'Urgences incendie, inondation ou secours à personnes.',
    },
  ],
  budgetPlan: [
    { category: 'Maintenance Ascenseurs', plannedAnnualDZD: 0, fund: 'courant' },
    { category: 'Agent de Ménage & Entretien', plannedAnnualDZD: 0, fund: 'courant' },
    { category: 'Facture Électricité Sonelgaz', plannedAnnualDZD: 0, fund: 'courant' },
    { category: 'Réparation Bâche à Eau / Surpresseur', plannedAnnualDZD: 0, fund: 'courant' },
    { category: 'Achat Fournitures & Ampoules', plannedAnnualDZD: 0, fund: 'courant' },
    { category: 'Serrurerie & Interphone', plannedAnnualDZD: 0, fund: 'courant' },
    { category: 'Gros Travaux & Équipements', plannedAnnualDZD: 0, fund: 'reserve' },
  ],
  preventiveTasks: [],
  assemblyMinutes: [
    {
      id: 'pv-2026-01',
      title: 'Assemblée Générale Extraordinaire — Sécurisation & Bilan',
      type: 'extraordinaire',
      date: '2026-11-20',
      time: '18:30',
      location: "Hall d'entrée du Bâtiment E 36",
      agenda: [
        'Présentation et validation du bilan financier 2026 (recettes, dépenses et solde caisse)',
        "Vote pour l'installation d'un système de vidéosurveillance 8 caméras HD",
        "Renouvellement du contrat de maintenance préventive des ascenseurs et du surpresseur",
        'Rappel des règles de propreté des paliers et gestion des cotisations impayées',
      ],
      decisions: [
        'Quitus financier accordé au Bureau du Syndic à la majorité des présents.',
        'Validation de principe du projet vidéosurveillance (8 caméras HD, budget plafond 140 000 DZD) financé par appel exceptionnel.',
        'Mise en place d’une règle imposant 2 devis comparatifs pour toute dépense supérieure à 20 000 DZD.',
        'Désinfection semestrielle de la bâche à eau confirmée deux fois par an (Mai et Novembre).',
      ],
      presentApartmentIds: [
        'apt-1', 'apt-3', 'apt-4', 'apt-5', 'apt-6', 'apt-7', 'apt-8', 'apt-10', 'apt-11',
        'apt-12', 'apt-13', 'apt-14', 'apt-15', 'apt-16', 'apt-17', 'apt-19', 'apt-20',
      ],
      presidentName: 'M. MELLIKECHE FERHAT',
      secretaryName: 'M. HAMOUDI NOURDINE',
      notes: 'Séance ouverte à 18h35 et levée à 20h10 dans un climat constructif.',
    },
  ],
  houseRules: [
    {
      id: 'rule-1',
      title: '1. Parties Communes, Paliers & Propreté',
      items: [
        "Il est strictement interdit de déposer des sacs poubelles, cartons, poussettes, meubles ou gravats sur les paliers et dans les cages d'escalier.",
        'Les ordures ménagères doivent être sorties bien fermées dans les bacs extérieurs entre 19h00 et 22h00.',
        'Tout résident réalisant des travaux privatifs est tenu de nettoyer quotidiennement les salissures occasionnées sur le palier et le hall.',
      ],
    },
    {
      id: 'rule-2',
      title: '2. Utilisation des 2 Ascenseurs',
      items: [
        'Il est formellement interdit de transporter des gravats, sacs de ciment ou matériaux lourds dépassant la charge nominale dans les cabines.',
        'En cas de déménagement, protéger les parois de la cabine et prévenir le Bureau du Syndic 48h à l’avance.',
        "Les enfants de moins de 10 ans ne doivent pas utiliser l'ascenseur sans accompagnement d'un adulte.",
      ],
    },
    {
      id: 'rule-3',
      title: '3. Tranquillité & Horaires de Travaux',
      items: [
        'Les travaux bruyants (perceuse, marteau-piqueur, démolition) sont autorisés uniquement du Samedi au Jeudi de 08h30 à 12h00 et de 14h00 à 17h30.',
        'Tous travaux bruyants sont interdits le Vendredi, les jours fériés et après 18h00.',
      ],
    },
    {
      id: 'rule-4',
      title: '4. Sécurité, Accès & Cotisations',
      items: [
        "La porte principale du bâtiment doit rester fermée en permanence ; ne pas bloquer la ventouse magnétique et ne pas communiquer le digicode à des personnes étrangères.",
        'Le règlement ponctuel des cotisations (contre quittance officielle) garantit la continuité des ascenseurs, du surpresseur d’eau, de l’éclairage Sonelgaz et du nettoyage.',
      ],
    },
  ],
};

export function createEmptyBuildingData(params: {
  id: string;
  residenceName: string;
  ilot: string;
  buildingNumber: string;
  wilaya: string;
  totalFloors: number;
  apartmentsPerFloor: number;
  standardFeeDZD: number;
  syndicPresident: string;
  syndicPhone: string;
}): AppData {
  const apartments: Apartment[] = [];
  let aptCounter = 1;
  for (let floor = 0; floor <= params.totalFloors; floor++) {
    const countOnFloor = floor === 0 ? Math.min(1, params.apartmentsPerFloor) : params.apartmentsPerFloor;
    for (let j = 0; j < countOnFloor; j++) {
      const numStr = `Appt ${String(aptCounter).padStart(2, '0')}`;
      const isF4 = aptCounter % 2 === 0;
      apartments.push({
        id: `apt-${aptCounter}`,
        number: numStr,
        floor,
        type: isF4 ? 'F4' : 'F3',
        surfaceM2: isF4 ? 85.5 : 71.0,
        occupancy: 'owner',
        resident: {
          id: `res-${aptCounter}`,
          name: `Copropriétaire ${numStr}`,
          phone: '-',
        },
      });
      aptCounter++;
    }
  }

  return {
    building: {
      id: params.id,
      residenceName: params.residenceName,
      ilot: params.ilot,
      buildingNumber: params.buildingNumber,
      wilaya: params.wilaya,
      postalCode: '10000',
      totalFloors: params.totalFloors,
      apartmentsPerFloor: params.apartmentsPerFloor,
      hasElevator: true,
      elevatorCount: 2,
      elevatorStatus: 'operational',
      hasWaterBooster: true,
      waterBoosterStatus: 'operational',
      doorCode: '1234A',
      standardMonthlyFeeDZD: params.standardFeeDZD,
      feeFrequency: 'annuel',
      syndicPresident: params.syndicPresident,
      syndicPhone: params.syndicPhone,
      syndicEmail: '',
      gestImmoAgency: `Direction GEST-IMMO ${params.wilaya}`,
      quoteThresholdDZD: 20000,
      reserveTargetDZD: 150000,
      committee: {
        president: params.syndicPresident,
        presidentPhone: params.syndicPhone,
        treasurer: '',
        technicalLead: '',
      },
    },
    apartments,
    payments: [],
    incidents: [],
    transactions: [],
    notices: [],
    votes: [],
    vendors: initialAppData.vendors,
    budgetPlan: initialAppData.budgetPlan.map((b) => ({ ...b })),
    preventiveTasks: [],
    assemblyMinutes: [],
    houseRules: initialAppData.houseRules.map((r) => ({ ...r, items: [...r.items] })),
  };
}
