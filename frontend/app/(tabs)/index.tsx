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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Colors from '../../src/constants/colors';
import { getFlagEmoji } from '../../src/utils/countryFlags';
import {
  fetchEvents,
  fetchTournamentWeeks,
  fetchAlerts,
  createEvent as apiCreateEvent,
  registerTournament as apiRegisterTournament,
  hideTournament as apiHideTournament,
  unhideTournament as apiUnhideTournament,
  checkTournamentConflicts,
} from '../../src/services/api';

// ============ CONSTANTS ============

const ONBOARDING_DATA_KEY = 'onboarding_data';

const EVENT_CATEGORIES: Record<string, { color: string; icon: string; label: string }> = {
  training_tennis: { color: '#4CAF50', icon: 'tennisball', label: 'Tennis' },
  training_physical: { color: '#2196F3', icon: 'fitness', label: 'Physique' },
  medical: { color: '#E91E63', icon: 'medkit', label: 'Médical' },
  tournament: { color: '#FF9800', icon: 'trophy', label: 'Tournoi' },
  travel: { color: '#9C27B0', icon: 'airplane', label: 'Voyage' },
  other: { color: '#607D8B', icon: 'ellipsis-horizontal', label: 'Autre' },
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
  'Indoor Hard': '#1565C0',
};

// Normalize surfaces for filtering
const normalizeSurface = (surface: string): string => {
  if (!surface) return 'Hard';
  const s = surface.toLowerCase();
  if (s.includes('clay')) return 'Clay';
  if (s.includes('grass')) return 'Grass';
  if (s.includes('carpet')) return 'Carpet';
  return 'Hard';
};

// Get surface color for normalized or raw surface
const getSurfaceColor = (surface: string): string => {
  return SURFACE_COLORS[surface] || SURFACE_COLORS[normalizeSurface(surface)] || '#666';
};

// Category display labels
const CATEGORY_LABELS: Record<string, string> = {
  'Grand Slam': 'Grand Chelem',
  'Masters 1000': 'Masters 1000',
  '1000': 'Masters 1000',
  'ATP 500': 'ATP 500',
  '500': 'ATP 500',
  'ATP 250': 'ATP 250',
  '250': 'ATP 250',
  'ATP Finals': 'ATP Finals',
  'WTA 1000': 'WTA 1000',
  'WTA 500': 'WTA 500',
  'WTA 250': 'WTA 250',
  'WTA Finals': 'WTA Finals',
  'ITF Futures Series': 'ITF Futures',
  'ITF Junior Series': 'ITF Juniors',
  'Team Event': 'Equipe',
  'Regional Games': 'Jeux Régionaux',
  'Wheelchair World Team Cup': 'Wheelchair',
  '100': 'Challenger 100',
  '175': 'Challenger 175',
  '50': 'ITF 50',
};

const getCategoryLabel = (category: string): string => CATEGORY_LABELS[category] || category;

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
  'ITF Futures': '#4CAF50',
  'ITF Juniors': '#8BC34A',
  'Challenger 100': '#FF9800',
  'Challenger 175': '#FF9800',
  'Equipe': '#607D8B',
};

const getCategoryColor = (category: string): string => {
  const label = getCategoryLabel(category);
  return CATEGORY_COLORS[label] || '#607D8B';
};

// Filter surfaces
const FILTER_SURFACES = ['Hard', 'Clay', 'Grass', 'Carpet'];

// Filter levels
const FILTER_LEVELS = [
  'Grand Chelem', 'Masters 1000', 'ATP 500', 'ATP 250', 'ATP Finals',
  'WTA 1000', 'WTA 500', 'WTA 250', 'WTA Finals',
  'Challenger 175', 'Challenger 100', 'ITF Futures',
];

// Prize money ranges
const PRIZE_RANGES = [
  { label: 'Tous', min: 0, max: Infinity },
  { label: '> 5M', min: 5000000, max: Infinity },
  { label: '1M - 5M', min: 1000000, max: 5000000 },
  { label: '500K - 1M', min: 500000, max: 1000000 },
  { label: '< 500K', min: 0, max: 500000 },
];

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

interface CalendarEvent {
  id: string;
  type: string;
  title: string;
  date: string;
  time?: string;
  location?: string;
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
  prizeMoney: number;
  currency: string;
  points?: number;
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
  
