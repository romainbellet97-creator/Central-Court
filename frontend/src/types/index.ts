// Types globaux pour Central Court

/**
 * Identité de session OAuth (auth.emergentagent.com).
 * Champs fixes retournés par le provider — ne pas modifier.
 */
export interface AuthUser {
  user_id: string;
  email: string;
  name: string;
  picture?: string;
  role: 'player' | 'agent' | 'medical' | 'technical' | 'logistics';
  player_id?: string;
}

/**
 * Profil joueur stocké dans notre backend.
 * Source de vérité unique — nommage aligné sur le backend FastAPI.
 */
export interface PlayerProfile {
  id: string;
  prenom: string;
  email: string;
  dateNaissance?: string;
  circuits?: string[];
  niveaux?: string[];
  classement?: string;
  residenceFiscale?: string;
  travelPreferences?: {
    flightClass?: string;
    preferredAirlines?: string[];
    seatPreference?: string;
    mealPreference?: string;
  };
  hotelPreferences?: {
    essentialAmenities?: string[];
    roomType?: string;
    floorPreference?: string;
  };
  foodPreferences?: {
    cuisines?: string[];
    restrictions?: string[];
    allergies?: string[];
  };
  onboardingCompleted: boolean;
  onboardingStep: number;
  createdAt?: string;
  updatedAt?: string;
}

// Types d'équipe pour le partage de documents
export type TeamType = 'agent' | 'medical' | 'technical' | 'logistics';

export interface TeamShare {
  teamType: TeamType;
  shared: boolean;
}

export const teamTypes: { id: TeamType; label: string; icon: string; color: string }[] = [
  { id: 'agent', label: 'Agent', icon: 'briefcase', color: '#1da1f2' },
  { id: 'medical', label: 'Staff Médical', icon: 'medkit', color: '#e0245e' },
  { id: 'technical', label: 'Staff Technique', icon: 'fitness', color: '#4CAF50' },
  { id: 'logistics', label: 'Logistique', icon: 'airplane', color: '#ff9800' },
];

export interface Document {
  id: string;
  category: 'identity' | 'contracts' | 'invoices' | 'medical';
  name: string;
  fileType: 'pdf' | 'image' | 'other';
  fileUri?: string;
  uploadedAt: string;
  expiryDate?: string;
  notes?: string;
  sharedWith: TeamType[];
}

export interface CountryDays {
  country: string;
  countryCode: string;
  flag: string;
  days: number;
  limit: number;
  lastEntry?: string;
}

export interface TaxHistory {
  year: number;
  countries: CountryDays[];
  lastUpdate: string;
}

export const documentCategories = [
  { id: 'identity', label: 'Documents d\'identité', icon: 'id-card' },
  { id: 'contracts', label: 'Contrats', icon: 'file-contract' },
  { id: 'invoices', label: 'Factures', icon: 'receipt' },
  { id: 'medical', label: 'Médical', icon: 'medkit' }
] as const;

// Messages et discussions
export interface Message {
  id: string;
  channelId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  content: string;
  timestamp: string;
  read: boolean;
}

export interface Channel {
  id: string;
  type: TeamType | 'all';
  name: string;
  icon: string;
  color: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount: number;
  members: string[];
}

// Recommandations intelligentes
export interface Recommendation {
  id: string;
  type: 'fiscal' | 'training' | 'health' | 'tournament';
  title: string;
  description: string;
  action?: string;
  actionLabel?: string;
  priority: 'high' | 'medium' | 'low';
  icon: string;
  color: string;
}
