// Système d'alertes et notifications V1 - Style Notion minimaliste

export type AlertType =
  | 'flight_missing'      // Vol non réservé
  | 'hotel_missing'       // Hôtel non réservé
  | 'registration_pending' // Inscription non confirmée
  | 'observation_new'     // Nouvelle observation
  | 'slot_suggestion'     // Suggestion de créneau
  | 'reminder'            // Rappel général
  | 'residence_warning';  // Tournoi hors résidence fiscale

export type AlertPriority = 'high' | 'medium' | 'low';

export interface Alert {
  id: string;
  type: AlertType;
  priority: AlertPriority;
  title: string;
  message: string;
  tournamentId?: string;
  tournamentName?: string;
  tournamentCity?: string;
  tournamentCountry?: string;
  tournamentStartDate?: string;
  tournamentEndDate?: string;
  eventId?: string;
  createdAt: string;
  dueDate?: string;
  read: boolean;
  dismissed: boolean;
  // Pour les suggestions de créneaux
  fromUserId?: string;
  fromUserName?: string;
  fromUserRole?: string;
  targetSlot?: {
    date: string;
    time: string;
    endTime: string;
  };
}

export interface NotificationPreferences {
  inApp: boolean;
  push: boolean;
  email: boolean;
  reminderDays: number[];
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  inApp: true,
  push: true,
  email: true,
  reminderDays: [7, 3]
};

// Configuration minimaliste pour les types d'alertes
export const ALERT_TYPE_CONFIG: Record<AlertType, { 
  icon: string; 
  color: string; 
  label: string;
  actionLabel?: string;
}> = {
  flight_missing: {
    icon: '✈️',
    color: '#eb5757',
    label: 'Vol',
    actionLabel: 'Réserver'
  },
  hotel_missing: {
    icon: '🏨',
    color: '#f2994a',
    label: 'Hôtel',
    actionLabel: 'Réserver'
  },
  registration_pending: {
    icon: '📋',
    color: '#2d9cdb',
    label: 'Inscription',
    actionLabel: 'Confirmer'
  },
  observation_new: {
    icon: '💬',
    color: '#27ae60',
    label: 'Observation',
    actionLabel: 'Voir'
  },
  slot_suggestion: {
    icon: '🔄',
    color: '#9b51e0',
    label: 'Créneau',
    actionLabel: 'Répondre'
  },
  reminder: {
    icon: '⏰',
    color: '#828282',
    label: 'Rappel',
    actionLabel: 'Voir'
  },
  residence_warning: {
    icon: '🌍',
    color: '#e67e22',
    label: 'Résidence fiscale',
    actionLabel: 'Voir'
  }
};

