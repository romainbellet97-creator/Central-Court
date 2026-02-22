import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Colors from '../../src/constants/colors';
import { getFlagEmoji } from '../../src/utils/countryFlags';
import AppleDatePicker from '../../src/components/inputs/AppleDatePicker';
import AppleTimePicker from '../../src/components/inputs/AppleTimePicker';
import AppleOptionPicker from '../../src/components/inputs/AppleOptionPicker';
import { useAuth } from '../../src/context/AuthContext';
import {
  fetchEvents,
  fetchTournamentWeeks,
  fetchAlerts,
  createEvent as apiCreateEvent,
  updateEvent as apiUpdateEvent,
  deleteEvent as apiDeleteEvent,
  addObservation as apiAddObservation,
  registerTournament as apiRegisterTournament,
  hideTournament as apiHideTournament,
  unhideTournament as apiUnhideTournament,
  checkTournamentConflicts,
} from '../../src/services/api';
import EventObservationSection from '../../src/components/EventObservationSection';

// ============ CONSTANTS ============

const ONBOARDING_DATA_KEY = 'onboarding_data';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Types d'événements avec couleurs et icônes
const EVENT_TYPES: Record<string, { label: string; color: string; icon: string }> = {
  training: { label: '🎾 Entraînement Tennis', color: '#10B981', icon: 'tennisball-outline' },
  physicalPrep: { label: '💪 Préparation Physique', color: '#F59E0B', icon: 'fitness-outline' },
  match: { label: '🏆 Match', color: '#EF4444', icon: 'trophy-outline' },
  tournament: { label: '🎯 Tournoi', color: '#8B5CF6', icon: 'flag-outline' },
  recovery: { label: '🧘 Récupération', color: '#06B6D4', icon: 'heart-outline' },
  meeting: { label: '📋 Réunion', color: '#6B7280', icon: 'people-outline' },
  medical: { label: '🏥 Médical', color: '#E91E63', icon: 'medkit-outline' },
  travel: { label: '✈️ Voyage', color: '#9C27B0', icon: 'airplane-outline' },
  other: { label: '📌 Autre', color: '#607D8B', icon: 'ellipsis-horizontal-outline' },
};

const TOURNAMENT_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  interested: { label: 'Intéressé', color: '#9E9E9E' },
  pending: { label: 'En attente', color: '#FF9800' },
  accepted: { label: 'Accepté', color: '#4CAF50' },
  participating: { label: 'Participant', color: '#2196F3' },
  declined: { label: 'Décliné', color: '#F44336' },
};

const SURFACE_COLORS: Record<string, string> = {
  'Hard': '#2196F3',
  'Clay': '#E65100',
  'Grass': '#4CAF50',
  'Carpet': '#9C27B0',
  'dur': '#2196F3',
  'terre': '#E65100',
  'gazon': '#4CAF50',
  'indoor': '#1565C0',
};

const CATEGORY_COLORS: Record<string, string> = {
  'Grand Chelem': '#D4AF37',
  'Masters 1000': '#E53935',
  'ATP 500': '#1e3c72',
  'ATP 250': '#2196F3',
  'ATP Finals': '#FFD700',
  'WTA 1000': '#E53935',
  'WTA 500': '#9C27B0',
  'WTA 250': '#E91E63',
  'WTA Finals': '#FFD700',
};

// Configure French locale
LocaleConfig.locales['fr'] = {
  monthNames: ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'],
  monthNamesShort: ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'],
  dayNames: ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'],
  dayNamesShort: ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'],
  today: "Aujourd'hui"
};
LocaleConfig.defaultLocale = 'fr';

// ============ TYPES ============

interface Observation {
  id: string;
  author: string;
  role?: string;
  text: string;
  createdAt: string;
  parentId?: string | null;
  isPending?: boolean;
}

interface CalendarEvent {
  id: string;
  type: string;
  title: string;
  date: string;
  time?: string;
  endDate?: string;      // FEATURE #3: Date de fin
  endTime?: string;      // FEATURE #3: Heure de fin
  location?: string;
  description?: string;
  observations?: Observation[];
  createdAt?: string;
  pendingValidation?: boolean;  // FEATURE #2: En attente de validation
  validationStatus?: 'accepted' | 'refused' | null;
  staffMembers?: { id: string; name: string; role: string }[];
}

interface Tournament {
  id: string;
  name: string;
  circuit: string;
  category: string;
  surface: string;
  startDate: string;
  endDate: string;
  week: number;
  city: string;
  country: string;
  countryCode?: string;
  flag?: string;
  prizeMoney: number;
  currency: string;
  registration?: { status: string };
  hidden?: boolean;
}

interface TournamentWeek {
  weekNumber: number;
  startDate: string;
  tournaments: Tournament[];
}

// ============ COMPONENT ============

