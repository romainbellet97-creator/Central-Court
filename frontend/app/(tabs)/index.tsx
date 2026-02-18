import React, { useState, useMemo, useCallback, useEffect } from 'react';
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
  role: string;
  text: string;
  createdAt: string;
}

interface CalendarEvent {
  id: string;
  type: string;
  title: string;
  date: string;
  time?: string;
  location?: string;
  description?: string;
  observations?: Observation[];
  createdAt?: string;
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
  
  // Event form state
  const [eventType, setEventType] = useState('training');
  const [eventDate, setEventDate] = useState(today);
  const [eventTime, setEventTime] = useState('09:00');
  const [eventNotes, setEventNotes] = useState('');
  const [eventLocation, setEventLocation] = useState('');

  // Tournament Modal
  const [showTournamentModal, setShowTournamentModal] = useState(false);
  const [selectedWeekNumber, setSelectedWeekNumber] = useState<number | null>(null);
  
  // Conflict Modal
  const [conflictData, setConflictData] = useState<any>(null);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [pendingRegistration, setPendingRegistration] = useState<{tournamentId: string, status: string} | null>(null);

  // Derive selectedWeek from reactive state
  const selectedWeek = useMemo(() => {
    if (selectedWeekNumber === null) return null;
    return tournamentWeeks.find(w => w.weekNumber === selectedWeekNumber) || null;
  }, [selectedWeekNumber, tournamentWeeks]);

  // Day events
  const dayEvents = useMemo(() => {
    return events.filter(e => e.date === selectedDate).sort((a, b) => 
      (a.time || '00:00').localeCompare(b.time || '00:00')
    );
  }, [events, selectedDate]);

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
    setEventNotes(event.description || '');
    setEventLocation(event.location || '');
    
