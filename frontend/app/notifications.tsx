import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Linking,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Colors from '../src/constants/colors';
import AppleDatePickerFR from '../src/components/inputs/AppleDatePickerFR';
import AppleTimePicker from '../src/components/inputs/AppleTimePicker';
import {
  Alert,
  ALERT_TYPE_CONFIG,
  createSlotSuggestion,
} from '../src/data/alertsV1';
import { DEMO_STAFF } from '../src/data/staffV1';
import {
  fetchAlerts,
  markAlertRead,
  dismissAlert as apiDismissAlert,
  markAllAlertsRead,
  respondToEvent,
} from '../src/services/api';

// ============================================
// GÉNÉRATEURS DE LIENS INTELLIGENTS
// ============================================

const PLAYER_HOME_CITY = 'Paris';
const PLAYER_HOME_AIRPORT = 'CDG';

function generateBookingUrl(city: string, country: string, checkIn: string, checkOut: string): string {
  const checkInDate = new Date(checkIn);
  checkInDate.setDate(checkInDate.getDate() - 1);
  const checkOutDate = new Date(checkOut);
  checkOutDate.setDate(checkOutDate.getDate() + 1);
  const formatDate = (d: Date) => d.toISOString().split('T')[0];
  
  const params = new URLSearchParams({
    ss: `${city}, ${country}`,
    checkin: formatDate(checkInDate),
    checkout: formatDate(checkOutDate),
    group_adults: '1',
    no_rooms: '1',
    group_children: '0',
    sb_travel_purpose: 'business',
    nflt: 'hotelfacility=11;hotelfacility=107',
  });
  
  return `https://www.booking.com/searchresults.fr.html?${params.toString()}`;
}

function generateSkyscannerUrl(destinationCity: string, tournamentStart: string, tournamentEnd: string): string {
  const outboundDate = new Date(tournamentStart);
  outboundDate.setDate(outboundDate.getDate() - 1);
  const returnDate = new Date(tournamentEnd);
  returnDate.setDate(returnDate.getDate() + 1);
  
  const formatDateSky = (d: Date) => {
    const y = String(d.getFullYear()).slice(2);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}${m}${day}`;
  };
  
  const cityToAirport: Record<string, string> = {
    'Montpellier': 'MPL', 'Rotterdam': 'RTM', 'Pune': 'PNQ',
    'Acapulco': 'ACA', 'Doha': 'DOH', 'Dubai': 'DXB',
    'Buenos Aires': 'EZE', 'Santiago': 'SCL', 'Delray Beach': 'PBI',
  };
  
  const destAirport = cityToAirport[destinationCity] || destinationCity.toLowerCase().slice(0, 3);
  return `https://www.skyscanner.fr/transport/vols/${PLAYER_HOME_AIRPORT.toLowerCase()}/${destAirport.toLowerCase()}/${formatDateSky(outboundDate)}/${formatDateSky(returnDate)}/?adultsv2=1&cabinclass=economy`;
}

// ============================================
// COMPOSANT PRINCIPAL
// ============================================