  // Core state
  const [currentMonth, setCurrentMonth] = useState('2026-02');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tournamentWeeks, setTournamentWeeks] = useState<TournamentWeek[]>([]);
  const [unreadAlertCount, setUnreadAlertCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [userCircuits, setUserCircuits] = useState<string[]>(['ATP']);

  // Modal state
  const [showTournamentModal, setShowTournamentModal] = useState(false);
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [selectedWeekNumber, setSelectedWeekNumber] = useState<number | null>(null);
  
  // Derive selectedWeek from reactive state so modal updates in real-time
  const selectedWeek = useMemo(() => {
    if (selectedWeekNumber === null) return null;
    return tournamentWeeks.find(w => w.weekNumber === selectedWeekNumber) || null;
  }, [selectedWeekNumber, tournamentWeeks]);
  
  // New event form
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventType, setNewEventType] = useState('training_tennis');
  const [newEventTime, setNewEventTime] = useState('');
  const [newEventLocation, setNewEventLocation] = useState('');

  // Filters state
  const [showFilters, setShowFilters] = useState(false);
  const [filterSurface, setFilterSurface] = useState<string | null>(null);
  const [filterLevel, setFilterLevel] = useState<string | null>(null);
  const [filterCountry, setFilterCountry] = useState<string | null>(null);
  const [filterPrizeRange, setFilterPrizeRange] = useState(0); // index in PRIZE_RANGES

  // Conflict detection state
  const [conflictData, setConflictData] = useState<any>(null);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [pendingRegistration, setPendingRegistration] = useState<{tournamentId: string, status: string} | null>(null);

  // ============ DATA LOADING ============

  // Load user circuits from onboarding
  useEffect(() => {
    const loadUserCircuits = async () => {
      try {
        const stored = await AsyncStorage.getItem(ONBOARDING_DATA_KEY);
        if (stored) {
          const data = JSON.parse(stored);
          if (data.circuits && Array.isArray(data.circuits) && data.circuits.length > 0) {
            // Keep circuits as-is (ITF_WHEELCHAIR should remain separate)
            setUserCircuits(data.circuits);
            console.log('User circuits loaded:', data.circuits);
          }
        }
      } catch (e) {
        console.error('Failed to load user circuits:', e);
      }
    };
    loadUserCircuits();
  }, []);

  // Load calendar data
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
        
        // Events
        setEvents(Array.isArray(eventsData) ? eventsData : []);
        
        // Tournament weeks - handle new API format
        if (weeksData && weeksData.weeks && Array.isArray(weeksData.weeks)) {
          setTournamentWeeks(weeksData.weeks);
        } else if (Array.isArray(weeksData)) {
          setTournamentWeeks(weeksData);
        } else {
          setTournamentWeeks([]);
        }
        
        // Alerts
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

  // ============ HELPERS ============

  // Filter to only show future tournament weeks + apply user filters
  const futureTournamentWeeks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const prizeRange = PRIZE_RANGES[filterPrizeRange];
    
    return tournamentWeeks.filter(week => {
      if (!week?.tournaments?.length) return false;
      // Keep week if at least one tournament matches all filters
      return week.tournaments.some(t => {
        if (!t?.endDate) return true;
        // Future only
        if (new Date(t.endDate) < today) return false;
        // Surface filter
        if (filterSurface && normalizeSurface(t.surface) !== filterSurface) return false;
        // Level filter
        if (filterLevel && getCategoryLabel(t.category) !== filterLevel) return false;
        // Country filter
        if (filterCountry && t.country !== filterCountry) return false;
        // Prize money filter
        if (prizeRange && prizeRange.min > 0) {
          if ((t.prizeMoney || 0) < prizeRange.min) return false;
        }
        if (prizeRange && prizeRange.max < Infinity) {
          if ((t.prizeMoney || 0) > prizeRange.max) return false;
        }
        return true;
      });
    });
  }, [tournamentWeeks, filterSurface, filterLevel, filterCountry, filterPrizeRange]);

  // Available countries from tournaments (for filter dropdown)
  const availableCountries = useMemo(() => {
    const countries = new Set<string>();
    tournamentWeeks.forEach(w => w.tournaments?.forEach(t => {
      if (t.country) countries.add(t.country);
    }));
    return Array.from(countries).sort();
  }, [tournamentWeeks]);

  // Count active filters
  const activeFilterCount = [filterSurface, filterLevel, filterCountry, filterPrizeRange > 0 ? 'x' : null].filter(Boolean).length;

  const getEventsForDate = useCallback((date: string): CalendarEvent[] => {
    return events.filter(e => e.date === date);
  }, [events]);

  const getWeekForDate = useCallback((date: string): TournamentWeek | undefined => {
    const d = new Date(date);
    return tournamentWeeks.find(week => {
      if (!week.startDate || !week.tournaments?.length) return false;
      const firstTournament = week.tournaments[0];
      if (!firstTournament?.startDate || !firstTournament?.endDate) return false;
      const start = new Date(firstTournament.startDate);
      const end = new Date(firstTournament.endDate);
      return d >= start && d <= end;
    });
  }, [tournamentWeeks]);

  const getVisibleTournaments = useCallback((week: TournamentWeek): Tournament[] => {
    if (!week?.tournaments || !Array.isArray(week.tournaments)) return [];
    return week.tournaments.filter(t => !t.hidden);
  }, []);

  // ============ CALENDAR MARKS ============

  const calendarMarks = useMemo(() => {
    const marks: Record<string, any> = {};
    
    // Safety check
    if (!Array.isArray(tournamentWeeks)) return marks;
    
    // Add tournament marks
    tournamentWeeks.forEach(week => {
      if (!week?.tournaments || !Array.isArray(week.tournaments)) return;
      
      const registeredTournaments = week.tournaments.filter(t => t?.registration);
      
      registeredTournaments.forEach(tournament => {
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
                color: EVENT_CATEGORIES.tournament.color 
              });
            }
            currentDate.setDate(currentDate.getDate() + 1);
          }
        } catch (e) {
          // Skip invalid dates
        }
      });
    });
    
    // Add event marks
    if (Array.isArray(events)) {
      events.forEach(event => {
        if (!event?.date || !event?.type) return;
        
        const category = EVENT_CATEGORIES[event.type] || EVENT_CATEGORIES.other;
        if (!marks[event.date]) {
          marks[event.date] = { dots: [] };
        }
        const hasDot = marks[event.date].dots.some((d: any) => d.key === `event-${event.id}`);
        if (!hasDot) {
          marks[event.date].dots.push({ 
            key: `event-${event.id}`,
            color: category.color 
          });
        }
      });
    }
    
    // Mark selected date
    if (selectedDate) {
      if (!marks[selectedDate]) {
        marks[selectedDate] = { dots: [] };
      }
      marks[selectedDate].selected = true;
      marks[selectedDate].selectedColor = Colors.accent?.primary || '#1e3c72';
    }
    
    return marks;
  }, [tournamentWeeks, events, selectedDate]);

  // ============ ACTIONS ============

  const handleRegisterTournament = async (tournamentId: string, status: string) => {
    // For advancing statuses (pending/participating), check for conflicts first
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
        // If conflict check fails, proceed anyway
        console.warn('Conflict check failed, proceeding:', e);
      }
    }
    
    await executeRegistration(tournamentId, status);
  };
  
  const executeRegistration = async (tournamentId: string, status: string) => {
    try {
      await apiRegisterTournament(tournamentId, status);
      
      // Update local state immediately for reactive UI
      setTournamentWeeks(prev => {
        if (!Array.isArray(prev)) return prev;
        return prev.map(week => ({
          ...week,
          tournaments: (week.tournaments || []).map(t => 
            t.id === tournamentId 
              ? { ...t, registration: { status } }
              : t
          )
        }));
      });
    } catch (e) {
      console.error('Registration failed:', e);
      Alert.alert('Erreur', 'Échec de l\'inscription');
    }
  };
  
  const handleConflictProceed = async () => {
    if (pendingRegistration) {
      await executeRegistration(pendingRegistration.tournamentId, pendingRegistration.status);
    }
    setShowConflictModal(false);
    setConflictData(null);
    setPendingRegistration(null);
  };
  
  const handleConflictCancel = () => {
    setShowConflictModal(false);
    setConflictData(null);
    setPendingRegistration(null);
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
      console.error('Hide failed:', e);
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
      console.error('Unhide failed:', e);
      Alert.alert('Erreur', 'Échec du rétablissement');
    }
  };

  const handleAddEvent = async () => {
    if (!newEventTitle.trim() || !selectedDate) {
      Alert.alert('Erreur', 'Veuillez remplir le titre');
      return;
    }
    
    try {
      const eventData = {
        type: newEventType,
        title: newEventTitle.trim(),
        date: selectedDate,
        time: newEventTime,
        location: newEventLocation,
      };
      
      const savedEvent = await apiCreateEvent(eventData);
      setEvents(prev => [...prev, savedEvent]);
      
      // Reset form
      setNewEventTitle('');
      setNewEventTime('');
      setNewEventLocation('');
      setShowAddEventModal(false);
      
      Alert.alert('Succès', 'Événement ajouté');
    } catch (e) {
      console.error('Failed to create event:', e);
      Alert.alert('Erreur', 'Échec de la création');
    }
  };

  // ============ RENDER HELPERS ============

  const renderTournamentWeekCard = (week: TournamentWeek) => {
    if (!week?.tournaments) return null;
    
    const visibleTournaments = getVisibleTournaments(week);
    const registeredTournaments = week.tournaments.filter(t => t?.registration);
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
        activeOpacity={0.7}
      >
        <View style={styles.weekCardHeader}>
          <Text style={styles.weekNumber}>S{week.weekNumber}</Text>
          <Text style={styles.weekDates}>
            {firstTournament.startDate ? new Date(firstTournament.startDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : ''}
          </Text>
        </View>
        
        {/* Category/Level badge */}
        <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(firstTournament.category) + '18' }]}>
          <Text style={[styles.categoryText, { color: getCategoryColor(firstTournament.category) }]}>
            {getCategoryLabel(firstTournament.category)}
          </Text>
        </View>
        
        <Text style={styles.tournamentName} numberOfLines={1}>
          {firstTournament.name}
        </Text>
        
        <View style={styles.tournamentMeta}>
          <View style={[styles.surfaceBadge, { backgroundColor: (SURFACE_COLORS[firstTournament.surface] || '#666') + '20' }]}>
            <Text style={[styles.surfaceText, { color: SURFACE_COLORS[firstTournament.surface] || '#666' }]}>
              {firstTournament.surface}
            </Text>
          </View>
          <Text style={styles.tournamentLocation}>
            {getFlagEmoji(firstTournament.country)} {firstTournament.city}
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
        
        {registeredTournaments.length > 0 && (
          <View style={styles.registrationBadge}>
            <Ionicons name="checkmark-circle" size={14} color="#4CAF50" />
            <Text style={styles.registrationText}>
              {registeredTournaments[0]?.registration?.status === 'participating' ? 'Participant' : 'Inscrit'}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderDayEvents = () => {
    if (!selectedDate) return null;
    
    const dayEvents = getEventsForDate(selectedDate);
    const week = getWeekForDate(selectedDate);
    
    const tournamentsForDay = week?.tournaments?.filter(t => {
      if (!t?.registration || !t?.startDate || !t?.endDate) return false;
      // Compare as strings (YYYY-MM-DD) to avoid timezone issues
      const sd = selectedDate;
      const tStart = typeof t.startDate === 'string' ? t.startDate.slice(0, 10) : '';
      const tEnd = typeof t.endDate === 'string' ? t.endDate.slice(0, 10) : '';
      return sd >= tStart && sd <= tEnd;
    }) || [];
    
    // Parse date parts without timezone offset
    const [y, m, d] = selectedDate.split('-').map(Number);
    const displayDate = new Date(y, m - 1, d);
    
    return (
      <View style={styles.dayEventsContainer}>
        <View style={styles.dayEventsHeader}>
          <Text style={styles.dayEventsTitle}>
            {displayDate.toLocaleDateString('fr-FR', { 
              weekday: 'long', 
              day: 'numeric', 
              month: 'long' 
            })}
          </Text>
          <TouchableOpacity
            style={styles.addEventBtn}
            onPress={() => setShowAddEventModal(true)}
          >
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
        
        {/* Tournaments for the day */}
        {tournamentsForDay.map(tournament => (
          <View key={tournament.id} style={styles.dayEventCard}>
            <View style={[styles.eventIcon, { backgroundColor: EVENT_CATEGORIES.tournament.color + '20' }]}>
              <Ionicons name="trophy" size={18} color={EVENT_CATEGORIES.tournament.color} />
            </View>
            <View style={styles.eventInfo}>
              <Text style={styles.eventTitle}>{tournament.name}</Text>
              <Text style={styles.eventMeta}>{tournament.city} • {tournament.surface}</Text>
            </View>
          </View>
        ))}
        
        {/* Regular events */}
        {dayEvents.map(event => {
          const category = EVENT_CATEGORIES[event.type] || EVENT_CATEGORIES.other;
          return (
            <View key={event.id} style={styles.dayEventCard}>
              <View style={[styles.eventIcon, { backgroundColor: category.color + '20' }]}>
                <Ionicons name={category.icon as any} size={18} color={category.color} />
              </View>
              <View style={styles.eventInfo}>
                <Text style={styles.eventTitle}>{event.title}</Text>
                {event.time && <Text style={styles.eventMeta}>{event.time}</Text>}
              </View>
            </View>
          );
        })}
        
        {tournamentsForDay.length === 0 && dayEvents.length === 0 && (
          <Text style={styles.noEventsText}>Aucun événement</Text>
        )}
      </View>
    );
  };

  // ============ MAIN RENDER ============

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
          >
            <Ionicons name="notifications-outline" size={24} color="#fff" />
            {unreadAlertCount > 0 && (
              <View style={styles.alertBadge}>
                <Text style={styles.alertBadgeText}>{unreadAlertCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
        
        {/* Circuit badges */}
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
              todayTextColor: '#1e3c72',
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

        {/* Selected date events */}
        {selectedDate && renderDayEvents()}

        {/* Tournament weeks */}
        <View style={styles.tournamentsSection}>
          <View style={styles.tournamentsSectionHeader}>
            <Text style={styles.sectionTitle}>Prochains tournois</Text>
            <TouchableOpacity
              style={[styles.filterToggle, activeFilterCount > 0 && styles.filterToggleActive]}
              onPress={() => setShowFilters(!showFilters)}
              data-testid="filter-toggle"
            >
              <Ionicons name="filter" size={16} color={activeFilterCount > 0 ? '#fff' : '#1e3c72'} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: activeFilterCount > 0 ? '#fff' : '#1e3c72' }}>
                Filtres{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Filter bar */}
          {showFilters && (
            <View style={styles.filtersContainer}>
              {/* Surface filter */}
              <Text style={styles.filterLabel}>Surface</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
                <TouchableOpacity
                  style={[styles.filterChip, !filterSurface && styles.filterChipActive]}
                  onPress={() => setFilterSurface(null)}
                >
                  <Text style={[styles.filterChipText, !filterSurface && styles.filterChipTextActive]}>Toutes</Text>
                </TouchableOpacity>
                {FILTER_SURFACES.map(s => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.filterChip, filterSurface === s && styles.filterChipActive, filterSurface === s && { backgroundColor: getSurfaceColor(s) }]}
                    onPress={() => setFilterSurface(filterSurface === s ? null : s)}
                  >
                    <Text style={[styles.filterChipText, filterSurface === s && styles.filterChipTextActive]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Level filter */}
              <Text style={styles.filterLabel}>Niveau</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
                <TouchableOpacity
                  style={[styles.filterChip, !filterLevel && styles.filterChipActive]}
                  onPress={() => setFilterLevel(null)}
                >
                  <Text style={[styles.filterChipText, !filterLevel && styles.filterChipTextActive]}>Tous</Text>
                </TouchableOpacity>
                {FILTER_LEVELS.map(l => (
                  <TouchableOpacity
                    key={l}
                    style={[styles.filterChip, filterLevel === l && styles.filterChipActive, filterLevel === l && { backgroundColor: CATEGORY_COLORS[l] || '#607D8B' }]}
                    onPress={() => setFilterLevel(filterLevel === l ? null : l)}
                  >
                    <Text style={[styles.filterChipText, filterLevel === l && styles.filterChipTextActive]}>{l}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Prize money filter */}
              <Text style={styles.filterLabel}>Prize Money</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
                {PRIZE_RANGES.map((pr, i) => (
                  <TouchableOpacity
                    key={pr.label}
                    style={[styles.filterChip, filterPrizeRange === i && styles.filterChipActive]}
                    onPress={() => setFilterPrizeRange(filterPrizeRange === i ? 0 : i)}
                  >
                    <Text style={[styles.filterChipText, filterPrizeRange === i && styles.filterChipTextActive]}>{pr.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Country filter */}
              <Text style={styles.filterLabel}>Pays</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
                <TouchableOpacity
                  style={[styles.filterChip, !filterCountry && styles.filterChipActive]}
                  onPress={() => setFilterCountry(null)}
                >
                  <Text style={[styles.filterChipText, !filterCountry && styles.filterChipTextActive]}>Tous</Text>
                </TouchableOpacity>
                {availableCountries.map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.filterChip, filterCountry === c && styles.filterChipActive]}
                    onPress={() => setFilterCountry(filterCountry === c ? null : c)}
                  >
                    <Text style={[styles.filterChipText, filterCountry === c && styles.filterChipTextActive]}>
                      {getFlagEmoji(c)} {c}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Reset all filters */}
              {activeFilterCount > 0 && (
                <TouchableOpacity
                  style={styles.resetFiltersBtn}
                  onPress={() => { setFilterSurface(null); setFilterLevel(null); setFilterCountry(null); setFilterPrizeRange(0); }}
                >
                  <Ionicons name="close-circle" size={16} color="#E53935" />
                  <Text style={styles.resetFiltersText}>Réinitialiser les filtres</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {futureTournamentWeeks.length === 0 ? (
            <Text style={styles.noTournamentsText}>
              {activeFilterCount > 0 ? 'Aucun tournoi ne correspond aux filtres' : 'Aucun tournoi à venir'}
            </Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.weeksScroll}>
              {futureTournamentWeeks.slice(0, 20).map(week => renderTournamentWeekCard(week))}
            </ScrollView>
          )}
        </View>
        
        <View style={{ height: 100 }} />
      </ScrollView>

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
                      {getFlagEmoji(tournament.countryCode || tournament.country)}
                    </Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.tournamentDetailName}>{tournament.name}</Text>
                      <Text style={styles.tournamentDetailMeta}>
                        {tournament.city}, {tournament.country}
                      </Text>
                    </View>
                    <View style={[styles.categoryBadgeModal, { backgroundColor: getCategoryColor(tournament.category) + '18' }]}>
                      <Text style={[styles.categoryTextModal, { color: getCategoryColor(tournament.category) }]}>
                        {getCategoryLabel(tournament.category)}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.tournamentDetailMeta}>
                    {tournament.startDate ? new Date(tournament.startDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) : ''} - {tournament.endDate ? new Date(tournament.endDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}
                  </Text>
                  <View style={styles.tournamentDetailRow}>
                    <View style={[styles.surfaceBadge, { backgroundColor: (SURFACE_COLORS[tournament.surface] || '#666') + '20' }]}>
                      <Text style={[styles.surfaceText, { color: SURFACE_COLORS[tournament.surface] || '#666' }]}>
                        {tournament.surface}
                      </Text>
                    </View>
                    <Text style={styles.prizeText}>
                      {tournament.prizeMoney?.toLocaleString()} {tournament.currency}
                    </Text>
                  </View>
                  
                  {/* "Not interested" toggle */}
                  {tournament.hidden ? (
                    <TouchableOpacity
                      style={styles.unhideBtn}
                      onPress={() => handleUnhideTournament(tournament.id)}
                      data-testid={`btn-unhide-${tournament.id}`}
                    >
                      <Ionicons name="eye-outline" size={16} color="#1e3c72" />
                      <Text style={styles.unhideBtnText}>Rétablir</Text>
                    </TouchableOpacity>
                  ) : (
                    <>
                      {/* Current status indicator */}
                      {tournament.registration?.status && (
                        <View style={styles.currentStatusRow}>
                          <Ionicons name="checkmark-circle" size={16} color={
                            tournament.registration.status === 'participating' ? '#4CAF50' :
                            tournament.registration.status === 'declined' ? '#F44336' :
                            tournament.registration.status === 'pending' ? '#FF9800' :
                            '#1e3c72'
                          } />
                          <Text style={styles.currentStatusText}>
                            {TOURNAMENT_STATUS_LABELS[tournament.registration.status]?.label || tournament.registration.status}
                          </Text>
                        </View>
                      )}
                      
                      {/* Registration buttons - simplified state machine */}
                      <View style={styles.registrationButtons}>
                        {tournament.registration?.status === 'pending' ? (
                          // From pending: only "Participant" or "Décliné"
                          <>
                            <TouchableOpacity
                              style={[styles.statusBtn, { backgroundColor: '#4CAF50' + '20', borderWidth: 1, borderColor: '#4CAF50' }]}
                              onPress={() => handleRegisterTournament(tournament.id, 'participating')}
                            >
                              <Text style={[styles.statusBtnText, { color: '#4CAF50' }]}>Participant</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.statusBtn, { backgroundColor: '#F44336' + '20', borderWidth: 1, borderColor: '#F44336' }]}
                              onPress={() => handleRegisterTournament(tournament.id, 'declined')}
                            >
                              <Text style={[styles.statusBtnText, { color: '#F44336' }]}>Décliné</Text>
                            </TouchableOpacity>
                          </>
                        ) : tournament.registration?.status === 'participating' || tournament.registration?.status === 'declined' ? (
                          // Terminal states: show reset option
                          <TouchableOpacity
                            style={[styles.statusBtn, { backgroundColor: '#f0f0f0' }]}
                            onPress={() => handleRegisterTournament(tournament.id, 'interested')}
                          >
                            <Text style={[styles.statusBtnText, { color: '#666' }]}>Réinitialiser le statut</Text>
                          </TouchableOpacity>
                        ) : (
                          // Default: interested / pending / participating
                          ['interested', 'pending', 'participating'].map(status => (
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
                          ))
                        )}
                      </View>
                      
                      <TouchableOpacity
                        style={styles.notInterestedBtn}
                        onPress={() => handleHideTournament(tournament.id)}
                        data-testid={`btn-hide-${tournament.id}`}
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

      {/* Add Event Modal */}
      <Modal visible={showAddEventModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Ajouter un événement</Text>
              <TouchableOpacity onPress={() => setShowAddEventModal(false)}>
                <Ionicons name="close" size={24} color="#1a1a1a" />
              </TouchableOpacity>
            </View>
            
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Event type */}
              <Text style={styles.inputLabel}>Type</Text>
              <View style={styles.typeGrid}>
                {Object.entries(EVENT_CATEGORIES).map(([key, cat]) => (
                  <TouchableOpacity
                    key={key}
                    style={[
                      styles.typeOption,
                      newEventType === key && { backgroundColor: cat.color + '20', borderColor: cat.color }
                    ]}
                    onPress={() => setNewEventType(key)}
                  >
                    <Ionicons name={cat.icon as any} size={20} color={newEventType === key ? cat.color : '#666'} />
                    <Text style={[styles.typeLabel, newEventType === key && { color: cat.color }]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              
              {/* Title */}
              <Text style={styles.inputLabel}>Titre</Text>
              <TextInput
                style={styles.input}
                value={newEventTitle}
                onChangeText={setNewEventTitle}
                placeholder="Ex: Entraînement avec coach"
                placeholderTextColor="#999"
              />
              
              {/* Time */}
              <Text style={styles.inputLabel}>Heure (optionnel)</Text>
              <TextInput
                style={styles.input}
                value={newEventTime}
                onChangeText={setNewEventTime}
                placeholder="Ex: 10:00"
                placeholderTextColor="#999"
              />
              
              {/* Location */}
              <Text style={styles.inputLabel}>Lieu (optionnel)</Text>
              <TextInput
                style={styles.input}
                value={newEventLocation}
                onChangeText={setNewEventLocation}
                placeholder="Ex: Court central"
                placeholderTextColor="#999"
              />
              
              <TouchableOpacity style={styles.saveBtn} onPress={handleAddEvent}>
                <Ionicons name="checkmark-circle" size={22} color="#fff" />
                <Text style={styles.saveBtnText}>Ajouter</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Conflict Detection Modal */}
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
                      {ct.status ? ` (${TOURNAMENT_STATUS_LABELS[ct.status]?.label || ct.status})` : ''}
                    </Text>
                  </View>
                </View>
              ))}
              
              {conflictData?.calendarEvents?.map((ev: any, i: number) => (
                <View key={ev.id || i} style={styles.conflictItem}>
                  <Ionicons name="calendar-outline" size={18} color="#2196F3" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.conflictItemName}>{ev.title}</Text>
                    <Text style={styles.conflictItemMeta}>
                      {ev.date} {ev.time ? `à ${ev.time}` : ''}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
            
            <View style={styles.conflictActions}>
              <TouchableOpacity style={styles.conflictProceedBtn} onPress={handleConflictProceed}>
                <Text style={styles.conflictProceedText}>Continuer quand même</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.conflictCancelBtn} onPress={handleConflictCancel}>
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
  dayEventsContainer: { marginHorizontal: 16, marginBottom: 16 },
  dayEventsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  dayEventsTitle: { fontSize: 16, fontWeight: '600', color: '#1a1a1a', textTransform: 'capitalize' },
  addEventBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#1e3c72', alignItems: 'center', justifyContent: 'center' },
  dayEventCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 12, borderRadius: 12, marginBottom: 8 },
  eventIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  eventInfo: { flex: 1 },
  eventTitle: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  eventMeta: { fontSize: 13, color: '#666', marginTop: 2 },
  noEventsText: { fontSize: 14, color: '#999', textAlign: 'center', paddingVertical: 20 },
  tournamentsSection: { marginHorizontal: 16, marginTop: 8 },
  tournamentsSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  filterToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f0f0f0', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  filterToggleActive: { backgroundColor: '#1e3c72' },
  filterCount: { fontSize: 12, fontWeight: '700', color: '#fff' },
  filtersContainer: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  filterLabel: { fontSize: 13, fontWeight: '600', color: '#666', marginBottom: 6, marginTop: 10 },
  filterRow: { flexDirection: 'row', marginBottom: 2 },
  filterChip: { backgroundColor: '#f0f0f0', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, marginRight: 8 },
  filterChipActive: { backgroundColor: '#1e3c72' },
  filterChipText: { fontSize: 13, fontWeight: '500', color: '#666' },
  filterChipTextActive: { color: '#fff' },
  resetFiltersBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, paddingVertical: 8 },
  resetFiltersText: { fontSize: 13, color: '#E53935', fontWeight: '500' },
  categoryBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginBottom: 6 },
  categoryText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  categoryBadgeModal: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  categoryTextModal: { fontSize: 11, fontWeight: '700' },
  noTournamentsText: { fontSize: 14, color: '#999', textAlign: 'center', paddingVertical: 20 },
  weeksScroll: { marginLeft: -4 },
  weekCard: { width: 180, backgroundColor: '#fff', borderRadius: 16, padding: 16, marginRight: 12, marginLeft: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  weekCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  weekNumber: { fontSize: 14, fontWeight: '700', color: '#1e3c72' },
  weekDates: { fontSize: 12, color: '#666' },
  tournamentName: { fontSize: 15, fontWeight: '600', color: '#1a1a1a', marginBottom: 8 },
  tournamentMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  surfaceBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  surfaceText: { fontSize: 11, fontWeight: '600' },
  tournamentLocation: { fontSize: 12, color: '#666', flex: 1 },
  registrationBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 4 },
  registrationText: { fontSize: 12, color: '#4CAF50', fontWeight: '500' },
  prizeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 4 },
  weekPrizeText: { fontSize: 13, fontWeight: '600', color: '#1e3c72' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  tournamentDetail: { backgroundColor: '#f8f9fa', borderRadius: 12, padding: 16, marginBottom: 12 },
  tournamentDetailName: { fontSize: 16, fontWeight: '600', color: '#1a1a1a', marginBottom: 4 },
  tournamentDetailMeta: { fontSize: 13, color: '#666', marginBottom: 2 },
  tournamentDetailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  prizeText: { fontSize: 14, fontWeight: '600', color: '#1e3c72' },
  registrationButtons: { flexDirection: 'row', gap: 8, marginTop: 12 },
  statusBtn: { flex: 1, padding: 10, borderRadius: 8, backgroundColor: '#f0f0f0', alignItems: 'center' },
  statusBtnActive: { backgroundColor: '#1e3c72' },
  tournamentHidden: { opacity: 0.5, backgroundColor: '#f0f0f0' },
  tournamentDetailHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  tournamentDetailFlag: { fontSize: 28 },
  notInterestedBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10, paddingVertical: 8 },
  notInterestedText: { fontSize: 13, color: '#999' },
  currentStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, marginBottom: 2 },
  currentStatusText: { fontSize: 13, fontWeight: '600', color: '#333' },
  unhideBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, paddingVertical: 10, backgroundColor: '#e8f0fe', borderRadius: 8 },
  unhideBtnText: { fontSize: 14, color: '#1e3c72', fontWeight: '600' },
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
  statusBtnText: { fontSize: 12, fontWeight: '600', color: '#666' },
  statusBtnTextActive: { color: '#fff' },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#666', marginBottom: 8, marginTop: 16 },
  input: { backgroundColor: '#f5f5f5', borderRadius: 12, padding: 14, fontSize: 16, color: '#1a1a1a' },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  typeOption: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, backgroundColor: '#f5f5f5', borderWidth: 2, borderColor: 'transparent', gap: 6 },
  typeLabel: { fontSize: 13, fontWeight: '500', color: '#666' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1e3c72', padding: 16, borderRadius: 12, marginTop: 24, gap: 8 },
  saveBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});
