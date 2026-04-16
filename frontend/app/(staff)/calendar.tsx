import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { useAuth } from '../../src/context/AuthContext';
import { PermissionGate } from '../../src/components/PermissionGate';
import { getStaffPermissions } from '../../src/types/staff';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import AppleDatePicker from '../../src/components/inputs/AppleDatePicker';
import AppleTimePicker from '../../src/components/inputs/AppleTimePicker';
import NotesInput from '../../src/components/inputs/NotesInput';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL ||
                process.env.EXPO_PUBLIC_BACKEND_URL || '';

async function getStoredToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      return typeof localStorage !== 'undefined' ? localStorage.getItem('session_token') : null;
    }
    return await SecureStore.getItemAsync('session_token');
  } catch {
    return null;
  }
}

async function authFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await getStoredToken();
  return fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers as Record<string, string> || {}),
    },
  });
}

// Configure French locale
LocaleConfig.locales['fr'] = {
  monthNames: ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'],
  monthNamesShort: ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'],
  dayNames: ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'],
  dayNamesShort: ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'],
  today: "Aujourd'hui"
};
LocaleConfig.defaultLocale = 'fr';

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time?: string;
  endTime?: string;
  type: string;
  status?: string;
  proposedBy?: string;
  proposedByName?: string;
  playerNote?: string;
  alternativeDate?: string;
  alternativeTime?: string;
  _masked?: boolean; // personal event without details
}

const EVENT_STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  pending_approval: { label: 'En attente', color: '#F59E0B', icon: 'time' },
  confirmed:        { label: 'Confirmé',   color: '#10B981', icon: 'checkmark-circle' },
  refused:          { label: 'Refusé',     color: '#EF4444', icon: 'close-circle' },
  rescheduled:      { label: 'Autre horaire proposé', color: '#8B5CF6', icon: 'swap-horizontal' },
};

const EVENT_COLORS: Record<string, string> = {
  training: '#10B981',
  physicalPrep: '#F59E0B',
  match: '#EF4444',
  tournament: '#8B5CF6',
  recovery: '#06B6D4',
  meeting: '#6B7280',
  medical: '#E91E63',
  travel: '#9C27B0',
  other: '#607D8B',
};

