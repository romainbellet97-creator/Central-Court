// Types d'événements V1 MVP avec codes couleur

export type EventTypeV1 =
  | 'tournament'
  | 'training_tennis'
  | 'training_physical'
  | 'medical_kine'
  | 'media'
  | 'sponsor'
  | 'activation_marque'
  | 'personal'
  | 'travel'
  | 'hotel';

export interface EventCategoryV1 {
  color: string;
  icon: string;
  label: string;
  privacy?: boolean;
}

export const EVENT_CATEGORIES: Record<EventTypeV1, EventCategoryV1> = {
  tournament: {
    color: '#1976d2',
    icon: '🏆',
    label: 'Tournoi'
  },
  training_tennis: {
    color: '#388e3c',
    icon: '🎾',
    label: 'Entraînement Tennis'
  },
  training_physical: {
    color: '#2e7d32',
    icon: '💪',
    label: 'Préparation Physique'
  },
  medical_kine: {
    color: '#c2185b',
    icon: '🏥',
    label: 'Kiné-Récup'
  },
  media: {
    color: '#f57c00',
    icon: '📺',
    label: 'Médias'
  },
  sponsor: {
    color: '#7b1fa2',
    icon: '🤝',
    label: 'Sponsors'
  },
  personal: {
    color: '#757575',
    icon: '👤',
    label: 'Perso',
    privacy: true
  },
  travel: {
    color: '#00796b',
    icon: '✈️',
    label: 'Vol'
  },
  activation_marque: {
    color: '#059669',
    icon: '⚡',
    label: 'Activation marque'
  },
  hotel: {
    color: '#5d4037',
    icon: '🏨',
    label: 'Hôtel'
  }
};

export interface Observation {
  id: string;
  author: string;
  role: string;
  text: string;
  createdAt: string;
}

export interface CalendarEventV1 {
  id: string;
  type: EventTypeV1;
  title: string;
  date: string;
  endDate?: string;
  time?: string;
  endTime?: string;
  location?: string;
  description?: string;
  observations: Observation[];
  cost?: number;
  tournamentId?: string;
  visibleToStaff: boolean;
  // Nouveau: Lien avec le staff assigné
  assignedStaffIds?: string[];
}