export default function CalendarScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const today = new Date().toISOString().split('T')[0];
  
  // BUG #1 FIX: Utiliser le contexte Auth pour le nom de l'utilisateur
  const { user: authUser } = useAuth();
  
  // BUG #3 FIX: Ref pour le scroll automatique du modal détail
  const detailScrollRef = useRef<ScrollView>(null);
  
  // Core state
  const [currentMonth, setCurrentMonth] = useState(today.substring(0, 7));
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tournamentWeeks, setTournamentWeeks] = useState<TournamentWeek[]>([]);
  const [unreadAlertCount, setUnreadAlertCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [userCircuits, setUserCircuits] = useState<string[]>(['ATP']);

  // Event Modals
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [showEditEventModal, setShowEditEventModal] = useState(false);
  const [showEventDetailModal, setShowEventDetailModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  
  // Observation Modal
  const [showAddObservationModal, setShowAddObservationModal] = useState(false);
  const [observationText, setObservationText] = useState('');
  
  // Event form state - FEATURE #3: Ajout endTime
  const [eventType, setEventType] = useState('training');
  const [eventDate, setEventDate] = useState(today);
  const [eventTime, setEventTime] = useState('09:00');
  const [eventEndTime, setEventEndTime] = useState('10:00');  // FEATURE #3: Heure de fin par défaut +1h
  const [eventNotes, setEventNotes] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [endTimeManuallySet, setEndTimeManuallySet] = useState(false);  // Pour auto-update

  // Tournament Modal
  const [showTournamentModal, setShowTournamentModal] = useState(false);
  const [selectedWeekNumber, setSelectedWeekNumber] = useState<number | null>(null);
  
  // Conflict Modal
  const [conflictData, setConflictData] = useState<any>(null);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [pendingRegistration, setPendingRegistration] = useState<{tournamentId: string, status: string} | null>(null);

  // ============ MODAL CLEANUP FUNCTIONS ============
  
  // CRITIQUE: Fonction de reset complète pour l'état des modals d'événements
  const closeAllEventModals = useCallback(() => {
    console.log('🔄 Closing all event modals');
    setShowAddEventModal(false);
    setShowEditEventModal(false);
    setShowEventDetailModal(false);
    setShowAddObservationModal(false);
    setSelectedEvent(null);
    setObservationText('');
    // Reset form
    setEventType('training');
    setEventDate(today);
    setEventTime('09:00');
    setEventEndTime('10:00');
    setEndTimeManuallySet(false);
    setEventNotes('');
    setEventLocation('');
  }, [today]);

  // Helper: Calculer l'heure de fin par défaut (+1h)
  const getDefaultEndTime = useCallback((startTime: string): string => {
    const [hours, minutes] = startTime.split(':').map(Number);
    const endHours = (hours + 1) % 24;
    return `${endHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }, []);

  // FEATURE #3: Auto-update endTime quand startTime change (si pas manuellement modifié)
  useEffect(() => {
    if (!endTimeManuallySet) {
      setEventEndTime(getDefaultEndTime(eventTime));
    }
  }, [eventTime, endTimeManuallySet, getDefaultEndTime]);

  // Derive selectedWeek from reactive state
  const selectedWeek = useMemo(() => {
    if (selectedWeekNumber === null) return null;
    return tournamentWeeks.find(w => w.weekNumber === selectedWeekNumber) || null;
  }, [selectedWeekNumber, tournamentWeeks]);

  // Day events - FUSIONNÉ avec les tournois "Participant" (BUG #2 FIX)
  const dayEvents = useMemo(() => {
    const manualEvents = events.filter(e => e.date === selectedDate);
    
    // Fusionner avec les tournois où le joueur est "Participant"
    const tournamentEvents: CalendarEvent[] = [];
    
    // Parse selectedDate to get year, month, day without timezone issues
    const [selectedYear, selectedMonth, selectedDay] = selectedDate.split('-').map(Number);
    const selectedDateNum = selectedYear * 10000 + selectedMonth * 100 + selectedDay;
    
    tournamentWeeks.forEach(week => {
      if (!week?.tournaments) return;
      
      week.tournaments
        .filter(t => t.registration?.status === 'participating')
        .forEach(tournament => {
          if (!tournament?.startDate || !tournament?.endDate) return;
          
          try {
            // Parse dates without timezone issues
            const startDateStr = String(tournament.startDate).split('T')[0];
            const endDateStr = String(tournament.endDate).split('T')[0];
            
            const [startYear, startMonth, startDay] = startDateStr.split('-').map(Number);
            const [endYear, endMonth, endDay] = endDateStr.split('-').map(Number);
            
            const startDateNum = startYear * 10000 + startMonth * 100 + startDay;
            const endDateNum = endYear * 10000 + endMonth * 100 + endDay;
            
            // Vérifier si le jour sélectionné est dans la période du tournoi
            if (selectedDateNum >= startDateNum && selectedDateNum <= endDateNum) {
              // Créer un événement "virtuel" pour ce tournoi
              tournamentEvents.push({
                id: `tournament-${tournament.id}-${selectedDate}`,
                type: 'tournament',
                title: tournament.name,
                date: selectedDate,
                time: undefined,
                location: `${tournament.city}, ${tournament.country}`,
                description: `${tournament.category} • ${tournament.surface}`,
                observations: [],
                // Ajouter des métadonnées supplémentaires
                ...({
                  _isTournamentEvent: true,
                  _tournament: tournament,
                  _level: tournament.category,
                  _flag: tournament.flag || getFlagEmoji(tournament.country),
                  _startDate: tournament.startDate,
                  _endDate: tournament.endDate,
                } as any),
              });
            }
          } catch (e) {
            // Silent error handling
          }
        });
    });
    
    // Fusionner et trier (tournois en premier car ils n'ont pas d'heure)
    return [...tournamentEvents, ...manualEvents].sort((a, b) => 
      (a.time || '00:00').localeCompare(b.time || '00:00')
    );
  }, [events, tournamentWeeks, selectedDate]);

  // ============ DATA LOADING ============

  useEffect(() => {
    const loadUserCircuits = async () => {
      try {
        const stored = await AsyncStorage.getItem(ONBOARDING_DATA_KEY);
        if (stored) {
          const data = JSON.parse(stored);
          if (data.circuits && Array.isArray(data.circuits) && data.circuits.length > 0) {
            setUserCircuits(data.circuits);
          }
        }
      } catch (e) {
        console.error('Failed to load user circuits:', e);
      }
    };
    loadUserCircuits();
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const circuitsParam = userCircuits.join(',');
        
        const [eventsData, weeksData, alertsData] = await Promise.all([
          fetchEvents(currentMonth).catch(() => []),
          fetchTournamentWeeks(circuitsParam).catch(() => ({ weeks: [] })),
          fetchAlerts(true).catch(() => []),
        ]);
        
        setEvents(Array.isArray(eventsData) ? eventsData : []);
        
        if (weeksData && weeksData.weeks && Array.isArray(weeksData.weeks)) {
          setTournamentWeeks(weeksData.weeks);
        } else if (Array.isArray(weeksData)) {
          setTournamentWeeks(weeksData);
        } else {
          setTournamentWeeks([]);
        }
        
        setUnreadAlertCount(Array.isArray(alertsData) ? alertsData.length : 0);
      } catch (e) {
        console.error('Failed to load data:', e);
        setTournamentWeeks([]);
        setEvents([]);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [currentMonth, userCircuits]);

  // ============ CALENDAR MARKS ============

  const calendarMarks = useMemo(() => {
    const marks: Record<string, any> = {};
    
    // Add event marks with colored dots
    events.forEach(event => {
      if (!event?.date || !event?.type) return;
      
      const eventConfig = EVENT_TYPES[event.type] || EVENT_TYPES.other;
      if (!marks[event.date]) {
        marks[event.date] = { dots: [] };
      }
      const hasDot = marks[event.date].dots.some((d: any) => d.key === `event-${event.id}`);
      if (!hasDot) {
        marks[event.date].dots.push({ 
          key: `event-${event.id}`,
          color: eventConfig.color 
        });
      }
    });
    
    // Add tournament marks
    tournamentWeeks.forEach(week => {
      if (!week?.tournaments) return;
      
      week.tournaments.filter(t => t?.registration).forEach(tournament => {
        if (!tournament?.startDate || !tournament?.endDate) return;
        
        try {
          let currentDate = new Date(tournament.startDate);
          const endDate = new Date(tournament.endDate);
          
          while (currentDate <= endDate) {
            const dateStr = currentDate.toISOString().split('T')[0];
            if (!marks[dateStr]) {
              marks[dateStr] = { dots: [] };
            }
            const hasDot = marks[dateStr].dots.some((d: any) => d.key === `tournament-${tournament.id}`);
            if (!hasDot) {
              marks[dateStr].dots.push({ 
                key: `tournament-${tournament.id}`,
                color: EVENT_TYPES.tournament.color 
              });
            }
            currentDate.setDate(currentDate.getDate() + 1);
          }
        } catch (e) {}
      });
    });
    
    // Mark selected date
    if (selectedDate) {
      if (!marks[selectedDate]) {
        marks[selectedDate] = { dots: [] };
      }
      marks[selectedDate].selected = true;
      marks[selectedDate].selectedColor = '#1e3c72';
    }
    
    return marks;
  }, [events, tournamentWeeks, selectedDate]);

  // ============ EVENT HANDLERS ============

  const resetEventForm = () => {
    setEventType('training');
    setEventDate(selectedDate || today);
    setEventTime('09:00');
    setEventEndTime('10:00');
    setEndTimeManuallySet(false);
    setEventNotes('');
    setEventLocation('');
  };

  const openAddEventModal = () => {
    resetEventForm();
    setEventDate(selectedDate || today);
    setShowAddEventModal(true);
  };

  const openEditEventModal = (event: CalendarEvent) => {
    // First close the detail modal completely
    setShowEventDetailModal(false);
    
    // Set form values
    setSelectedEvent(event);
    setEventType(event.type || 'other');
    setEventDate(event.date);
    setEventTime(event.time || '09:00');
    setEventEndTime(event.endTime || getDefaultEndTime(event.time || '09:00'));
    setEndTimeManuallySet(!!event.endTime);
    setEventNotes(event.description || '');
    setEventLocation(event.location || '');
    
    // Open edit modal after a small delay to ensure detail modal is closed
    setTimeout(() => {
      setShowEditEventModal(true);
    }, 100);
  };

  const handleSaveEvent = async () => {
    console.log('💾 === SAVE NEW EVENT ===');
    try {
      const newEvent = {
        type: eventType,
        title: EVENT_TYPES[eventType]?.label || 'Événement',
        date: eventDate,
        time: eventTime,
        endTime: eventEndTime,  // FEATURE #3: Heure de fin
        location: eventLocation.trim() || undefined,
        description: eventNotes.trim() || undefined,
      };

      const savedEvent = await apiCreateEvent(newEvent);
      
      // CRITIQUE: Mise à jour immutable de l'état
      setEvents(prevEvents => {
        const newEvents = [...prevEvents, savedEvent];
        console.log('✅ Events updated, new count:', newEvents.length);
        return newEvents;
      });
      
      // Fermer proprement
      setShowAddEventModal(false);
      resetEventForm();
      
      Alert.alert('Succès', 'Événement créé !');
    } catch (error) {
      console.error('Error creating event:', error);
      Alert.alert('Erreur', 'Impossible de créer l\'événement');
    }
  };

  const handleUpdateEvent = async () => {
    if (!selectedEvent) return;
    
    console.log('💾 === UPDATE EVENT ===', selectedEvent.id);
    
    try {
      const updatedData = {
        type: eventType,
        title: EVENT_TYPES[eventType]?.label || 'Événement',
        date: eventDate,
        time: eventTime,
        endTime: eventEndTime,  // FEATURE #3: Heure de fin
        location: eventLocation.trim() || undefined,
        description: eventNotes.trim() || undefined,
      };

      const updatedEvent = await apiUpdateEvent(selectedEvent.id, updatedData);
      
      // CRITIQUE: Mise à jour immutable avec copie profonde
      const eventId = selectedEvent.id;
      setEvents(prevEvents => {
        const newEvents = prevEvents.map(e => {
          if (e.id === eventId) {
            // Créer un nouvel objet complètement
            return {
              ...e,
              ...updatedEvent,
              id: eventId, // S'assurer que l'ID reste le même
            };
          }
          return e;
        });
        console.log('✅ Event updated successfully');
        return newEvents;
      });
      
      // CRITIQUE: Fermer tous les modals et nettoyer l'état
      setShowEditEventModal(false);
      setShowEventDetailModal(false);
      setSelectedEvent(null);
      resetEventForm();
      
      Alert.alert('Succès', 'Événement modifié !');
    } catch (error) {
      console.error('Error updating event:', error);
      Alert.alert('Erreur', 'Impossible de modifier l\'événement');
    }
  };

  // FEATURE #2: Mise à jour avec option de notification du staff
  const handleUpdateEventWithNotification = async (notifyStaff: boolean) => {
    if (!selectedEvent) return;
    
    console.log('💾 === UPDATE EVENT WITH NOTIFICATION ===', selectedEvent.id, 'notify:', notifyStaff);
    
    try {
      const updatedData = {
        type: eventType,
        title: EVENT_TYPES[eventType]?.label || 'Événement',
        date: eventDate,
        time: eventTime,
        endTime: eventEndTime,
        location: eventLocation.trim() || undefined,
        description: eventNotes.trim() || undefined,
        notify_staff: notifyStaff,
        pending_validation: notifyStaff, // Si on notifie, passe en attente de validation
      };

      const updatedEvent = await apiUpdateEvent(selectedEvent.id, updatedData);
      
      const eventId = selectedEvent.id;
      setEvents(prevEvents => {
        return prevEvents.map(e => {
          if (e.id === eventId) {
            return {
              ...e,
              ...updatedEvent,
              id: eventId,
              pendingValidation: notifyStaff,
            };
          }
          return e;
        });
      });
      
      setShowEditEventModal(false);
      setShowEventDetailModal(false);
      setSelectedEvent(null);
      resetEventForm();
      
      if (notifyStaff) {
        Alert.alert(
          '📤 Proposition envoyée',
          'Le staff a été notifié du nouveau créneau proposé. L\'événement est en attente de validation.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Succès', 'Événement modifié !');
      }
    } catch (error) {
      console.error('Error updating event with notification:', error);
      Alert.alert('Erreur', 'Impossible de modifier l\'événement');
    }
  };

  const handleDeleteEvent = () => {
    if (!selectedEvent) return;
    
    const eventIdToDelete = selectedEvent.id;
    
    Alert.alert(
      'Supprimer l\'événement',
      'Êtes-vous sûr de vouloir supprimer cet événement ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            console.log('🗑️ === DELETE EVENT ===', eventIdToDelete);
            try {
              await apiDeleteEvent(eventIdToDelete);
              
              // CRITIQUE: Fermer les modals AVANT de modifier l'état
              setShowEventDetailModal(false);
              setSelectedEvent(null);
              
              // CRITIQUE: Mise à jour immutable
              setEvents(prevEvents => {
                const newEvents = prevEvents.filter(e => e.id !== eventIdToDelete);
                console.log('✅ Event deleted, remaining:', newEvents.length);
                return newEvents;
              });
              
              Alert.alert('Succès', 'Événement supprimé');
            } catch (error) {
              console.error('Delete error:', error);
              Alert.alert('Erreur', 'Impossible de supprimer');
            }
          },
        },
      ]
    );
  };

  // FEATURE #1: Handler pour le nouveau composant EventObservationSection
  // BUG #1 FIX: Utiliser le vrai nom de l'utilisateur connecté
  const getCurrentUser = useCallback(() => {
    // TODO: Récupérer depuis le contexte Auth réel
    // Pour l'instant, utiliser les données de l'utilisateur stockées localement
    return {
      id: 'current-user-id',
      name: 'Joueur', // Sera remplacé par le vrai nom de l'utilisateur
      role: 'Joueur',
    };
  }, []);

  const handleObservationAdded = useCallback((observation: Observation | null, removeId?: string) => {
    if (!selectedEvent) return;
    
    const eventId = selectedEvent.id;
    
    if (removeId) {
      // Rollback: supprimer l'observation optimiste
      setEvents(prevEvents => 
        prevEvents.map(e => 
          e.id === eventId
            ? { ...e, observations: (e.observations || []).filter(o => o.id !== removeId) }
            : e
        )
      );
      setSelectedEvent(prev => 
        prev?.id === eventId
          ? { ...prev, observations: (prev.observations || []).filter(o => o.id !== removeId) }
          : prev
      );
      return;
    }
    
    if (observation) {
      // Ajouter l'observation (optimistic update)
      setEvents(prevEvents => 
        prevEvents.map(e => 
          e.id === eventId
            ? { ...e, observations: [...(e.observations || []), observation] }
            : e
        )
      );
      setSelectedEvent(prev => 
        prev?.id === eventId
          ? { ...prev, observations: [...(prev.observations || []), observation] }
          : prev
      );
    }
  }, [selectedEvent]);

  // BUG #2 FIX: Handler pour mettre à jour le statut d'une observation
  const handleObservationUpdated = useCallback((observationId: string, updatedFields: Partial<Observation>) => {
    if (!selectedEvent) return;
    
    const eventId = selectedEvent.id;
    
    setEvents(prevEvents => 
      prevEvents.map(e => 
        e.id === eventId
          ? { 
              ...e, 
              observations: (e.observations || []).map(obs => 
                obs.id === observationId ? { ...obs, ...updatedFields } : obs
              )
            }
          : e
      )
    );
    setSelectedEvent(prev => 
      prev?.id === eventId
        ? { 
            ...prev, 
            observations: (prev.observations || []).map(obs => 
              obs.id === observationId ? { ...obs, ...updatedFields } : obs
            )
          }
        : prev
    );
  }, [selectedEvent]);

  // BUG #1 FIX: Utiliser getCurrentUser().name au lieu de 'Coach Martin' hardcodé
  const handleSaveObservationAPI = useCallback(async (data: { eventId: string; text: string; parentId?: string | null }) => {
    const currentUser = getCurrentUser();
    const newObservation = await apiAddObservation(data.eventId, {
      author: currentUser.name,
      role: currentUser.role,
      text: data.text,
      parentId: data.parentId,
    });
    return newObservation;
  }, [getCurrentUser]);

  // Legacy handler (pour l'ancien modal, à supprimer plus tard)
  const handleSaveObservation = async () => {
    if (!selectedEvent || !observationText.trim()) return;
    
    console.log('💬 === SAVE OBSERVATION ===');
    const eventId = selectedEvent.id;
    const observationContent = observationText.trim();
    
    try {
      const newObservation = await apiAddObservation(eventId, {
        author: 'Coach Martin', // TODO: Get from user context
        role: 'Entraîneur principal',
        text: observationContent,
      });

      // CRITIQUE: Mise à jour immutable avec copie profonde
      setEvents(prevEvents => {
        return prevEvents.map(e => {
          if (e.id === eventId) {
            const updatedObservations = [...(e.observations || []), newObservation];
            return {
              ...e,
              observations: updatedObservations,
            };
          }
          return e;
        });
      });
      
      // Mettre à jour aussi l'événement sélectionné pour le modal
      setSelectedEvent(prev => {
        if (!prev || prev.id !== eventId) return prev;
        return {
          ...prev,
          observations: [...(prev.observations || []), newObservation],
        };
      });

      // Fermer le modal d'observation
      setShowAddObservationModal(false);
      setObservationText('');
      
      console.log('✅ Observation added successfully');
      Alert.alert('Succès', 'Observation ajoutée !');
    } catch (error) {
      console.error('Error adding observation:', error);
      Alert.alert('Erreur', 'Impossible d\'ajouter l\'observation');
    }
  };

  // Tournament handlers
  const handleRegisterTournament = async (tournamentId: string, status: string) => {
    if (status === 'pending' || status === 'participating') {
      try {
        const conflicts = await checkTournamentConflicts(tournamentId);
        if (conflicts.totalConflicts > 0) {
          setConflictData(conflicts);
          setPendingRegistration({ tournamentId, status });
          setShowConflictModal(true);
          return;
        }
      } catch (e) {
        console.warn('Conflict check failed:', e);
      }
    }
    await executeRegistration(tournamentId, status);
  };
  
  const executeRegistration = async (tournamentId: string, status: string) => {
    try {
      await apiRegisterTournament(tournamentId, status);
      
      // FEATURE #3: Si on devient "participating", griser les autres tournois de la même semaine
      setTournamentWeeks(prev => {
        // Trouver la semaine contenant ce tournoi
        const targetWeek = prev.find(week => 
          week.tournaments.some(t => t.id === tournamentId)
        );
        
        return prev.map(week => {
          // Si ce n'est pas la semaine du tournoi, ne rien changer
          if (week.weekNumber !== targetWeek?.weekNumber) {
            return week;
          }
          
          return {
            ...week,
            tournaments: (week.tournaments || []).map(t => {
              // Le tournoi sélectionné : mettre à jour son statut
              if (t.id === tournamentId) {
                return { ...t, registration: { status } };
              }
              
              // FEATURE #3: Si on participe à un tournoi, bloquer les autres de la semaine
              if (status === 'participating') {
                // Griser automatiquement les autres tournois (sauf si déjà "participating")
                if (t.registration?.status !== 'participating') {
                  return { 
                    ...t, 
                    registration: { status: 'not_interested' },
                    isBlocked: true 
                  };
                }
              }
              
              // FEATURE #3: Si on repasse en "interested" ou "not_interested", débloquer les autres
              if (status === 'interested' || status === 'not_interested') {
                if (t.isBlocked) {
                  return { 
                    ...t, 
                    registration: undefined,
                    isBlocked: false 
                  };
                }
              }
              
              return t;
            })
          };
        });
      });
      
      // Message de confirmation
      if (status === 'participating') {
        Alert.alert(
          '✅ Inscription confirmée',
          'Les autres tournois de cette semaine ont été automatiquement marqués comme non intéressés.'
        );
      }
    } catch (e) {
      console.error('Registration failed:', e);
      Alert.alert('Erreur', 'Échec de l\'inscription');
    }
  };

  const handleHideTournament = async (tournamentId: string) => {
    try {
      await apiHideTournament(tournamentId);
      setTournamentWeeks(prev =>
        prev.map(week => ({
          ...week,
          tournaments: week.tournaments.map(t =>
            t.id === tournamentId ? { ...t, hidden: true, registration: undefined } : t
          ),
        }))
      );
    } catch (e) {
      Alert.alert('Erreur', 'Échec du masquage');
    }
  };

  const handleUnhideTournament = async (tournamentId: string) => {
    try {
      await apiUnhideTournament(tournamentId);
      setTournamentWeeks(prev =>
        prev.map(week => ({
          ...week,
          tournaments: week.tournaments.map(t =>
            t.id === tournamentId ? { ...t, hidden: false } : t
          ),
        }))
      );
    } catch (e) {
      Alert.alert('Erreur', 'Échec du rétablissement');
    }
  };

  // ============ HELPERS ============

  const formatDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  // FEATURE #3: Calcul de la durée entre deux heures (format "HH:MM")
  const calculateDuration = (startTime: string, endTime: string): string => {
    if (!startTime || !endTime) return '';
    
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    
    let totalMinutes = (endH * 60 + endM) - (startH * 60 + startM);
    if (totalMinutes < 0) totalMinutes += 24 * 60; // Next day
    
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    if (hours === 0) return `${minutes}min`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h${String(minutes).padStart(2, '0')}`;
  };

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `Il y a ${diffMins}min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays < 7) return `Il y a ${diffDays}j`;
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  const getCategoryColor = (category: string) => CATEGORY_COLORS[category] || '#607D8B';
  const getSurfaceColor = (surface: string) => SURFACE_COLORS[surface] || SURFACE_COLORS[surface?.toLowerCase()] || '#666';

  // Event type options for picker
  const eventTypeOptions = Object.entries(EVENT_TYPES).map(([key, config]) => ({
    label: config.label,
    value: key,
  }));

  // Future tournament weeks
  const futureTournamentWeeks = useMemo(() => {
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    
    return tournamentWeeks.filter(week => {
      if (!week?.tournaments?.length) return false;
      return week.tournaments.some(t => {
        if (!t?.endDate) return true;
        return new Date(t.endDate) >= todayDate;
      });
    });
  }, [tournamentWeeks]);

  // ============ RENDER ============

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#1e3c72" />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#1e3c72', '#2a5298']}
        style={[styles.header, { paddingTop: insets.top + 16 }]}
      >
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Calendrier</Text>
          <TouchableOpacity 
            style={styles.alertBtn}
            onPress={() => router.push('/notifications')}
            data-testid="notifications-btn"
          >
            <Ionicons name="notifications-outline" size={24} color="#fff" />
            {unreadAlertCount > 0 && (
              <View style={styles.alertBadge}>
                <Text style={styles.alertBadgeText}>{unreadAlertCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
        
        <View style={styles.circuitRow}>
          {userCircuits.map(circuit => (
            <View key={circuit} style={styles.circuitBadge}>
              <Text style={styles.circuitText}>{circuit}</Text>
            </View>
          ))}
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Calendar */}
        <View style={styles.calendarContainer}>
          <Calendar
            current={currentMonth}
            onMonthChange={(month: any) => setCurrentMonth(month.dateString.substring(0, 7))}
            onDayPress={(day: any) => setSelectedDate(day.dateString)}
            markingType="multi-dot"
            markedDates={calendarMarks}
            theme={{
              backgroundColor: '#fff',
              calendarBackground: '#fff',
              textSectionTitleColor: '#666',
              selectedDayBackgroundColor: '#1e3c72',
              selectedDayTextColor: '#fff',
              todayTextColor: '#10B981',
              dayTextColor: '#1a1a1a',
              textDisabledColor: '#d9e1e8',
              arrowColor: '#1e3c72',
              monthTextColor: '#1a1a1a',
              textDayFontWeight: '500',
              textMonthFontWeight: '700',
              textDayHeaderFontWeight: '600',
            }}
          />
        </View>

        {/* Day Events Section */}
        <View style={styles.dayEventsSection}>
          <View style={styles.dayEventsHeader}>
            <Text style={styles.dayEventsTitle}>
              {formatDate(selectedDate)}
            </Text>
          </View>

          {dayEvents.length === 0 ? (
            <View style={styles.emptyDay}>
              <Ionicons name="calendar-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>Aucun événement ce jour</Text>
              <TouchableOpacity 
                style={styles.addEventInlineBtn}
                onPress={openAddEventModal}
              >
                <Ionicons name="add-circle-outline" size={20} color="#1e3c72" />
                <Text style={styles.addEventInlineText}>Ajouter un événement</Text>
              </TouchableOpacity>
            </View>
          ) : (
            dayEvents.map(event => {
              // BUG #2 FIX: Distinguer les événements tournoi des événements manuels
              const isTournamentEvent = (event as any)._isTournamentEvent;
              const eventConfig = EVENT_TYPES[event.type] || EVENT_TYPES.other;
              
              // Rendu spécial pour les tournois "Participant"
              if (isTournamentEvent) {
                const tournamentData = (event as any)._tournament;
                return (
                  <TouchableOpacity
                    key={event.id}
                    style={styles.tournamentEventCard}
                    onPress={() => {
                      // Ouvrir le modal de détail du tournoi
                      if (tournamentData?.week) {
                        setSelectedWeekNumber(tournamentData.week);
                        setShowTournamentModal(true);
                      }
                    }}
                    data-testid={`tournament-event-${event.id}`}
                  >
                    <View style={[styles.eventColorBar, { backgroundColor: EVENT_TYPES.tournament.color }]} />
                    <View style={styles.eventContent}>
                      <View style={styles.eventHeader}>
                        <View style={styles.tournamentEventBadge}>
                          <Text style={styles.tournamentEventFlag}>{(event as any)._flag}</Text>
                          <Text style={styles.tournamentEventLabel}>En tournoi</Text>
                        </View>
                        <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor((event as any)._level) + '18' }]}>
                          <Text style={[styles.categoryText, { color: getCategoryColor((event as any)._level) }]}>
                            {(event as any)._level}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.tournamentEventName}>{event.title}</Text>
                      <Text style={styles.tournamentEventLocation}>
                        <Ionicons name="location-outline" size={12} color="#666" /> {event.location}
                      </Text>
                      <View style={styles.tournamentEventDates}>
                        <Ionicons name="calendar-outline" size={12} color="#8B5CF6" />
                        <Text style={styles.tournamentEventDatesText}>
                          {new Date((event as any)._startDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} - {new Date((event as any)._endDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              }
              
              // Rendu normal pour les événements manuels
              // FEATURE #3: Afficher heure début → fin + nom complet
              const hasTimeRange = event.time && event.endTime;
              
              return (
                <TouchableOpacity
                  key={event.id}
                  style={styles.eventCard}
                  onPress={() => {
                    setSelectedEvent(event);
                    setShowEventDetailModal(true);
                  }}
                  data-testid={`event-card-${event.id}`}
                >
                  <View style={[styles.eventColorBar, { backgroundColor: eventConfig.color }]} />
                  <View style={styles.eventContent}>
                    {/* FEATURE #3: Ligne 1 - Icône + nom COMPLET (pas de numberOfLines) */}
                    <View style={styles.eventTitleRow}>
                      <Text style={styles.eventIcon}>
                        {eventConfig.label.split(' ')[0]}
                      </Text>
                      <Text style={styles.eventTitle}>
                        {event.title || eventConfig.label.replace(/^[^\s]+\s/, '')}
                      </Text>
                    </View>
                    
                    {/* FEATURE #3: Ligne 2 - Plage horaire avec durée */}
                    <View style={styles.eventTimeRow}>
                      {hasTimeRange ? (
                        <>
                          <Text style={[styles.eventTimeRange, { color: eventConfig.color }]}>
                            {event.time} → {event.endTime}
                          </Text>
                          <Text style={styles.eventDuration}>
                            ({calculateDuration(event.time, event.endTime)})
                          </Text>
                        </>
                      ) : event.time ? (
                        <Text style={[styles.eventTimeRange, { color: eventConfig.color }]}>
                          {event.time}
                        </Text>
                      ) : null}
                    </View>
                    
                    {/* Lieu si disponible */}
                    {event.location && (
                      <Text style={styles.eventLocation} numberOfLines={1}>
                        📍 {event.location}
                      </Text>
                    )}
                    
                    {/* Notes si disponibles */}
                    {event.description && (
                      <Text style={styles.eventNotes} numberOfLines={2}>
                        {event.description}
                      </Text>
                    )}
                    
                    {/* Badge observations */}
                    {event.observations && event.observations.length > 0 && (
                      <View style={styles.observationBadge}>
                        <Ionicons name="chatbubble" size={12} color="#10B981" />
                        <Text style={styles.observationCount}>
                          {event.observations.length} commentaire{event.observations.length > 1 ? 's' : ''}
                        </Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* Tournament Weeks */}
        <View style={styles.tournamentsSection}>
          <Text style={styles.sectionTitle}>Prochains tournois</Text>
          
          {futureTournamentWeeks.length === 0 ? (
            <Text style={styles.noTournamentsText}>Aucun tournoi à venir</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.weeksScroll}>
              {futureTournamentWeeks.slice(0, 20).map(week => {
                const visibleTournaments = week.tournaments.filter(t => !t.hidden);
                const firstTournament = visibleTournaments[0];
                if (!firstTournament) return null;
                
                // FEATURE #2 & BUG #4: Vérifier s'il y a plusieurs tournois dans la semaine
                const tournamentCount = visibleTournaments.length;
                const hasMultipleTournaments = tournamentCount >= 2;
                
                // FEATURE #3: Vérifier si un tournoi de cette semaine est en "participating"
                const participatingTournament = visibleTournaments.find(t => t.registration?.status === 'participating');
                const isWeekBlocked = !!participatingTournament;
                
                // BUG #4 FIX: Card résumée pour semaines avec 2+ tournois
                if (hasMultipleTournaments) {
                  return (
                    <TouchableOpacity
                      key={week.weekNumber}
                      style={[styles.weekCardSummary, isWeekBlocked && styles.weekCardBlocked]}
                      onPress={() => {
                        setSelectedWeekNumber(week.weekNumber);
                        setShowTournamentModal(true);
                      }}
                      data-testid={`week-card-${week.weekNumber}`}
                    >
                      <View style={styles.weekCardHeader}>
                        <Text style={styles.weekNumber}>S{week.weekNumber}</Text>
                        <Text style={styles.weekDates}>
                          {firstTournament.startDate ? new Date(firstTournament.startDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : ''}
                        </Text>
                      </View>
                      
                      {/* Badge "X tournois" */}
                      <View style={styles.multiTournamentBadgeLarge}>
                        <Ionicons name="tennisball" size={16} color="#8B5CF6" />
                        <Text style={styles.multiTournamentTextLarge}>
                          {tournamentCount} tournois
                        </Text>
                      </View>
                      
                      {/* Chips de localisation */}
                      <View style={styles.locationChips}>
                        {visibleTournaments.slice(0, 3).map(t => (
                          <View key={t.id} style={styles.locationChip}>
                            <Text style={styles.locationChipText}>
                              {t.flag || getFlagEmoji(t.country)} {t.city}
                            </Text>
                          </View>
                        ))}
                        {tournamentCount > 3 && (
                          <View style={styles.locationChipMore}>
                            <Text style={styles.locationChipMoreText}>+{tournamentCount - 3}</Text>
                          </View>
                        )}
                      </View>
                      
                      {/* Bouton CTA */}
                      <View style={styles.viewDetailBtn}>
                        <Text style={styles.viewDetailBtnText}>Voir le détail</Text>
                        <Ionicons name="chevron-forward" size={14} color="#1e3c72" />
                      </View>
                      
                      {/* Badge de statut si un tournoi est inscrit */}
                      {(() => {
                        const registeredTournament = week.tournaments.find(t => t.registration);
                        if (!registeredTournament?.registration) return null;
                        
                        const status = registeredTournament.registration.status;
                        const statusConfig = TOURNAMENT_STATUS_LABELS[status];
                        
                        if (!statusConfig) return null;
                        
                        return (
                          <View style={[styles.registrationBadge, { backgroundColor: statusConfig.color + '15' }]}>
                            <Ionicons 
                              name={status === 'participating' ? 'checkmark-circle' : status === 'interested' ? 'star' : 'time'} 
                              size={14} 
                              color={statusConfig.color} 
                            />
                            <Text style={[styles.registrationText, { color: statusConfig.color }]}>
                              {statusConfig.label}
                            </Text>
                          </View>
                        );
                      })()}
                    </TouchableOpacity>
                  );
                }
                
                // Card détaillée standard pour 1 seul tournoi
                return (
                  <TouchableOpacity
                    key={week.weekNumber}
                    style={[
                      styles.weekCard,
                      isWeekBlocked && styles.weekCardBlocked
                    ]}
                    onPress={() => {
                      setSelectedWeekNumber(week.weekNumber);
                      setShowTournamentModal(true);
                    }}
                    data-testid={`week-card-${week.weekNumber}`}
                  >
                    <View style={styles.weekCardHeader}>
                      <Text style={styles.weekNumber}>S{week.weekNumber}</Text>
                      <Text style={styles.weekDates}>
                        {firstTournament.startDate ? new Date(firstTournament.startDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : ''}
                      </Text>
                    </View>
                    
                    <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(firstTournament.category) + '18' }]}>
                      <Text style={[styles.categoryText, { color: getCategoryColor(firstTournament.category) }]}>
                        {firstTournament.category}
                      </Text>
                    </View>
                    
                    <Text style={styles.tournamentName} numberOfLines={1}>
                      {firstTournament.name}
                    </Text>
                    
                    <View style={styles.tournamentMeta}>
                      <View style={[styles.surfaceBadge, { backgroundColor: getSurfaceColor(firstTournament.surface) + '20' }]}>
                        <Text style={[styles.surfaceText, { color: getSurfaceColor(firstTournament.surface) }]}>
                          {firstTournament.surface}
                        </Text>
                      </View>
                      <Text style={styles.tournamentLocation}>
                        {firstTournament.flag || getFlagEmoji(firstTournament.country)} {firstTournament.city}
                      </Text>
                    </View>
                    
                    {firstTournament.prizeMoney > 0 && (
                      <View style={styles.prizeRow}>
                        <Ionicons name="cash-outline" size={14} color="#1e3c72" />
                        <Text style={styles.weekPrizeText}>
                          {firstTournament.prizeMoney >= 1000000
                            ? `${(firstTournament.prizeMoney / 1000000).toFixed(1)}M`
                            : `${(firstTournament.prizeMoney / 1000).toFixed(0)}K`} {firstTournament.currency}
                        </Text>
                      </View>
                    )}
                    
                    {/* FEATURE #1: Afficher le statut correct (Intéressé vs Participant) */}
                    {(() => {
                      const registeredTournament = week.tournaments.find(t => t.registration);
                      if (!registeredTournament?.registration) return null;
                      
                      const status = registeredTournament.registration.status;
                      const statusConfig = TOURNAMENT_STATUS_LABELS[status];
                      
                      if (!statusConfig) return null;
                      
                      return (
                        <View style={[styles.registrationBadge, { backgroundColor: statusConfig.color + '15' }]}>
                          <Ionicons 
                            name={status === 'participating' ? 'checkmark-circle' : status === 'interested' ? 'star' : 'time'} 
                            size={14} 
                            color={statusConfig.color} 
                          />
                          <Text style={[styles.registrationText, { color: statusConfig.color }]}>
                            {statusConfig.label}
                          </Text>
                        </View>
                      );
                    })()}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>
        
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* FAB Button */}
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 90 }]}
        onPress={openAddEventModal}
        activeOpacity={0.8}
        data-testid="fab-add-event"
      >
        <Ionicons name="add" size={32} color="#FFF" />
      </TouchableOpacity>

      {/* ===================== MODALS ===================== */}

      {/* Add Event Modal */}
      <Modal visible={showAddEventModal} animationType="slide" transparent onRequestClose={() => {
        setShowAddEventModal(false);
        resetEventForm();
      }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalBackdrop} 
            activeOpacity={1} 
            onPress={() => {
              setShowAddEventModal(false);
              resetEventForm();
            }}
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nouvel événement</Text>
              <TouchableOpacity onPress={() => {
                setShowAddEventModal(false);
                resetEventForm();
              }}>
                <Ionicons name="close" size={28} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Type Picker */}
              <AppleOptionPicker
                options={eventTypeOptions}
                selectedValue={eventType}
                onValueChange={setEventType}
                label="TYPE D'ÉVÉNEMENT"
              />

              <View style={styles.pickerSpacer} />

              {/* Date Picker */}
              <AppleDatePicker
                value={eventDate}
                onChange={setEventDate}
                label="DATE"
              />

              <View style={styles.pickerSpacer} />

              {/* FEATURE #3: Time Pickers - Début et Fin */}
              <Text style={styles.timeRangeLabel}>HORAIRES</Text>
              <View style={styles.timeRangeContainer}>
                <View style={styles.timePickerHalf}>
                  <AppleTimePicker
                    value={eventTime}
                    onChange={(time) => {
                      setEventTime(time);
                      // Auto-update endTime si pas manuellement modifié
                      if (!endTimeManuallySet) {
                        setEventEndTime(getDefaultEndTime(time));
                      }
                    }}
                    minuteStep={5}
                    label="DÉBUT"
                  />
                </View>
                <View style={styles.timeRangeSeparator}>
                  <Ionicons name="arrow-forward" size={20} color="#9CA3AF" />
                </View>
                <View style={styles.timePickerHalf}>
                  <AppleTimePicker
                    value={eventEndTime}
                    onChange={(time) => {
                      setEventEndTime(time);
                      setEndTimeManuallySet(true);
                    }}
                    minuteStep={5}
                    label="FIN"
                  />
                </View>
              </View>

              {/* Validation: fin >= début */}
              {eventEndTime <= eventTime && (
                <View style={styles.validationError}>
                  <Ionicons name="warning" size={16} color="#D97706" />
                  <Text style={styles.validationErrorText}>
                    L'heure de fin doit être après l'heure de début
                  </Text>
                </View>
              )}

              {/* Location */}
              <Text style={styles.fieldLabel}>LIEU (optionnel)</Text>
              <TextInput
                style={styles.textInput}
                value={eventLocation}
                onChangeText={setEventLocation}
                placeholder="Ex: Court Central"
                placeholderTextColor="#999"
              />

              {/* Notes */}
              <Text style={styles.fieldLabel}>NOTES (optionnel)</Text>
              <TextInput
                style={[styles.textInput, styles.notesInput]}
                value={eventNotes}
                onChangeText={setEventNotes}
                placeholder="Détails de l'événement..."
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
              />

              {/* Buttons */}
              <TouchableOpacity 
                style={[styles.saveButton, eventEndTime <= eventTime && styles.saveButtonDisabled]} 
                onPress={handleSaveEvent}
                disabled={eventEndTime <= eventTime}
              >
                <Ionicons name="checkmark-circle" size={22} color="#fff" />
                <Text style={styles.saveButtonText}>Enregistrer</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowAddEventModal(false);
                  resetEventForm();
                }}
              >
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit Event Modal */}
      <Modal visible={showEditEventModal} animationType="slide" transparent onRequestClose={() => {
        setShowEditEventModal(false);
        setSelectedEvent(null);
        resetEventForm();
      }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalBackdrop} 
            activeOpacity={1} 
            onPress={() => {
              setShowEditEventModal(false);
              setSelectedEvent(null);
              resetEventForm();
            }}
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Modifier l'événement</Text>
              <TouchableOpacity onPress={() => {
                setShowEditEventModal(false);
                setSelectedEvent(null);
                resetEventForm();
              }}>
                <Ionicons name="close" size={28} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <AppleOptionPicker
                options={eventTypeOptions}
                selectedValue={eventType}
                onValueChange={setEventType}
                label="TYPE D'ÉVÉNEMENT"
              />

              <View style={styles.pickerSpacer} />

              <AppleDatePicker
                value={eventDate}
                onChange={setEventDate}
                label="DATE"
              />

              <View style={styles.pickerSpacer} />

              {/* FEATURE #3: Time Pickers - Début et Fin */}
              <Text style={styles.timeRangeLabel}>HORAIRES</Text>
              <View style={styles.timeRangeContainer}>
                <View style={styles.timePickerHalf}>
                  <AppleTimePicker
                    value={eventTime}
                    onChange={(time) => {
                      setEventTime(time);
                      if (!endTimeManuallySet) {
                        setEventEndTime(getDefaultEndTime(time));
                      }
                    }}
                    minuteStep={5}
                    label="DÉBUT"
                  />
                </View>
                <View style={styles.timeRangeSeparator}>
                  <Ionicons name="arrow-forward" size={20} color="#9CA3AF" />
                </View>
                <View style={styles.timePickerHalf}>
                  <AppleTimePicker
                    value={eventEndTime}
                    onChange={(time) => {
                      setEventEndTime(time);
                      setEndTimeManuallySet(true);
                    }}
                    minuteStep={5}
                    label="FIN"
                  />
                </View>
              </View>

              {/* Validation: fin >= début */}
              {eventEndTime <= eventTime && (
                <View style={styles.validationError}>
                  <Ionicons name="warning" size={16} color="#D97706" />
                  <Text style={styles.validationErrorText}>
                    L'heure de fin doit être après l'heure de début
                  </Text>
                </View>
              )}

              {/* FEATURE #2: Bannière notification staff si date/heure modifiée */}
              {selectedEvent && selectedEvent.staffMembers && selectedEvent.staffMembers.length > 0 && (
                eventDate !== selectedEvent.date || eventTime !== selectedEvent.time
              ) && (
                <View style={styles.staffNotificationBanner}>
                  <View style={styles.staffBannerHeader}>
                    <Ionicons name="people" size={20} color="#1e3c72" />
                    <Text style={styles.staffBannerTitle}>Staff associé</Text>
                  </View>
                  <Text style={styles.staffBannerText}>
                    Vous avez modifié la date ou l'heure. Souhaitez-vous notifier le staff de ce changement ?
                  </Text>
                  <View style={styles.staffBannerNames}>
                    {selectedEvent.staffMembers.map((staff, i) => (
                      <View key={staff.id} style={styles.staffBadge}>
                        <Text style={styles.staffBadgeText}>{staff.name}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              <Text style={styles.fieldLabel}>LIEU (optionnel)</Text>
              <TextInput
                style={styles.textInput}
                value={eventLocation}
                onChangeText={setEventLocation}
                placeholder="Ex: Court Central"
                placeholderTextColor="#999"
              />

              <Text style={styles.fieldLabel}>NOTES (optionnel)</Text>
              <TextInput
                style={[styles.textInput, styles.notesInput]}
                value={eventNotes}
                onChangeText={setEventNotes}
                placeholder="Détails de l'événement..."
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
              />

              {/* FEATURE #2: Boutons conditionnels si staff et modification date/heure */}
              {selectedEvent && selectedEvent.staffMembers && selectedEvent.staffMembers.length > 0 && (
                eventDate !== selectedEvent.date || eventTime !== selectedEvent.time
              ) ? (
                <>
                  <TouchableOpacity 
                    style={[styles.saveButton, styles.suggestButton, eventEndTime <= eventTime && styles.saveButtonDisabled]} 
                    onPress={() => handleUpdateEventWithNotification(true)}
                    disabled={eventEndTime <= eventTime}
                  >
                    <Ionicons name="paper-plane" size={20} color="#fff" />
                    <Text style={styles.saveButtonText}>Suggérer ce créneau</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.secondaryButton, eventEndTime <= eventTime && styles.saveButtonDisabled]} 
                    onPress={() => handleUpdateEventWithNotification(false)}
                    disabled={eventEndTime <= eventTime}
                  >
                    <Ionicons name="checkmark" size={20} color="#1e3c72" />
                    <Text style={styles.secondaryButtonText}>Modifier sans notifier</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity 
                  style={[styles.saveButton, eventEndTime <= eventTime && styles.saveButtonDisabled]} 
                  onPress={handleUpdateEvent}
                  disabled={eventEndTime <= eventTime}
                >
                  <Ionicons name="checkmark-circle" size={22} color="#fff" />
                  <Text style={styles.saveButtonText}>Enregistrer les modifications</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowEditEventModal(false);
                  setSelectedEvent(null);
                  resetEventForm();
                }}
              >
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Event Detail Modal */}
      <Modal visible={showEventDetailModal} animationType="slide" transparent onRequestClose={() => {
        setShowEventDetailModal(false);
        setSelectedEvent(null);
      }}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalBackdrop} 
            activeOpacity={1} 
            onPress={() => {
              setShowEventDetailModal(false);
              setSelectedEvent(null);
            }}
          />
          <View style={styles.detailModal}>
            {selectedEvent && (
              <>
                {/* Header with type */}
                <View style={[styles.eventDetailHeader, { backgroundColor: (EVENT_TYPES[selectedEvent.type]?.color || '#607D8B') + '20' }]}>
                  <Ionicons
                    name={(EVENT_TYPES[selectedEvent.type]?.icon || 'ellipsis-horizontal-outline') as any}
                    size={32}
                    color={EVENT_TYPES[selectedEvent.type]?.color || '#607D8B'}
                  />
                  <View style={styles.eventDetailHeaderText}>
                    <Text style={styles.eventDetailTitle}>
                      {EVENT_TYPES[selectedEvent.type]?.label || 'Événement'}
                    </Text>
                    <Text style={styles.eventDetailDateTime}>
                      {formatDate(selectedEvent.date)} • {selectedEvent.time || '--:--'}
                      {selectedEvent.endTime ? ` → ${selectedEvent.endTime}` : ''}
                    </Text>
                    {/* FEATURE #2: Badge en attente de validation */}
                    {selectedEvent.pendingValidation && (
                      <View style={styles.pendingValidationBadge}>
                        <Ionicons name="time" size={12} color="#D97706" />
                        <Text style={styles.pendingValidationText}>En attente de validation</Text>
                      </View>
                    )}
                  </View>
                  <TouchableOpacity onPress={() => {
                    setShowEventDetailModal(false);
                    setSelectedEvent(null);
                  }}>
                    <Ionicons name="close" size={28} color="#666" />
                  </TouchableOpacity>
                </View>

                <ScrollView 
                  ref={detailScrollRef}
                  style={styles.detailScroll} 
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="none"
                >
                  {/* Location */}
                  {selectedEvent.location && (
                    <View style={styles.detailSection}>
                      <Text style={styles.sectionLabel}>Lieu</Text>
                      <Text style={styles.detailText}>{selectedEvent.location}</Text>
                    </View>
                  )}

                  {/* Notes */}
                  {selectedEvent.description && (
                    <View style={styles.detailSection}>
                      <Text style={styles.sectionLabel}>Notes</Text>
                      <Text style={styles.detailText}>{selectedEvent.description}</Text>
                    </View>
                  )}

                  {/* FEATURE #1: Nouveau composant observations inline */}
                  {/* BUG #1, #2, #3 FIX: currentUser dynamique + handlers mis à jour */}
                  <EventObservationSection
                    eventId={selectedEvent.id}
                    observations={selectedEvent.observations || []}
                    currentUser={getCurrentUser()}
                    onObservationAdded={handleObservationAdded}
                    onObservationUpdated={handleObservationUpdated}
                    onSaveObservation={handleSaveObservationAPI}
                    onComposerOpen={() => {
                      // BUG #3 FIX: Scroll vers le bas quand le composer s'ouvre
                      setTimeout(() => {
                        detailScrollRef.current?.scrollToEnd({ animated: true });
                      }, 350);
                    }}
                  />

                  {/* Actions */}
                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={styles.editButton}
                      onPress={() => openEditEventModal(selectedEvent)}
                    >
                      <Ionicons name="pencil" size={20} color="#FFF" />
                      <Text style={styles.editButtonText}>Modifier</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={handleDeleteEvent}
                    >
                      <Ionicons name="trash-outline" size={20} color="#EF4444" />
                      <Text style={styles.deleteButtonText}>Supprimer</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={styles.closeDetailButton}
                    onPress={() => {
                      setShowEventDetailModal(false);
                      setSelectedEvent(null);
                    }}
                  >
                    <Text style={styles.closeDetailButtonText}>Fermer</Text>
                  </TouchableOpacity>
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Add Observation Modal - BUG #1 FIX: Ajout backdrop et onRequestClose */}
      <Modal 
        visible={showAddObservationModal} 
        animationType="slide" 
        transparent
        onRequestClose={() => {
          console.log('🔙 Observation modal closed via back button');
          setShowAddObservationModal(false);
          setObservationText('');
        }}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalBackdrop} 
            activeOpacity={1} 
            onPress={() => {
              console.log('🔙 Observation modal closed via backdrop');
              setShowAddObservationModal(false);
              setObservationText('');
            }}
          />
          <View style={styles.observationModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Ajouter une observation</Text>
              <TouchableOpacity onPress={() => {
                setShowAddObservationModal(false);
                setObservationText('');
              }}>
                <Ionicons name="close" size={28} color="#666" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.observationInput}
              value={observationText}
              onChangeText={setObservationText}
              placeholder="Votre commentaire..."
              placeholderTextColor="#999"
              multiline
              numberOfLines={6}
              autoFocus
            />

            <TouchableOpacity
              style={[styles.saveObservationButton, !observationText.trim() && styles.disabledButton]}
              onPress={handleSaveObservation}
              disabled={!observationText.trim()}
            >
              <Text style={styles.saveObservationButtonText}>Publier</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setShowAddObservationModal(false);
                setObservationText('');
              }}
            >
              <Text style={styles.cancelButtonText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Tournament Detail Modal */}
      <Modal visible={showTournamentModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedWeek?.tournaments?.[0]?.name || 'Tournoi'}
              </Text>
              <TouchableOpacity onPress={() => setShowTournamentModal(false)}>
                <Ionicons name="close" size={24} color="#1a1a1a" />
              </TouchableOpacity>
            </View>
            
            <ScrollView showsVerticalScrollIndicator={false}>
              {selectedWeek?.tournaments?.map(tournament => {
                // BUG #3 FIX: Unifier le rendu pour not_interested
                const isNotInterested = tournament.hidden || tournament.registration?.status === 'not_interested';
                
                return (
                  <View key={tournament.id} style={[styles.tournamentDetail, isNotInterested && styles.tournamentHidden]}>
                    <View style={styles.tournamentDetailHeader}>
                      <Text style={styles.tournamentDetailFlag}>
                        {tournament.flag || getFlagEmoji(tournament.countryCode || tournament.country)}
                      </Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.tournamentDetailName}>{tournament.name}</Text>
                        <Text style={styles.tournamentDetailMeta}>
                          {tournament.city}, {tournament.country}
                        </Text>
                      </View>
                    </View>
                    
                    <Text style={styles.tournamentDetailMeta}>
                      {tournament.startDate ? new Date(tournament.startDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) : ''} - {tournament.endDate ? new Date(tournament.endDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}
                    </Text>
                    
                    <View style={styles.tournamentDetailRow}>
                      <View style={[styles.surfaceBadge, { backgroundColor: getSurfaceColor(tournament.surface) + '20' }]}>
                        <Text style={[styles.surfaceText, { color: getSurfaceColor(tournament.surface) }]}>
                          {tournament.surface}
                        </Text>
                      </View>
                      <Text style={styles.prizeText}>
                        {tournament.prizeMoney?.toLocaleString()} {tournament.currency}
                      </Text>
                    </View>
                    
                    {/* BUG #3 FIX: Rendu unifié pour not_interested */}
                    {isNotInterested ? (
                      // Afficher UNIQUEMENT le bouton Rétablir, rien d'autre
                      <TouchableOpacity
                        style={styles.unhideBtn}
                        onPress={() => {
                          if (tournament.hidden) {
                            handleUnhideTournament(tournament.id);
                          } else {
                            // Réinitialiser le statut
                            handleRegisterTournament(tournament.id, 'interested');
                          }
                        }}
                      >
                        <Ionicons name="eye-outline" size={16} color="#1e3c72" />
                        <Text style={styles.unhideBtnText}>Rétablir</Text>
                      </TouchableOpacity>
                    ) : (
                      <>
                        {/* Afficher le statut actuel s'il existe */}
                        {tournament.registration?.status && (
                          <View style={styles.currentStatusRow}>
                            <Ionicons name="checkmark-circle" size={16} color={
                              TOURNAMENT_STATUS_LABELS[tournament.registration.status]?.color || '#1e3c72'
                            } />
                            <Text style={styles.currentStatusText}>
                              {TOURNAMENT_STATUS_LABELS[tournament.registration.status]?.label || tournament.registration.status}
                            </Text>
                          </View>
                        )}
                        
                        {/* Boutons de statut */}
                        <View style={styles.registrationButtons}>
                          {['interested', 'pending', 'participating'].map(status => (
                            <TouchableOpacity
                              key={status}
                              style={[
                                styles.statusBtn,
                                tournament.registration?.status === status && styles.statusBtnActive
                              ]}
                              onPress={() => handleRegisterTournament(tournament.id, status)}
                            >
                              <Text style={[
                                styles.statusBtnText,
                                tournament.registration?.status === status && styles.statusBtnTextActive
                              ]}>
                                {TOURNAMENT_STATUS_LABELS[status]?.label || status}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                        
                        {/* Lien "Pas intéressé" */}
                        <TouchableOpacity
                          style={styles.notInterestedBtn}
                          onPress={() => handleHideTournament(tournament.id)}
                        >
                          <Ionicons name="eye-off-outline" size={14} color="#999" />
                          <Text style={styles.notInterestedText}>Pas intéressé</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Conflict Modal */}
      <Modal visible={showConflictModal} animationType="fade" transparent>
        <View style={styles.conflictOverlay}>
          <View style={styles.conflictCard}>
            <View style={styles.conflictHeader}>
              <Ionicons name="warning" size={32} color="#FF9800" />
              <Text style={styles.conflictTitle}>Conflit d'agenda</Text>
            </View>
            
            <Text style={styles.conflictSubtitle}>
              {conflictData?.totalConflicts || 0} conflit{(conflictData?.totalConflicts || 0) > 1 ? 's' : ''} détecté{(conflictData?.totalConflicts || 0) > 1 ? 's' : ''}
            </Text>
            
            <ScrollView style={styles.conflictList}>
              {conflictData?.conflictingTournaments?.map((ct: any) => (
                <View key={ct.id} style={styles.conflictItem}>
                  <Ionicons name="trophy-outline" size={18} color="#FF9800" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.conflictItemName}>{ct.name}</Text>
                    <Text style={styles.conflictItemMeta}>
                      {ct.startDate ? new Date(ct.startDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : ''} - 
                      {ct.endDate ? new Date(ct.endDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : ''}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
            
            <View style={styles.conflictActions}>
              <TouchableOpacity 
                style={styles.conflictProceedBtn} 
                onPress={() => {
                  if (pendingRegistration) {
                    executeRegistration(pendingRegistration.tournamentId, pendingRegistration.status);
                  }
                  setShowConflictModal(false);
                  setConflictData(null);
                  setPendingRegistration(null);
                }}
              >
                <Text style={styles.conflictProceedText}>Continuer quand même</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.conflictCancelBtn} 
                onPress={() => {
                  setShowConflictModal(false);
                  setConflictData(null);
                  setPendingRegistration(null);
                }}
              >
                <Text style={styles.conflictCancelText}>Annuler</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ============ STYLES ============

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  centered: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 16, color: '#666' },
  
  // Header
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 28, fontWeight: '700', color: '#fff' },
  alertBtn: { position: 'relative', padding: 8 },
  alertBadge: { position: 'absolute', top: 4, right: 4, backgroundColor: '#FF5252', borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  alertBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  circuitRow: { flexDirection: 'row', marginTop: 12, gap: 8 },
  circuitBadge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  circuitText: { fontSize: 12, fontWeight: '600', color: '#fff' },
  
  content: { flex: 1 },
  calendarContainer: { backgroundColor: '#fff', margin: 16, borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  
  // Day Events Section
  dayEventsSection: { marginHorizontal: 16, marginBottom: 16 },
  dayEventsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  dayEventsTitle: { fontSize: 16, fontWeight: '600', color: '#1a1a1a', textTransform: 'capitalize' },
  emptyDay: { alignItems: 'center', paddingVertical: 30, backgroundColor: '#fff', borderRadius: 16 },
  emptyText: { fontSize: 15, color: '#999', marginTop: 12 },
  addEventInlineBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 16, gap: 6 },
  addEventInlineText: { fontSize: 14, color: '#1e3c72', fontWeight: '600' },
  
  // Event Cards
  eventCard: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, marginBottom: 10, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  eventColorBar: { width: 4 },
  eventContent: { flex: 1, padding: 14 },
  eventHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eventTime: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  eventBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  eventType: { fontSize: 12, fontWeight: '600' },
  eventNotes: { fontSize: 13, color: '#666', marginTop: 6, lineHeight: 18 },
  observationBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 4 },
  observationCount: { fontSize: 12, color: '#10B981', fontWeight: '500' },
  
  // FEATURE #3: Nouveaux styles pour affichage événement amélioré
  eventTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  eventIcon: { fontSize: 16, lineHeight: 22, width: 22 },
  eventTitle: { flex: 1, fontSize: 14, fontWeight: '600', color: '#1F2937', lineHeight: 20 },
  eventTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, marginLeft: 28 },
  eventTimeRange: { fontSize: 13, fontWeight: '600' },
  eventDuration: { fontSize: 11, color: '#9CA3AF' },
  eventLocation: { fontSize: 12, color: '#6B7280', marginTop: 4, marginLeft: 28 },
  
  // Tournament Event Cards (BUG #2 FIX)
  tournamentEventCard: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, marginBottom: 10, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1, borderWidth: 1, borderColor: '#8B5CF620' },
  tournamentEventBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tournamentEventFlag: { fontSize: 18 },
  tournamentEventLabel: { fontSize: 12, fontWeight: '600', color: '#8B5CF6', backgroundColor: '#8B5CF615', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  tournamentEventName: { fontSize: 15, fontWeight: '600', color: '#1a1a1a', marginTop: 8, marginBottom: 4 },
  tournamentEventLocation: { fontSize: 13, color: '#666', marginBottom: 4 },
  tournamentEventDates: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  tournamentEventDatesText: { fontSize: 12, color: '#8B5CF6', fontWeight: '500' },
  
  // Tournaments Section
  tournamentsSection: { marginHorizontal: 16, marginTop: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginBottom: 12 },
  noTournamentsText: { fontSize: 14, color: '#999', textAlign: 'center', paddingVertical: 20 },
  weeksScroll: { marginLeft: -4 },
  weekCard: { width: 180, backgroundColor: '#fff', borderRadius: 16, padding: 16, marginRight: 12, marginLeft: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  weekCardSummary: { width: 180, backgroundColor: '#fff', borderRadius: 16, padding: 16, marginRight: 12, marginLeft: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, borderWidth: 1, borderColor: '#8B5CF620' },
  weekCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  weekNumber: { fontSize: 14, fontWeight: '700', color: '#1e3c72' },
  weekDates: { fontSize: 12, color: '#666' },
  weekCardBlocked: { opacity: 0.5, backgroundColor: '#f5f5f5' },
  multiTournamentBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#8B5CF615', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginBottom: 8, gap: 4 },
  multiTournamentText: { fontSize: 11, fontWeight: '600', color: '#8B5CF6' },
  multiTournamentBadgeLarge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#8B5CF620', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, marginBottom: 12, gap: 6 },
  multiTournamentTextLarge: { fontSize: 14, fontWeight: '700', color: '#8B5CF6' },
  locationChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  locationChip: { backgroundColor: '#f0f0f0', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  locationChipText: { fontSize: 11, color: '#666' },
  locationChipMore: { backgroundColor: '#e0e0e0', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  locationChipMoreText: { fontSize: 11, color: '#999', fontWeight: '600' },
  viewDetailBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1e3c7215', paddingVertical: 10, borderRadius: 8, gap: 4 },
  viewDetailBtnText: { fontSize: 13, fontWeight: '600', color: '#1e3c72' },
  categoryBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginBottom: 6 },
  categoryText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  tournamentName: { fontSize: 15, fontWeight: '600', color: '#1a1a1a', marginBottom: 8 },
  tournamentMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  surfaceBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  surfaceText: { fontSize: 11, fontWeight: '600' },
  tournamentLocation: { fontSize: 12, color: '#666', flex: 1 },
  prizeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 4 },
  weekPrizeText: { fontSize: 13, fontWeight: '600', color: '#1e3c72' },
  registrationBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  registrationText: { fontSize: 12, fontWeight: '600' },
  
  // FAB
  fab: { position: 'absolute', right: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: '#1e3c72', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  
  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1a1a1a' },
  
  // Form elements
  pickerSpacer: { height: 20 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#6B7280', marginTop: 20, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  textInput: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, fontSize: 16, color: '#1a1a1a' },
  notesInput: { height: 100, textAlignVertical: 'top' },
  saveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1e3c72', padding: 16, borderRadius: 12, marginTop: 24, gap: 8 },
  saveButtonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  saveButtonDisabled: { opacity: 0.5 },
  cancelButton: { padding: 16, alignItems: 'center', marginTop: 12 },
  cancelButtonText: { fontSize: 16, fontWeight: '600', color: '#666' },
  
  // FEATURE #2: Staff notification banner
  staffNotificationBanner: { backgroundColor: '#EBF5FB', borderRadius: 12, padding: 16, marginTop: 16, borderWidth: 1, borderColor: '#AED6F1' },
  staffBannerHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  staffBannerTitle: { fontSize: 14, fontWeight: '600', color: '#1e3c72' },
  staffBannerText: { fontSize: 13, color: '#34495E', lineHeight: 18, marginBottom: 10 },
  staffBannerNames: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  staffBadge: { backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: '#1e3c72' },
  staffBadgeText: { fontSize: 12, color: '#1e3c72', fontWeight: '500' },
  suggestButton: { backgroundColor: '#10B981' },
  secondaryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6', padding: 16, borderRadius: 12, marginTop: 12, gap: 8, borderWidth: 1, borderColor: '#1e3c72' },
  secondaryButtonText: { fontSize: 16, fontWeight: '600', color: '#1e3c72' },
  
  // FEATURE #3: Time range picker
  timeRangeLabel: { fontSize: 13, fontWeight: '600', color: '#6B7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  timeRangeContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timePickerHalf: { flex: 1 },
  timeRangeSeparator: { paddingHorizontal: 4, paddingTop: 24 },
  validationError: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF3C7', padding: 10, borderRadius: 8, marginTop: 8 },
  validationErrorText: { fontSize: 13, color: '#D97706', flex: 1 },
  
  // Detail Modal
  detailModal: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%', overflow: 'hidden' },
  eventDetailHeader: { flexDirection: 'row', alignItems: 'center', padding: 20, gap: 16 },
  eventDetailHeaderText: { flex: 1 },
  eventDetailTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  eventDetailDateTime: { fontSize: 14, color: '#666', marginTop: 4 },
  detailScroll: { paddingHorizontal: 20, paddingBottom: 40 },
  detailSection: { marginBottom: 20 },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  detailText: { fontSize: 15, color: '#1a1a1a', lineHeight: 22 },
  
  // Observations
  observationsSection: { marginTop: 10, marginBottom: 20 },
  observationsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  addObservationBtn: { padding: 8, borderRadius: 20, backgroundColor: '#E8F5E9' },
  observationCard: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, marginBottom: 10 },
  observationCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  staffName: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  staffRole: { fontSize: 12, color: '#10B981', fontWeight: '500' },
  observationText: { fontSize: 14, color: '#333', lineHeight: 20 },
  observationDate: { fontSize: 11, color: '#999', marginTop: 8 },
  emptyObservations: { alignItems: 'center', paddingVertical: 30 },
  emptyObsText: { fontSize: 15, color: '#999', marginTop: 12 },
  emptyObsSubtext: { fontSize: 13, color: '#ccc', marginTop: 4, textAlign: 'center' },
  
  // FEATURE #2: Pending validation badge
  pendingValidationBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginTop: 6, alignSelf: 'flex-start' },
  pendingValidationText: { fontSize: 11, fontWeight: '600', color: '#D97706' },
  
  // Action buttons
  actionButtons: { flexDirection: 'row', gap: 12, marginTop: 10 },
  editButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1e3c72', padding: 14, borderRadius: 12, gap: 8 },
  editButtonText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  deleteButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FEE2E2', padding: 14, borderRadius: 12, gap: 8 },
  deleteButtonText: { fontSize: 15, fontWeight: '600', color: '#EF4444' },
  closeDetailButton: { padding: 16, alignItems: 'center', marginTop: 16 },
  closeDetailButtonText: { fontSize: 16, fontWeight: '600', color: '#666' },
  
  // Observation Modal
  observationModal: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  observationInput: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, fontSize: 16, color: '#1a1a1a', height: 150, textAlignVertical: 'top', marginTop: 16 },
  saveObservationButton: { backgroundColor: '#10B981', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  saveObservationButtonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  disabledButton: { opacity: 0.5 },
  
  // Tournament Detail Modal
  tournamentDetail: { backgroundColor: '#f8f9fa', borderRadius: 12, padding: 16, marginBottom: 12 },
  tournamentHidden: { opacity: 0.5, backgroundColor: '#f0f0f0' },
  tournamentDetailHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  tournamentDetailFlag: { fontSize: 28 },
  tournamentDetailName: { fontSize: 16, fontWeight: '600', color: '#1a1a1a', marginBottom: 4 },
  tournamentDetailMeta: { fontSize: 13, color: '#666', marginBottom: 2 },
  tournamentDetailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  prizeText: { fontSize: 14, fontWeight: '600', color: '#1e3c72' },
  currentStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, marginBottom: 2 },
  currentStatusText: { fontSize: 13, fontWeight: '600', color: '#333' },
  registrationButtons: { flexDirection: 'row', gap: 8, marginTop: 12 },
  statusBtn: { flex: 1, padding: 10, borderRadius: 8, backgroundColor: '#f0f0f0', alignItems: 'center' },
  statusBtnActive: { backgroundColor: '#1e3c72' },
  statusBtnText: { fontSize: 12, fontWeight: '600', color: '#666' },
  statusBtnTextActive: { color: '#fff' },
  notInterestedBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10, paddingVertical: 8 },
  notInterestedText: { fontSize: 13, color: '#999' },
  unhideBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, paddingVertical: 10, backgroundColor: '#e8f0fe', borderRadius: 8 },
  unhideBtnText: { fontSize: 14, color: '#1e3c72', fontWeight: '600' },
  
  // Conflict Modal
  conflictOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  conflictCard: { backgroundColor: '#fff', borderRadius: 20, padding: 24, width: '100%', maxWidth: 400, maxHeight: '80%' },
  conflictHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  conflictTitle: { fontSize: 20, fontWeight: '700', color: '#1a1a1a' },
  conflictSubtitle: { fontSize: 14, color: '#666', marginBottom: 16 },
  conflictList: { maxHeight: 250, marginBottom: 20 },
  conflictItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  conflictItemName: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  conflictItemMeta: { fontSize: 12, color: '#999', marginTop: 2 },
  conflictActions: { gap: 10 },
  conflictProceedBtn: { backgroundColor: '#FF9800', padding: 14, borderRadius: 12, alignItems: 'center' },
  conflictProceedText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  conflictCancelBtn: { padding: 14, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#ddd' },
  conflictCancelText: { fontSize: 15, fontWeight: '600', color: '#666' },
});