    // Open edit modal after a small delay to ensure detail modal is closed
    setTimeout(() => {
      setShowEditEventModal(true);
    }, 100);
  };

  const handleSaveEvent = async () => {
    try {
      const newEvent = {
        type: eventType,
        title: EVENT_TYPES[eventType]?.label || 'Événement',
        date: eventDate,
        time: eventTime,
        location: eventLocation.trim() || undefined,
        description: eventNotes.trim() || undefined,
      };

      const savedEvent = await apiCreateEvent(newEvent);
      setEvents(prev => [...prev, savedEvent]);
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
    
    try {
      const updatedData = {
        type: eventType,
        title: EVENT_TYPES[eventType]?.label || 'Événement',
        date: eventDate,
        time: eventTime,
        location: eventLocation.trim() || undefined,
        description: eventNotes.trim() || undefined,
      };

      const updatedEvent = await apiUpdateEvent(selectedEvent.id, updatedData);
      setEvents(prev => prev.map(e => e.id === selectedEvent.id ? { ...e, ...updatedEvent } : e));
      
      // Clean up state
      setShowEditEventModal(false);
      setSelectedEvent(null);
      resetEventForm();
      
      Alert.alert('Succès', 'Événement modifié !');
    } catch (error) {
      console.error('Error updating event:', error);
      Alert.alert('Erreur', 'Impossible de modifier l\'événement');
    }
  };

  const handleDeleteEvent = () => {
    if (!selectedEvent) return;
    
    Alert.alert(
      'Supprimer l\'événement',
      'Êtes-vous sûr de vouloir supprimer cet événement ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiDeleteEvent(selectedEvent.id);
              setEvents(prev => prev.filter(e => e.id !== selectedEvent.id));
              setShowEventDetailModal(false);
              setSelectedEvent(null);
              Alert.alert('Succès', 'Événement supprimé');
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de supprimer');
            }
          },
        },
      ]
    );
  };

  const handleSaveObservation = async () => {
    if (!selectedEvent || !observationText.trim()) return;
    
    try {
      const newObservation = await apiAddObservation(selectedEvent.id, {
        author: 'Coach Martin', // TODO: Get from user context
        role: 'Entraîneur principal',
        text: observationText.trim(),
      });

      // Update local state
      const updatedEvent = {
        ...selectedEvent,
        observations: [...(selectedEvent.observations || []), newObservation]
      };
      
      setSelectedEvent(updatedEvent);
      setEvents(prev => prev.map(e => e.id === selectedEvent.id ? updatedEvent : e));

      setShowAddObservationModal(false);
      setObservationText('');
      
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
      setTournamentWeeks(prev =>
        prev.map(week => ({
          ...week,
          tournaments: (week.tournaments || []).map(t => 
            t.id === tournamentId ? { ...t, registration: { status } } : t
          )
        }))
      );
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
              const eventConfig = EVENT_TYPES[event.type] || EVENT_TYPES.other;
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
                    <View style={styles.eventHeader}>
                      <Text style={styles.eventTime}>{event.time || '--:--'}</Text>
                      <View style={styles.eventBadge}>
                        <Ionicons name={eventConfig.icon as any} size={16} color={eventConfig.color} />
                        <Text style={[styles.eventType, { color: eventConfig.color }]}>
                          {eventConfig.label.replace(/^[^\s]+\s/, '')}
                        </Text>
                      </View>
                    </View>
                    {event.description && (
                      <Text style={styles.eventNotes} numberOfLines={2}>
                        {event.description}
                      </Text>
                    )}
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
                
                return (
                  <TouchableOpacity
                    key={week.weekNumber}
                    style={styles.weekCard}
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
                    
                    {week.tournaments.some(t => t.registration) && (
                      <View style={styles.registrationBadge}>
                        <Ionicons name="checkmark-circle" size={14} color="#4CAF50" />
                        <Text style={styles.registrationText}>Inscrit</Text>
                      </View>
                    )}
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
      <Modal visible={showAddEventModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nouvel événement</Text>
              <TouchableOpacity onPress={() => setShowAddEventModal(false)}>
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

              {/* Time Picker */}
              <AppleTimePicker
                value={eventTime}
                onChange={setEventTime}
                minuteStep={5}
                label="HEURE"
              />

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
              <TouchableOpacity style={styles.saveButton} onPress={handleSaveEvent}>
                <Ionicons name="checkmark-circle" size={22} color="#fff" />
                <Text style={styles.saveButtonText}>Enregistrer</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowAddEventModal(false)}
              >
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit Event Modal */}
      <Modal visible={showEditEventModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Modifier l'événement</Text>
              <TouchableOpacity onPress={() => setShowEditEventModal(false)}>
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

              <AppleTimePicker
                value={eventTime}
                onChange={setEventTime}
                minuteStep={5}
                label="HEURE"
              />

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

              <TouchableOpacity style={styles.saveButton} onPress={handleUpdateEvent}>
                <Ionicons name="checkmark-circle" size={22} color="#fff" />
                <Text style={styles.saveButtonText}>Enregistrer les modifications</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowEditEventModal(false)}
              >
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Event Detail Modal */}
      <Modal visible={showEventDetailModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
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
                      {formatDate(selectedEvent.date)} à {selectedEvent.time || '--:--'}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setShowEventDetailModal(false)}>
                    <Ionicons name="close" size={28} color="#666" />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.detailScroll} showsVerticalScrollIndicator={false}>
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

                  {/* Observations section */}
                  <View style={styles.observationsSection}>
                    <View style={styles.observationsHeader}>
                      <Text style={styles.sectionLabel}>
                        Observations de l'équipe ({selectedEvent.observations?.length || 0})
                      </Text>
                      <TouchableOpacity
                        style={styles.addObservationBtn}
                        onPress={() => setShowAddObservationModal(true)}
                      >
                        <Ionicons name="add-circle" size={24} color="#10B981" />
                      </TouchableOpacity>
                    </View>

                    {selectedEvent.observations && selectedEvent.observations.length > 0 ? (
                      selectedEvent.observations.map(obs => (
                        <View key={obs.id} style={styles.observationCard}>
                          <View style={styles.observationCardHeader}>
                            <Text style={styles.staffName}>{obs.author}</Text>
                            <Text style={styles.staffRole}>{obs.role}</Text>
                          </View>
                          <Text style={styles.observationText}>{obs.text}</Text>
                          <Text style={styles.observationDate}>
                            {formatRelativeTime(obs.createdAt)}
                          </Text>
                        </View>
                      ))
                    ) : (
                      <View style={styles.emptyObservations}>
                        <Ionicons name="chatbubble-outline" size={48} color="#ccc" />
                        <Text style={styles.emptyObsText}>Aucune observation</Text>
                        <Text style={styles.emptyObsSubtext}>
                          Votre équipe peut ajouter des commentaires ici
                        </Text>
                      </View>
                    )}
                  </View>

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
                    onPress={() => setShowEventDetailModal(false)}
                  >
                    <Text style={styles.closeDetailButtonText}>Fermer</Text>
                  </TouchableOpacity>
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Add Observation Modal */}
      <Modal visible={showAddObservationModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.observationModal}>
            <Text style={styles.modalTitle}>Ajouter une observation</Text>

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
              {selectedWeek?.tournaments?.map(tournament => (
                <View key={tournament.id} style={[styles.tournamentDetail, tournament.hidden && styles.tournamentHidden]}>
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
                  
                  {tournament.hidden ? (
                    <TouchableOpacity
                      style={styles.unhideBtn}
                      onPress={() => handleUnhideTournament(tournament.id)}
                    >
                      <Ionicons name="eye-outline" size={16} color="#1e3c72" />
                      <Text style={styles.unhideBtnText}>Rétablir</Text>
                    </TouchableOpacity>
                  ) : (
                    <>
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
              ))}
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
  eventNotes: { fontSize: 13, color: '#666', marginTop: 6 },
  observationBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 4 },
  observationCount: { fontSize: 12, color: '#10B981', fontWeight: '500' },
  
  // Tournaments Section
  tournamentsSection: { marginHorizontal: 16, marginTop: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginBottom: 12 },
  noTournamentsText: { fontSize: 14, color: '#999', textAlign: 'center', paddingVertical: 20 },
  weeksScroll: { marginLeft: -4 },
  weekCard: { width: 180, backgroundColor: '#fff', borderRadius: 16, padding: 16, marginRight: 12, marginLeft: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  weekCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  weekNumber: { fontSize: 14, fontWeight: '700', color: '#1e3c72' },
  weekDates: { fontSize: 12, color: '#666' },
  categoryBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginBottom: 6 },
  categoryText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  tournamentName: { fontSize: 15, fontWeight: '600', color: '#1a1a1a', marginBottom: 8 },
  tournamentMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  surfaceBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  surfaceText: { fontSize: 11, fontWeight: '600' },
  tournamentLocation: { fontSize: 12, color: '#666', flex: 1 },
  prizeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 4 },
  weekPrizeText: { fontSize: 13, fontWeight: '600', color: '#1e3c72' },
  registrationBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 4 },
  registrationText: { fontSize: 12, color: '#4CAF50', fontWeight: '500' },
  
  // FAB
  fab: { position: 'absolute', right: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: '#1e3c72', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  
  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
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
  cancelButton: { padding: 16, alignItems: 'center', marginTop: 12 },
  cancelButtonText: { fontSize: 16, fontWeight: '600', color: '#666' },
  
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
  addObservationBtn: { padding: 4 },
  observationCard: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, marginBottom: 10 },
  observationCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  staffName: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  staffRole: { fontSize: 12, color: '#10B981', fontWeight: '500' },
  observationText: { fontSize: 14, color: '#333', lineHeight: 20 },
  observationDate: { fontSize: 11, color: '#999', marginTop: 8 },
  emptyObservations: { alignItems: 'center', paddingVertical: 30 },
  emptyObsText: { fontSize: 15, color: '#999', marginTop: 12 },
  emptyObsSubtext: { fontSize: 13, color: '#ccc', marginTop: 4, textAlign: 'center' },
  
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