// Génération d'alertes intelligentes basées sur les tournois
export function generateTournamentAlerts(
  tournaments: any[],
  events: any[],
  reminderDays: number[] = [7, 3]
): Alert[] {
  const alerts: Alert[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  tournaments.forEach(week => {
    week.registrations?.forEach((reg: any) => {
      const tournament = week.tournaments.find((t: any) => t.id === reg.tournamentId);
      if (!tournament) return;
      
      // Ne vérifier que si le statut nécessite un voyage
      if (reg.status !== 'participating' && reg.status !== 'accepted' && reg.status !== 'pending') return;
      
      const tournamentStart = new Date(tournament.startDate);
      const daysUntil = Math.ceil((tournamentStart.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      // Ignorer les tournois passés ou trop lointains
      if (daysUntil <= 0 || daysUntil > Math.max(...reminderDays)) return;
      
      const shouldAlert = reminderDays.some(days => daysUntil <= days);
      if (!shouldAlert) return;
      
      // Vérifier vol - chercher un événement de type 'travel' pour cette ville
      const hasFlightToTournament = events.some(e => 
        e.type === 'travel' && 
        (e.tournamentId === tournament.id ||
         e.title.toLowerCase().includes(tournament.city.toLowerCase()))
      );
      
      if (!hasFlightToTournament) {
        alerts.push({
          id: `alert-flight-${tournament.id}`,
          type: 'flight_missing',
          priority: daysUntil <= 3 ? 'high' : 'medium',
          title: 'Vol non réservé',
          message: `${tournament.name} dans ${daysUntil}j`,
          tournamentId: tournament.id,
          tournamentName: tournament.name,
          tournamentCity: tournament.city,
          tournamentCountry: tournament.country,
          tournamentStartDate: tournament.startDate,
          tournamentEndDate: tournament.endDate,
          createdAt: new Date().toISOString(),
          dueDate: tournament.startDate,
          read: false,
          dismissed: false
        });
      }
      
      // Vérifier hôtel
      const hasHotel = events.some(e => 
        e.type === 'hotel' && 
        (e.tournamentId === tournament.id ||
         e.title.toLowerCase().includes(tournament.city.toLowerCase()) ||
         (e.title.toLowerCase().includes('hôtel') && 
          new Date(e.date) <= tournamentStart))
      );
      
      if (!hasHotel) {
        alerts.push({
          id: `alert-hotel-${tournament.id}`,
          type: 'hotel_missing',
          priority: daysUntil <= 3 ? 'high' : 'medium',
          title: 'Hôtel non réservé',
          message: `${tournament.name} dans ${daysUntil}j`,
          tournamentId: tournament.id,
          tournamentName: tournament.name,
          tournamentCity: tournament.city,
          tournamentCountry: tournament.country,
          tournamentStartDate: tournament.startDate,
          tournamentEndDate: tournament.endDate,
          createdAt: new Date().toISOString(),
          dueDate: tournament.startDate,
          read: false,
          dismissed: false
        });
      }
      
      // Inscription en attente
      if (reg.status === 'pending') {
        alerts.push({
          id: `alert-reg-${tournament.id}`,
          type: 'registration_pending',
          priority: daysUntil <= 3 ? 'high' : 'medium',
          title: 'Inscription en attente',
          message: `${tournament.name} dans ${daysUntil}j`,
          tournamentId: tournament.id,
          tournamentName: tournament.name,
          tournamentCity: tournament.city,
          tournamentCountry: tournament.country,
          tournamentStartDate: tournament.startDate,
          tournamentEndDate: tournament.endDate,
          createdAt: new Date().toISOString(),
          dueDate: tournament.startDate,
          read: false,
          dismissed: false
        });
      }
    });
  });
  
  return alerts;
}

// Créer une alerte d'observation
export function createObservationAlert(
  eventId: string,
  eventTitle: string,
  authorName: string,
  authorRole: string,
  observationText: string
): Alert {
  return {
    id: `alert-obs-${eventId}-${Date.now()}`,
    type: 'observation_new',
    priority: 'low',
    title: authorName,
    message: `"${observationText.substring(0, 60)}${observationText.length > 60 ? '...' : ''}"`,
    eventId,
    createdAt: new Date().toISOString(),
    read: false,
    dismissed: false,
    fromUserId: authorName.toLowerCase().replace(/\s/g, '-'),
    fromUserName: authorName,
    fromUserRole: authorRole
  };
}

// Créer une suggestion de créneau
export function createSlotSuggestion(
  fromUserName: string,
  fromUserRole: string,
  targetUserName: string,
  eventTitle: string,
  slot: { date: string; time: string; endTime: string },
  message: string
): Alert {
  return {
    id: `alert-slot-${Date.now()}`,
    type: 'slot_suggestion',
    priority: 'medium',
    title: `${fromUserName} suggère un créneau`,
    message: `${slot.time}-${slot.endTime} • "${message}"`,
    createdAt: new Date().toISOString(),
    read: false,
    dismissed: false,
    fromUserId: fromUserName.toLowerCase().replace(/\s/g, '-'),
    fromUserName,
    fromUserRole,
    targetSlot: slot
  };
}

// Alertes de démo avec données réalistes
export const DEMO_ALERTS: Alert[] = [
  {
    id: 'demo-alert-1',
    type: 'flight_missing',
    priority: 'high',
    title: 'Vol non réservé',
    message: 'Open Occitanie dans 5j',
    tournamentId: 'montpellier-2026',
    tournamentName: 'Open Occitanie',
    tournamentCity: 'Montpellier',
    tournamentCountry: 'France',
    tournamentStartDate: '2026-02-02',
    tournamentEndDate: '2026-02-08',
    createdAt: new Date().toISOString(),
    dueDate: '2026-02-02',
    read: false,
    dismissed: false
  },
  {
    id: 'demo-alert-2',
    type: 'hotel_missing',
    priority: 'high',
    title: 'Hôtel non réservé',
    message: 'Open Occitanie dans 5j',
    tournamentId: 'montpellier-2026',
    tournamentName: 'Open Occitanie',
    tournamentCity: 'Montpellier',
    tournamentCountry: 'France',
    tournamentStartDate: '2026-02-02',
    tournamentEndDate: '2026-02-08',
    createdAt: new Date().toISOString(),
    dueDate: '2026-02-02',
    read: false,
    dismissed: false
  },
  {
    id: 'demo-alert-3',
    type: 'hotel_missing',
    priority: 'medium',
    title: 'Hôtel non réservé',
    message: 'Acapulco dans 14j',
    tournamentId: 'acapulco-2026',
    tournamentName: 'Abierto Mexicano Telcel',
    tournamentCity: 'Acapulco',
    tournamentCountry: 'Mexique',
    tournamentStartDate: '2026-02-23',
    tournamentEndDate: '2026-03-01',
    createdAt: new Date().toISOString(),
    dueDate: '2026-02-23',
    read: false,
    dismissed: false
  },
  {
    id: 'demo-alert-4',
    type: 'observation_new',
    priority: 'low',
    title: 'Dr. Sophie Laurent',
    message: '"Épaule droite OK pour entraînement..."',
    eventId: 'evt-020',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    read: true,
    dismissed: false,
    fromUserName: 'Dr. Sophie Laurent',
    fromUserRole: 'Kiné'
  },
  {
    id: 'demo-alert-5',
    type: 'slot_suggestion',
    priority: 'medium',
    title: 'Marc Dupont suggère un créneau',
    message: '16:00-17:00 • "Séance récup après le match"',
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    read: false,
    dismissed: false,
    fromUserName: 'Marc Dupont',
    fromUserRole: 'Préparateur Physique',
    targetSlot: {
      date: '2026-02-05',
      time: '16:00',
      endTime: '17:00'
    }
  }
];