// Événements de démo - Février 2026 (avec plus de données pour tester les alertes)
export const DEMO_EVENTS_FEB_2026: CalendarEventV1[] = [
  // Entraînements Tennis
  {
    id: 'evt-001',
    type: 'training_tennis',
    title: 'Entraînement Service',
    date: '2026-02-03',
    time: '09:00',
    endTime: '11:00',
    location: 'Mouratoglou Academy, Nice',
    observations: [
      {
        id: 'obs-001',
        author: 'Patrick Mouratoglou',
        role: 'Coach',
        text: 'Focus service slice. 45 min travail rebond haut. Amélioration visible.',
        createdAt: '2026-02-03T11:15:00'
      }
    ],
    visibleToStaff: true,
    assignedStaffIds: ['staff-001']
  },
  {
    id: 'evt-002',
    type: 'training_tennis',
    title: 'Match entraînement',
    date: '2026-02-05',
    time: '10:00',
    endTime: '12:00',
    location: 'Mouratoglou Academy, Nice',
    observations: [],
    visibleToStaff: true,
    assignedStaffIds: ['staff-001']
  },
  {
    id: 'evt-003',
    type: 'training_tennis',
    title: 'Séance retour de fond',
    date: '2026-02-10',
    time: '09:30',
    endTime: '11:30',
    location: 'CNE Paris',
    observations: [],
    visibleToStaff: true,
    assignedStaffIds: ['staff-001']
  },
  
  // Préparation Physique
  {
    id: 'evt-010',
    type: 'training_physical',
    title: 'Renforcement musculaire',
    date: '2026-02-04',
    time: '07:00',
    endTime: '08:30',
    location: 'Salle de sport, Nice',
    observations: [
      {
        id: 'obs-010',
        author: 'Marc Dupont',
        role: 'Préparateur Physique',
        text: 'Séance complète. Augmentation charges 5%. RAS.',
        createdAt: '2026-02-04T08:45:00'
      }
    ],
    visibleToStaff: true,
    assignedStaffIds: ['staff-002']
  },
  {
    id: 'evt-011',
    type: 'training_physical',
    title: 'Cardio + explosivité',
    date: '2026-02-06',
    time: '07:00',
    endTime: '08:00',
    location: 'Salle de sport, Nice',
    observations: [],
    visibleToStaff: true,
    assignedStaffIds: ['staff-002']
  },
  
  // Kiné
  {
    id: 'evt-020',
    type: 'medical_kine',
    title: 'Séance Kiné Épaule',
    date: '2026-02-04',
    time: '16:00',
    endTime: '17:00',
    location: 'Cabinet Dr. Laurent, Paris',
    observations: [
      {
        id: 'obs-020',
        author: 'Dr. Sophie Laurent',
        role: 'Kiné',
        text: 'Épaule droite OK pour entraînement. Pas de smash pendant 3j. Continuer exercices renfo.',
        createdAt: '2026-02-04T17:10:00'
      }
    ],
    cost: 80,
    visibleToStaff: true,
    assignedStaffIds: ['staff-003']
  },
  {
    id: 'evt-021',
    type: 'medical_kine',
    title: 'Récupération massage',
    date: '2026-02-07',
    time: '18:00',
    endTime: '19:00',
    location: 'Cabinet Dr. Laurent, Paris',
    observations: [],
    cost: 90,
    visibleToStaff: true,
    assignedStaffIds: ['staff-003']
  },
  
  // Médias
  {
    id: 'evt-030',
    type: 'media',
    title: 'Interview L\'Équipe',
    date: '2026-02-12',
    time: '14:00',
    endTime: '15:00',
    location: 'Siège L\'Équipe, Paris',
    observations: [],
    visibleToStaff: true
  },
  
  // Sponsors
  {
    id: 'evt-040',
    type: 'sponsor',
    title: 'Shooting photo Nike',
    date: '2026-02-14',
    time: '10:00',
    endTime: '13:00',
    location: 'Studio Paris 8e',
    observations: [],
    visibleToStaff: true
  },
  
  // Perso (masqué au staff)
  {
    id: 'evt-050',
    type: 'personal',
    title: 'RDV personnel',
    date: '2026-02-08',
    time: '09:30',
    endTime: '11:00',
    observations: [],
    visibleToStaff: false
  },
  {
    id: 'evt-051',
    type: 'personal',
    title: 'Anniversaire famille',
    date: '2026-02-15',
    time: '19:00',
    endTime: '23:00',
    observations: [],
    visibleToStaff: false
  },
  
  // === VOYAGES - Réservés pour Rotterdam (semaine 7) ===
  {
    id: 'evt-060',
    type: 'travel',
    title: 'Vol Nice → Rotterdam',
    date: '2026-02-08',
    time: '15:30',
    endTime: '17:45',
    location: 'AF1234',
    cost: 285,
    observations: [],
    visibleToStaff: true,
    tournamentId: 'rotterdam-2026'
  },
  {
    id: 'evt-061',
    type: 'travel',
    title: 'Vol Rotterdam → Nice',
    date: '2026-02-16',
    time: '18:00',
    endTime: '20:15',
    location: 'AF5678',
    cost: 310,
    observations: [],
    visibleToStaff: true,
    tournamentId: 'rotterdam-2026'
  },
  
  // === HÔTEL - Rotterdam ===
  {
    id: 'evt-070',
    type: 'hotel',
    title: 'Hôtel Mainport Rotterdam',
    date: '2026-02-08',
    endDate: '2026-02-16',
    location: 'Leuvehaven 77, Rotterdam',
    cost: 1890,
    observations: [],
    visibleToStaff: true,
    tournamentId: 'rotterdam-2026'
  },
  
  // === PAS de vol/hôtel pour Montpellier (semaine 6) - Génère des alertes ===
  // === PAS de vol/hôtel pour Doha (semaine 8) - Génère des alertes ===
  
  // === VOYAGES - Acapulco (semaine 9) - Vol réservé mais pas d'hôtel ===
  {
    id: 'evt-080',
    type: 'travel',
    title: 'Vol Paris → Acapulco',
    date: '2026-02-22',
    time: '11:00',
    endTime: '18:00',
    location: 'AM456 via Mexico City',
    cost: 1450,
    observations: [],
    visibleToStaff: true,
    tournamentId: 'acapulco-2026'
  }
];