const getDefaultEndTime = (startTime: string) => {
  const [hours, minutes] = startTime.split(':').map(Number);
  const endHours = (hours + 1) % 24;
  return `${endHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

export default function StaffCalendar() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showProposeModal, setShowProposeModal] = useState(false);

  // Propose slot form
  const [proposeTitle, setProposeTitle] = useState('');
  const [proposeDate, setProposeDate] = useState(new Date().toISOString().split('T')[0]);
  const [proposeTime, setProposeTime] = useState('09:00');
  const [proposeEndTime, setProposeEndTime] = useState('10:00');
  const [proposeNotes, setProposeNotes] = useState('');
  const [endTimeManuallySet, setEndTimeManuallySet] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [titleTouched, setTitleTouched] = useState(false);

  const linkedPlayerId = user?.player_id;
  const permissions = getStaffPermissions(user?.role);
  const canEdit = permissions?.canEditCalendar ?? false;

  const timeIsValid = proposeEndTime > proposeTime;
  const titleMissing = !proposeTitle.trim();
  const canSubmit = !titleMissing && timeIsValid;

  const loadEvents = useCallback(async () => {
    if (!linkedPlayerId) {
      setIsLoading(false);
      return;
    }

    try {
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 1);
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 2);

      const [eventsRes, tournamentsRes] = await Promise.all([
        authFetch(
          `/api/events?userId=${linkedPlayerId}&startDate=${startDate.toISOString().split('T')[0]}&endDate=${endDate.toISOString().split('T')[0]}`
        ),
        authFetch(`/api/tournaments/player-registrations?userId=${linkedPlayerId}&status=participating`),
      ]);

      if (eventsRes.ok) {
        const data = await eventsRes.json();
        setEvents(Array.isArray(data) ? data : []);
      }

      if (tournamentsRes.ok) {
        const data = await tournamentsRes.json();
        setTournaments(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error loading events:', error);
    } finally {
      setIsLoading(false);
    }
  }, [linkedPlayerId]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // Build marked dates for calendar
  const markedDates = useMemo(() => {
    const marks: Record<string, any> = {};

    events.forEach(event => {
      const color = EVENT_COLORS[event.type] || EVENT_COLORS.other;
      const isPending = event.status === 'pending_approval';

      if (!marks[event.date]) {
        marks[event.date] = { dots: [] };
      }
      marks[event.date].dots.push({
        key: event.id,
        color: isPending ? '#9CA3AF' : color,
      });
    });

    // Add tournament dots for every day in each participating tournament's span
    tournaments.forEach(t => {
      const start = t.startDate ? t.startDate.split('T')[0] : null;
      const end = t.endDate ? t.endDate.split('T')[0] : start;
      if (!start) return;
      const cur = new Date(start);
      const last = new Date(end || start);
      while (cur <= last) {
        const d = cur.toISOString().split('T')[0];
        if (!marks[d]) marks[d] = { dots: [] };
        if (!marks[d].dots) marks[d].dots = [];
        marks[d].dots.push({ key: `t-${t.id}-${d}`, color: EVENT_COLORS.tournament });
        cur.setDate(cur.getDate() + 1);
      }
    });

    // Add selected date marker
    if (marks[selectedDate]) {
      marks[selectedDate].selected = true;
      marks[selectedDate].selectedColor = '#1e3c72';
    } else {
      marks[selectedDate] = { selected: true, selectedColor: '#1e3c72' };
    }

    return marks;
  }, [events, tournaments, selectedDate]);

  // Events for selected date (including participating tournaments spanning that day)
  const dayEvents = useMemo(() => {
    const regular = events
      .filter(e => e.date === selectedDate)
      .sort((a, b) => (a.time || '').localeCompare(b.time || ''));

    const tournamentEvents: CalendarEvent[] = tournaments
      .filter(t => {
        const start = t.startDate ? t.startDate.split('T')[0] : null;
        const end = t.endDate ? t.endDate.split('T')[0] : start;
        return start && selectedDate >= start && selectedDate <= (end || start);
      })
      .map(t => ({
        id: `tournament-${t.id}`,
        title: t.name || 'Tournoi',
        date: selectedDate,
        type: 'tournament',
        status: undefined,
      }));

    return [...tournamentEvents, ...regular];
  }, [events, tournaments, selectedDate]);

  const handleProposeSlot = async () => {
    setTitleTouched(true);
    setSubmitError(null);

    if (!canSubmit) return;

    setIsSubmitting(true);
    try {
      const response = await authFetch(`/api/events`, {
        method: 'POST',
        body: JSON.stringify({
          title: proposeTitle.trim(),
          date: proposeDate,
          time: proposeTime,
          endTime: proposeEndTime,
          type: 'training',
          description: proposeNotes.trim() || undefined,
        }),
      });

      if (response.ok) {
        setShowProposeModal(false);
        resetProposeForm();
        loadEvents();
        // Success alert is OK here (only fires on actual success, not validation)
        Alert.alert('Proposition envoyée', 'Le joueur recevra une notification pour valider ce créneau.');
      } else {
        const body = await response.text().catch(() => '');
        setSubmitError(body || 'Impossible d\'envoyer la proposition. Vérifiez votre connexion.');
      }
    } catch {
      setSubmitError('Erreur réseau. Vérifiez votre connexion et réessayez.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetProposeForm = () => {
    setProposeTitle('');
    setProposeDate(selectedDate);
    setProposeTime('09:00');
    setProposeEndTime('10:00');
    setProposeNotes('');
    setEndTimeManuallySet(false);
    setSubmitError(null);
    setTitleTouched(false);
  };

  const openProposeModal = () => {
    setProposeDate(selectedDate);
    setShowProposeModal(true);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });
  };

  if (!linkedPlayerId) {
    return (
      <View style={[styles.errorContainer, { paddingTop: insets.top }]}>
        <Ionicons name="alert-circle" size={64} color="#EF4444" />
        <Text style={styles.errorTitle}>Aucun joueur associé</Text>
        <Text style={styles.errorText}>
          Votre compte n'est pas encore lié à un joueur.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Calendrier</Text>
        {!canEdit && (
          <View style={styles.readOnlyBadge}>
            <Ionicons name="eye" size={14} color="#6B7280" />
            <Text style={styles.readOnlyText}>Lecture seule</Text>
          </View>
        )}
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1e3c72" />
        </View>
      ) : (
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Calendar */}
          <Calendar
            current={selectedDate}
            onDayPress={(day) => setSelectedDate(day.dateString)}
            markingType="multi-dot"
            markedDates={markedDates}
            theme={{
              backgroundColor: '#FFFFFF',
              calendarBackground: '#FFFFFF',
              textSectionTitleColor: '#6B7280',
              selectedDayBackgroundColor: '#1e3c72',
              selectedDayTextColor: '#FFFFFF',
              todayTextColor: '#1e3c72',
              dayTextColor: '#1F2937',
              textDisabledColor: '#D1D5DB',
              arrowColor: '#1e3c72',
              monthTextColor: '#1F2937',
              textDayFontWeight: '500',
              textMonthFontWeight: '700',
              textDayHeaderFontWeight: '600',
            }}
            style={styles.calendar}
          />

          {/* Selected date events */}
          <View style={styles.eventsSection}>
            <Text style={styles.dateTitle}>{formatDate(selectedDate)}</Text>

            {dayEvents.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="calendar-outline" size={40} color="#D1D5DB" />
                <Text style={styles.emptyText}>Aucun événement ce jour</Text>
              </View>
            ) : (
              dayEvents.map(event => {
                const statusCfg = event.status ? EVENT_STATUS_CONFIG[event.status] : null;
                const isPending = event.status === 'pending_approval';
                const isMasked = event._masked;
                const barColor = isMasked
                  ? '#9CA3AF'
                  : isPending
                    ? '#F59E0B'
                    : (EVENT_COLORS[event.type] || EVENT_COLORS.other);

                return (
                  <View
                    key={event.id}
                    style={[
                      styles.eventCard,
                      isPending && styles.eventCardPending,
                      isMasked && styles.eventCardMasked,
                    ]}
                  >
                    <View style={[styles.eventColorBar, { backgroundColor: barColor }]} />
                    <View style={styles.eventContent}>
                      {/* Status badge */}
                      {statusCfg && (
                        <View style={[styles.statusBadge, { backgroundColor: statusCfg.color + '20' }]}>
                          <Ionicons name={statusCfg.icon as any} size={12} color={statusCfg.color} />
                          <Text style={[styles.statusBadgeText, { color: statusCfg.color }]}>
                            {statusCfg.label}
                          </Text>
                        </View>
                      )}

                      <Text style={[styles.eventTitle, (isPending || isMasked) && styles.textMuted]}>
                        {event.title}
                      </Text>

                      {event.time && (
                        <Text style={styles.eventTime}>
                          {event.time}{event.endTime ? ` → ${event.endTime}` : ''}
                        </Text>
                      )}

                      {event.proposedByName && (
                        <Text style={styles.proposedBy}>
                          Proposé par {event.proposedByName}
                        </Text>
                      )}

                      {/* Show player's response note */}
                      {event.playerNote && (
                        <Text style={styles.playerNote}>💬 {event.playerNote}</Text>
                      )}

                      {/* Rescheduled: show alternative */}
                      {event.status === 'rescheduled' && event.alternativeDate && (
                        <Text style={styles.alternativeTime}>
                          🔄 Horaire suggéré : {event.alternativeDate}
                          {event.alternativeTime ? ` à ${event.alternativeTime}` : ''}
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* FAB - Propose slot */}
      <PermissionGate permission="canEditCalendar">
        <TouchableOpacity
          style={[styles.fab, { bottom: insets.bottom + 90 }]}
          onPress={openProposeModal}
          activeOpacity={0.8}
          accessibilityLabel="Proposer un créneau au joueur"
          accessibilityRole="button"
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      </PermissionGate>

      {/* Propose Modal */}
      <Modal visible={showProposeModal} animationType="slide" transparent onRequestClose={() => {
        setShowProposeModal(false);
        resetProposeForm();
      }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => {
              setShowProposeModal(false);
              resetProposeForm();
            }}
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Proposer un créneau</Text>
              <TouchableOpacity onPress={() => {
                setShowProposeModal(false);
                resetProposeForm();
              }}>
                <Ionicons name="close" size={24} color="#1F2937" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Title */}
              <Text style={styles.inputLabel}>
                TITRE <Text style={{ color: '#EF4444' }}>*</Text>
              </Text>
              <TextInput
                style={[styles.textInput, titleTouched && titleMissing && styles.textInputError]}
                placeholder="Ex: Entraînement, Réunion..."
                value={proposeTitle}
                onChangeText={(t) => { setProposeTitle(t); setSubmitError(null); }}
                onBlur={() => setTitleTouched(true)}
                placeholderTextColor="#9CA3AF"
              />
              {titleTouched && titleMissing && (
                <View style={styles.fieldError}>
                  <Ionicons name="alert-circle" size={14} color="#EF4444" />
                  <Text style={styles.fieldErrorText}>Le titre est obligatoire</Text>
                </View>
              )}

              <View style={styles.pickerSpacer} />

              {/* Date Picker */}
              <AppleDatePicker
                value={proposeDate}
                onChange={setProposeDate}
                label="DATE"
              />

              <View style={styles.pickerSpacer} />

              {/* Time Pickers */}
              <Text style={styles.timeRangeLabel}>HORAIRES</Text>
              <View style={styles.timeRangeContainer}>
                <View style={styles.timePickerHalf}>
                  <AppleTimePicker
                    value={proposeTime}
                    onChange={(time) => {
                      setProposeTime(time);
                      if (!endTimeManuallySet) {
                        setProposeEndTime(getDefaultEndTime(time));
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
                    value={proposeEndTime}
                    onChange={(time) => {
                      setProposeEndTime(time);
                      setEndTimeManuallySet(true);
                    }}
                    minuteStep={5}
                    label="FIN"
                  />
                </View>
              </View>

              {/* Validation: fin >= début */}
              {!timeIsValid && (
                <View style={styles.validationError}>
                  <Ionicons name="warning" size={16} color="#D97706" />
                  <Text style={styles.validationErrorText}>
                    L'heure de fin doit être après l'heure de début
                  </Text>
                </View>
              )}

              <View style={styles.pickerSpacer} />

              {/* Notes */}
              <NotesInput
                label="NOTES (optionnel)"
                value={proposeNotes}
                onChange={setProposeNotes}
                placeholder="Détails supplémentaires..."
              />

              {submitError && (
                <View style={styles.submitErrorBox}>
                  <Ionicons name="alert-circle" size={16} color="#EF4444" />
                  <Text style={styles.submitErrorText}>{submitError}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.submitButton, (!canSubmit || isSubmitting) && styles.submitButtonDisabled]}
                onPress={handleProposeSlot}
                disabled={isSubmitting}
                activeOpacity={0.8}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="send" size={20} color="#FFFFFF" />
                    <Text style={styles.submitButtonText}>Envoyer la proposition</Text>
                  </>
                )}
              </TouchableOpacity>

              <Text style={styles.infoText}>
                Le joueur recevra une notification pour accepter ou refuser ce créneau.
              </Text>

              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  readOnlyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  readOnlyText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    padding: 32,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  calendar: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  eventsSection: {
    padding: 20,
  },
  dateTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
    textTransform: 'capitalize',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 12,
  },
  eventCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  eventCardPending: {
    opacity: 0.7,
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderStyle: 'dashed',
  },
  eventColorBar: {
    width: 4,
  },
  eventContent: {
    flex: 1,
    padding: 14,
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  textMuted: {
    color: '#6B7280',
  },
  eventTime: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
  },
  proposedBy: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
    marginTop: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  eventCardMasked: {
    opacity: 0.55,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  playerNote: {
    fontSize: 12,
    color: '#6366F1',
    fontStyle: 'italic',
    marginTop: 4,
  },
  alternativeTime: {
    fontSize: 12,
    color: '#8B5CF6',
    fontWeight: '600',
    marginTop: 4,
  },
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4A9B8E',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: '#1F2937',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  pickerSpacer: {
    height: 16,
  },
  timeRangeLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timeRangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  timePickerHalf: {
    flex: 1,
    alignItems: 'center',
  },
  timeRangeSeparator: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 24,
  },
  validationError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  validationErrorText: {
    fontSize: 13,
    color: '#D97706',
    fontWeight: '500',
    flex: 1,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4A9B8E',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 24,
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  infoText: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 12,
  },
  textInputError: {
    borderColor: '#EF4444',
    borderWidth: 1.5,
  },
  fieldError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  fieldErrorText: {
    fontSize: 12,
    color: '#EF4444',
  },
  submitErrorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  submitErrorText: {
    fontSize: 13,
    color: '#EF4444',
    flex: 1,
  },
});