// Convert YYYY-MM-DD ↔ DD/MM/YYYY for AppleDatePickerFR
const toFRDate = (iso: string): string => {
  if (!iso || !iso.includes('-')) return iso;
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};
const toISODate = (fr: string): string => {
  if (!fr || !fr.includes('/')) return fr;
  const [d, m, y] = fr.split('/');
  return `${y}-${m}-${d}`;
};

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  useEffect(() => {
    fetchAlerts()
      .then(data => setAlerts(data as Alert[]))
      .catch(err => console.warn('Failed to load alerts:', err))
      .finally(() => setLoading(false));
  }, []);
  
  // Modals
  const [showSuggestionModal, setShowSuggestionModal] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showRefuseModal, setShowRefuseModal] = useState(false);
  const [showCounterProposalModal, setShowCounterProposalModal] = useState(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  
  // State
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [refuseNote, setRefuseNote] = useState('');
  const [counterDate, setCounterDate] = useState('');
  const [counterTime, setCounterTime] = useState('');
  const [counterEndTime, setCounterEndTime] = useState('');
  const [counterMessage, setCounterMessage] = useState('');
  const [confirmationMessage, setConfirmationMessage] = useState('');
  
  const [bookingInfo, setBookingInfo] = useState<{
    type: 'flight' | 'hotel';
    url: string;
    details: { destination: string; dates: string; nights?: number; tournamentName: string; };
  } | null>(null);
  
  // Filtrer les alertes
  const filteredAlerts = useMemo(() => {
    let result = alerts.filter(a => !a.dismissed);
    if (filter === 'unread') {
      result = result.filter(a => !a.read);
    }
    return result.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [alerts, filter]);
  
  const unreadCount = alerts.filter(a => !a.read && !a.dismissed).length;
  
  const markAsRead = (alertId: string) => {
    setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, read: true } : a));
    markAlertRead(alertId).catch(err => console.warn('markAlertRead failed:', err));
  };

  const dismissAlert = (alertId: string) => {
    setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, dismissed: true } : a));
    apiDismissAlert(alertId).catch(err => console.warn('dismissAlert failed:', err));
  };

  const markAllAsRead = () => {
    setAlerts(prev => prev.map(a => ({ ...a, read: true })));
    markAllAlertsRead().catch(err => console.warn('markAllAlertsRead failed:', err));
  };
  
  // Action intelligente selon le type d'alerte
  const handleAlertAction = async (alert: Alert) => {
    markAsRead(alert.id);
    
    switch (alert.type) {
      case 'flight_missing':
        if (alert.tournamentCity && alert.tournamentStartDate && alert.tournamentEndDate) {
          const skyscannerUrl = generateSkyscannerUrl(alert.tournamentCity, alert.tournamentStartDate, alert.tournamentEndDate);
          const outbound = new Date(alert.tournamentStartDate);
          outbound.setDate(outbound.getDate() - 1);
          const returnD = new Date(alert.tournamentEndDate);
          returnD.setDate(returnD.getDate() + 1);
          
          setBookingInfo({
            type: 'flight',
            url: skyscannerUrl,
            details: {
              destination: `${PLAYER_HOME_CITY} → ${alert.tournamentCity}`,
              dates: `${outbound.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} → ${returnD.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}`,
              tournamentName: alert.tournamentName || '',
            }
          });
          setShowBookingModal(true);
        }
        break;
        
      case 'hotel_missing':
        if (alert.tournamentCity && alert.tournamentCountry && alert.tournamentStartDate && alert.tournamentEndDate) {
          const bookingUrl = generateBookingUrl(alert.tournamentCity, alert.tournamentCountry, alert.tournamentStartDate, alert.tournamentEndDate);
          const checkIn = new Date(alert.tournamentStartDate);
          checkIn.setDate(checkIn.getDate() - 1);
          const checkOut = new Date(alert.tournamentEndDate);
          checkOut.setDate(checkOut.getDate() + 1);
          const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
          
          setBookingInfo({
            type: 'hotel',
            url: bookingUrl,
            details: {
              destination: `${alert.tournamentCity}, ${alert.tournamentCountry}`,
              dates: `${checkIn.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} → ${checkOut.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}`,
              nights,
              tournamentName: alert.tournamentName || '',
            }
          });
          setShowBookingModal(true);
        }
        break;
        
      case 'slot_suggestion':
      case 'event_proposal':
        setSelectedAlert(alert);
        setShowSuggestionModal(true);
        break;

      default:
        router.push('/');
        break;
    }
  };
  
  // Accepter une suggestion de créneau
  const acceptSuggestion = async () => {
    if (!selectedAlert) return;

    setShowSuggestionModal(false);

    if (selectedAlert.eventId) {
      try { await respondToEvent(selectedAlert.eventId, 'accept'); } catch { /* ignore */ }
    }

    const slot = selectedAlert.targetSlot;
    setConfirmationMessage(
      `✅ Créneau confirmé\n\n` +
      (slot
        ? `📅 ${new Date(slot.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}\n🕐 ${slot.time} - ${slot.endTime}\n\n`
        : '') +
      `${selectedAlert.fromUserName} a été notifié de votre confirmation.`
    );

    setShowConfirmationModal(true);
    dismissAlert(selectedAlert.id);
  };
  
  // Refuser une suggestion - ouvrir le modal de refus
  const startRefuse = () => {
    setShowSuggestionModal(false);
    setRefuseNote('');
    setShowRefuseModal(true);
  };
  
  // Confirmer le refus simple
  const confirmRefuse = async () => {
    if (!selectedAlert) return;

    setShowRefuseModal(false);

    if (selectedAlert.eventId) {
      try { await respondToEvent(selectedAlert.eventId, 'refuse', { note: refuseNote || undefined }); } catch { /* ignore */ }
    }

    setConfirmationMessage(
      `❌ Créneau refusé\n\n` +
      `${selectedAlert.fromUserName} a été notifié${refuseNote ? ' avec votre message.' : '.'}`
    );
    setShowConfirmationModal(true);
    dismissAlert(selectedAlert.id);
    setRefuseNote('');
  };
  
  // Ouvrir le modal de contre-proposition
  const openCounterProposal = () => {
    setShowRefuseModal(false);
    if (selectedAlert?.targetSlot) {
      setCounterDate(selectedAlert.targetSlot.date);
      setCounterTime(selectedAlert.targetSlot.time || '13:00');
      setCounterEndTime(selectedAlert.targetSlot.endTime || '14:00');
    } else {
      setCounterDate(new Date().toISOString().split('T')[0]);
      setCounterTime('13:00');
      setCounterEndTime('14:00');
    }
    setCounterMessage('');
    setShowCounterProposalModal(true);
  };
  
  // Envoyer la contre-proposition
  const sendCounterProposal = async () => {
    if (!selectedAlert || !counterDate || !counterTime || !counterEndTime) return;

    setShowCounterProposalModal(false);

    if (selectedAlert.eventId) {
      try {
        await respondToEvent(selectedAlert.eventId, 'reschedule', {
          alternativeDate: counterDate,
          alternativeTime: counterTime,
          alternativeEndTime: counterEndTime,
          note: counterMessage || undefined,
        });
      } catch { /* ignore */ }
    }

    setConfirmationMessage(
      `🔄 Contre-proposition envoyée\n\n` +
      `📅 ${new Date(counterDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}\n` +
      `🕐 ${counterTime} - ${counterEndTime}\n\n` +
      `${selectedAlert.fromUserName} recevra votre proposition.`
    );
    setShowConfirmationModal(true);
    dismissAlert(selectedAlert.id);

    setCounterDate('');
    setCounterTime('');
    setCounterEndTime('');
    setCounterMessage('');
  };
  
  // Formatage du temps
  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'maintenant';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}j`;
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };
  
  // Render une carte d'alerte
  const renderAlertCard = (alert: Alert) => {
    const config = ALERT_TYPE_CONFIG[alert.type];
    const isUrgent = alert.priority === 'high';
    
    const getActionLabel = () => {
      if (alert.type === 'flight_missing') return 'Skyscanner';
      if (alert.type === 'hotel_missing') return 'Booking';
      if (alert.type === 'event_proposal') return 'Répondre';
      return config.actionLabel;
    };
    
    return (
      <TouchableOpacity
        key={alert.id}
        style={[styles.alertCard, !alert.read && styles.alertCardUnread]}
        onPress={() => handleAlertAction(alert)}
        activeOpacity={0.7}
      >
        {isUrgent && <View style={[styles.priorityIndicator, { backgroundColor: config.color }]} />}
        
        <View style={styles.alertMain}>
          <Text style={styles.alertIcon}>{config.icon}</Text>
          
          <View style={styles.alertContent}>
            <View style={styles.alertTitleRow}>
              <Text style={[styles.alertTitle, !alert.read && styles.alertTitleUnread]} numberOfLines={1}>
                {alert.title}
              </Text>
              <Text style={styles.alertTime}>{formatTime(alert.createdAt)}</Text>
            </View>
            <Text style={styles.alertMessage} numberOfLines={2}>{alert.message}</Text>
            {(alert.type === 'flight_missing' || alert.type === 'hotel_missing') && alert.tournamentCity && (
              <Text style={styles.alertDestination}>📍 {alert.tournamentCity}</Text>
            )}
          </View>
          
          <View style={styles.alertActions}>
            <TouchableOpacity 
              style={[styles.actionBtn, { backgroundColor: config.color + '15' }]}
              onPress={() => handleAlertAction(alert)}
            >
              <Text style={[styles.actionBtnText, { color: config.color }]}>{getActionLabel()}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.dismissBtn}
              onPress={() => dismissAlert(alert.id)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={18} color="#bdbdbd" />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };
  
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={markAllAsRead}>
            <Text style={styles.markAllRead}>Tout lire</Text>
          </TouchableOpacity>
        ) : <View style={{ width: 60 }} />}
      </View>
      
      {/* Filtres */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterBtn, filter === 'all' && styles.filterBtnActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterBtnText, filter === 'all' && styles.filterBtnTextActive]}>Toutes</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterBtn, filter === 'unread' && styles.filterBtnActive]}
          onPress={() => setFilter('unread')}
        >
          <Text style={[styles.filterBtnText, filter === 'unread' && styles.filterBtnTextActive]}>Non lues</Text>
          {unreadCount > 0 && (
            <View style={styles.badge}><Text style={styles.badgeText}>{unreadCount}</Text></View>
          )}
        </TouchableOpacity>
      </View>
      
      {/* Info */}
      <View style={styles.homeInfo}>
        <Ionicons name="home-outline" size={14} color="#9e9e9e" />
        <Text style={styles.homeInfoText}>Recherches depuis {PLAYER_HOME_CITY}</Text>
      </View>
      
      {/* Liste */}
      <ScrollView style={styles.list} showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>
        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={Colors.primary} />
        ) : filteredAlerts.length > 0 ? (
          filteredAlerts.map(renderAlertCard)
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>✓</Text>
            <Text style={styles.emptyText}>Tout est à jour</Text>
            <Text style={styles.emptySubtext}>
              {filter === 'unread' ? 'Toutes les notifications ont été lues' : 'Aucune notification'}
            </Text>
          </View>
        )}
      </ScrollView>
      
      {/* ===== MODAL: Suggestion / Proposition de créneau ===== */}
      <Modal visible={showSuggestionModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedAlert?.type === 'event_proposal' ? 'Proposition de créneau' : 'Suggestion de créneau'}
              </Text>
              <TouchableOpacity onPress={() => setShowSuggestionModal(false)}>
                <Ionicons name="close" size={24} color="#9e9e9e" />
              </TouchableOpacity>
            </View>
            
            {selectedAlert && (
              <>
                <View style={styles.infoBox}>
                  {/* Event name — for backend event_proposal the event name is before '·' in message */}
                  {(() => {
                    const eventName = selectedAlert.type === 'event_proposal'
                      ? selectedAlert.message.split('·')[0].trim()
                      : null;
                    return eventName ? (
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Événement</Text>
                        <Text style={[styles.infoValue, { fontSize: 16 }]}>{eventName}</Text>
                      </View>
                    ) : null;
                  })()}

                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>De</Text>
                    <Text style={styles.infoValue}>
                      {selectedAlert.fromUserName}
                      <Text style={styles.infoSub}> • {selectedAlert.fromUserRole}</Text>
                    </Text>
                  </View>

                  {selectedAlert.targetSlot && (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Créneau proposé</Text>
                      <Text style={styles.infoValue}>
                        {new Date(selectedAlert.targetSlot.date).toLocaleDateString('fr-FR', {
                          weekday: 'long', day: 'numeric', month: 'long'
                        })}
                      </Text>
                      {(selectedAlert.targetSlot.time || selectedAlert.targetSlot.endTime) ? (
                        <Text style={styles.infoTime}>
                          {selectedAlert.targetSlot.time}{selectedAlert.targetSlot.time && selectedAlert.targetSlot.endTime ? ' - ' : ''}{selectedAlert.targetSlot.endTime}
                        </Text>
                      ) : null}
                    </View>
                  )}

                  {/* Message row only for slot_suggestion (demo) — not for backend event_proposal */}
                  {selectedAlert.type !== 'event_proposal' && (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Message</Text>
                      <Text style={styles.infoMessage}>
                        {selectedAlert.message.split('•')[1]?.trim().replace(/"/g, '') || 'Séance proposée'}
                      </Text>
                    </View>
                  )}
                </View>
                
                <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.refuseBtn} onPress={startRefuse}>
                    <Text style={styles.refuseBtnText}>Refuser</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.acceptBtn} onPress={acceptSuggestion}>
                    <Ionicons name="checkmark" size={18} color="#fff" />
                    <Text style={styles.acceptBtnText}>Accepter</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
      
      {/* ===== MODAL: Refus avec options ===== */}
      <Modal visible={showRefuseModal} animationType="fade" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Refuser le créneau</Text>
              <TouchableOpacity onPress={() => setShowRefuseModal(false)}>
                <Ionicons name="close" size={24} color="#9e9e9e" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.modalSubtitle}>
              Ajouter une note (optionnel)
            </Text>
            
            <TextInput
              style={styles.textInput}
              placeholder="Ex: Je ne suis pas disponible ce jour-là..."
              placeholderTextColor="#bdbdbd"
              value={refuseNote}
              onChangeText={setRefuseNote}
              multiline
              numberOfLines={3}
            />
            
            <View style={styles.optionsDivider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>ou</Text>
              <View style={styles.dividerLine} />
            </View>
            
            <TouchableOpacity style={styles.counterBtn} onPress={openCounterProposal}>
              <Ionicons name="swap-horizontal" size={20} color="#9b51e0" />
              <Text style={styles.counterBtnText}>Proposer un autre créneau</Text>
            </TouchableOpacity>
            
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowRefuseModal(false)}>
                <Text style={styles.cancelBtnText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmRefuseBtn} onPress={confirmRefuse}>
                <Text style={styles.confirmRefuseBtnText}>Confirmer le refus</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      
      {/* ===== MODAL: Contre-proposition ===== */}
      <Modal visible={showCounterProposalModal} animationType="slide" transparent>
        <View style={styles.cpOverlay}>
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setShowCounterProposalModal(false)}
          />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={styles.cpSheet}>
              <View style={styles.cpHandle} />
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Proposer un créneau</Text>
                <TouchableOpacity onPress={() => setShowCounterProposalModal(false)}>
                  <Ionicons name="close" size={24} color="#9e9e9e" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
                <AppleDatePickerFR
                  value={toFRDate(counterDate)}
                  onChange={(fr) => setCounterDate(toISODate(fr))}
                  label="DATE"
                />

                <View style={styles.cpTimeSection}>
                  <AppleTimePicker
                    value={counterTime || '13:00'}
                    onChange={setCounterTime}
                    minuteStep={5}
                    label="HEURE DE DÉBUT"
                  />
                </View>

                <View style={styles.cpTimeSection}>
                  <AppleTimePicker
                    value={counterEndTime || '14:00'}
                    onChange={setCounterEndTime}
                    minuteStep={5}
                    label="HEURE DE FIN"
                  />
                </View>

                <View style={[styles.inputGroup, { marginTop: 16 }]}>
                  <Text style={styles.inputLabel}>MESSAGE (OPTIONNEL)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Ce créneau me conviendrait mieux..."
                    placeholderTextColor="#bdbdbd"
                    value={counterMessage}
                    onChangeText={setCounterMessage}
                    multiline
                    numberOfLines={2}
                  />
                </View>
              </ScrollView>

              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCounterProposalModal(false)}>
                  <Text style={styles.cancelBtnText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.sendBtn} onPress={sendCounterProposal}>
                  <Ionicons name="send" size={16} color="#fff" />
                  <Text style={styles.sendBtnText}>Envoyer</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
      
      {/* ===== MODAL: Confirmation ===== */}
      <Modal visible={showConfirmationModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentSmall}>
            <Text style={styles.confirmationText}>{confirmationMessage}</Text>
            <TouchableOpacity 
              style={styles.okBtn} 
              onPress={() => {
                setShowConfirmationModal(false);
                setSelectedAlert(null);
              }}
            >
              <Text style={styles.okBtnText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      
      {/* ===== MODAL: Booking (Vol/Hôtel) ===== */}
      <Modal visible={showBookingModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {bookingInfo?.type === 'flight' ? '✈️ Réserver un vol' : '🏨 Réserver un hôtel'}
              </Text>
              <TouchableOpacity onPress={() => setShowBookingModal(false)}>
                <Ionicons name="close" size={24} color="#9e9e9e" />
              </TouchableOpacity>
            </View>
            
            {bookingInfo && (
              <>
                <View style={styles.infoBox}>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>{bookingInfo.type === 'flight' ? 'Trajet' : 'Destination'}</Text>
                    <Text style={styles.infoValue}>{bookingInfo.details.destination}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Dates</Text>
                    <Text style={styles.infoValue}>{bookingInfo.details.dates}</Text>
                    {bookingInfo.details.nights && (
                      <Text style={styles.infoNights}>{bookingInfo.details.nights} nuits</Text>
                    )}
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Tournoi</Text>
                    <Text style={styles.infoSub}>{bookingInfo.details.tournamentName}</Text>
                  </View>
                </View>
                
                <View style={styles.tipBox}>
                  <Ionicons name="bulb-outline" size={16} color="#f2994a" />
                  <Text style={styles.tipText}>
                    {bookingInfo.type === 'flight' 
                      ? 'Dates optimisées: arrivée 1j avant, retour 1j après'
                      : 'Filtres: WiFi gratuit, salle de sport'}
                  </Text>
                </View>
                
                <TouchableOpacity
                  style={[styles.bookingBtn, { backgroundColor: bookingInfo.type === 'flight' ? '#00a698' : '#003580' }]}
                  onPress={() => { Linking.openURL(bookingInfo.url); setShowBookingModal(false); }}
                >
                  <Text style={styles.bookingBtnText}>
                    Ouvrir {bookingInfo.type === 'flight' ? 'Skyscanner' : 'Booking.com'}
                  </Text>
                  <Ionicons name="open-outline" size={18} color="#fff" />
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.laterBtn} onPress={() => setShowBookingModal(false)}>
                  <Text style={styles.laterBtnText}>Plus tard</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  backBtn: { width: 40 },
  headerTitle: { fontSize: 17, fontWeight: '600', color: '#1a1a1a', letterSpacing: -0.3 },
  markAllRead: { fontSize: 14, fontWeight: '500', color: '#2d9cdb' },
  filterRow: {
    flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, gap: 8,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  filterBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6,
  },
  filterBtnActive: { backgroundColor: '#f5f5f5' },
  filterBtnText: { fontSize: 14, fontWeight: '500', color: '#9e9e9e' },
  filterBtnTextActive: { color: '#1a1a1a' },
  badge: {
    marginLeft: 6, minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: '#eb5757', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5,
  },
  badgeText: { fontSize: 11, fontWeight: '600', color: '#fff' },
  homeInfo: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#fafafa',
  },
  homeInfoText: { fontSize: 12, color: '#9e9e9e' },
  list: { flex: 1 },
  listContent: { paddingVertical: 8 },
  alertCard: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 16,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f5f5f5',
  },
  alertCardUnread: { backgroundColor: '#fafbff' },
  priorityIndicator: {
    position: 'absolute', left: 0, top: 14, bottom: 14, width: 3, borderRadius: 2,
  },
  alertMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  alertIcon: { fontSize: 20, width: 28, textAlign: 'center' },
  alertContent: { flex: 1, gap: 2 },
  alertTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  alertTitle: { fontSize: 14, fontWeight: '500', color: '#4f4f4f', flex: 1 },
  alertTitleUnread: { fontWeight: '600', color: '#1a1a1a' },
  alertTime: { fontSize: 12, color: '#bdbdbd', marginLeft: 8 },
  alertMessage: { fontSize: 13, color: '#9e9e9e', lineHeight: 18 },
  alertDestination: { fontSize: 12, color: '#2d9cdb', marginTop: 2 },
  alertActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 4 },
  actionBtnText: { fontSize: 12, fontWeight: '600' },
  dismissBtn: { padding: 4 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyIcon: { fontSize: 48, color: '#27ae60', marginBottom: 16 },
  emptyText: { fontSize: 17, fontWeight: '600', color: '#1a1a1a', marginBottom: 4 },
  emptySubtext: { fontSize: 14, color: '#9e9e9e' },
  
  // Modal base
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center', padding: 20,
  },
  modalContent: {
    width: '100%', maxWidth: 400, backgroundColor: '#fff', borderRadius: 12, padding: 20,
  },
  modalContentSmall: {
    width: '100%', maxWidth: 320, backgroundColor: '#fff', borderRadius: 12, padding: 24,
    alignItems: 'center',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20,
  },
  modalTitle: { fontSize: 17, fontWeight: '600', color: '#1a1a1a' },
  modalSubtitle: { fontSize: 14, color: '#9e9e9e', marginBottom: 12 },
  
  // Info box
  infoBox: { backgroundColor: '#f9f9f9', borderRadius: 8, padding: 16, gap: 14 },
  infoRow: { gap: 4 },
  infoLabel: { fontSize: 11, fontWeight: '600', color: '#9e9e9e', textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  infoSub: { fontSize: 14, fontWeight: '400', color: '#4f4f4f' },
  infoTime: { fontSize: 14, fontWeight: '500', color: '#2d9cdb', marginTop: 2 },
  infoMessage: { fontSize: 14, color: '#4f4f4f', fontStyle: 'italic' },
  infoNights: { fontSize: 13, color: '#2d9cdb', marginTop: 2 },
  
  // Tip box
  tipBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16,
    padding: 12, backgroundColor: '#fff9f0', borderRadius: 8,
  },
  tipText: { flex: 1, fontSize: 13, color: '#9e6c00', lineHeight: 18 },
  
  // Actions
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 20 },
  refuseBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 8,
    backgroundColor: '#f5f5f5', alignItems: 'center',
  },
  refuseBtnText: { fontSize: 15, fontWeight: '600', color: '#4f4f4f' },
  acceptBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: 8, backgroundColor: '#1a1a1a',
  },
  acceptBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  
  // Refuse modal
  textInput: {
    backgroundColor: '#f9f9f9', borderRadius: 8, padding: 14, fontSize: 14, color: '#1a1a1a',
    minHeight: 80, textAlignVertical: 'top',
  },
  textInputSmall: {
    backgroundColor: '#f9f9f9', borderRadius: 8, padding: 12, fontSize: 14, color: '#1a1a1a',
  },
  optionsDivider: {
    flexDirection: 'row', alignItems: 'center', marginVertical: 16, gap: 12,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#e0e0e0' },
  dividerText: { fontSize: 12, color: '#9e9e9e' },
  counterBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 8, borderWidth: 1, borderColor: '#9b51e0', borderStyle: 'dashed',
  },
  counterBtnText: { fontSize: 14, fontWeight: '600', color: '#9b51e0' },
  cancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: '#f5f5f5', alignItems: 'center',
  },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: '#9e9e9e' },
  confirmRefuseBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: '#eb5757', alignItems: 'center',
  },
  confirmRefuseBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  
  // Counter proposal
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 12, fontWeight: '600', color: '#9e9e9e', marginBottom: 8, textTransform: 'uppercase' },
  timeRow: { flexDirection: 'row' },
  sendBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: 8, backgroundColor: '#9b51e0',
  },
  sendBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },

  // Counter proposal - bottom sheet
  cpOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  cpSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    maxHeight: '90%',
  },
  cpHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  cpTimeSection: {
    marginTop: 16,
    alignItems: 'center',
  },
  
  // Confirmation
  confirmationText: { fontSize: 15, color: '#1a1a1a', textAlign: 'center', lineHeight: 24, marginBottom: 20 },
  okBtn: {
    paddingVertical: 12, paddingHorizontal: 40, borderRadius: 8, backgroundColor: '#1a1a1a',
  },
  okBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  
  // Booking
  bookingBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 8, marginTop: 20,
  },
  bookingBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  laterBtn: { alignItems: 'center', paddingVertical: 12, marginTop: 8 },
  laterBtnText: { fontSize: 14, fontWeight: '500', color: '#9e9e9e' },
});
