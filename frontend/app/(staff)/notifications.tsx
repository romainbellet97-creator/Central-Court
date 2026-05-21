import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Modal,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { ALERT_TYPE_CONFIG, AlertType } from '../../src/data/alertsV1';
import { useAuth } from '../../src/context/AuthContext';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL ||
                process.env.EXPO_PUBLIC_BACKEND_URL || '';

async function getStoredToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return typeof localStorage !== 'undefined' ? localStorage.getItem('session_token') : null;
    return await SecureStore.getItemAsync('session_token');
  } catch { return null; }
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

interface StaffAlert {
  id: string;
  type: AlertType;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  dismissed: boolean;
  eventId?: string;
  fromUserName?: string;
  fromUserRole?: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'à l\'instant';
  if (m < 60) return `il y a ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h}h`;
  const d = Math.floor(h / 24);
  return `il y a ${d}j`;
}

export default function StaffNotifications() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<StaffAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [selectedResponseAlert, setSelectedResponseAlert] = useState<StaffAlert | null>(null);
  const [acceptingResponse, setAcceptingResponse] = useState(false);

  // Observation reply modal
  const [showObsModal, setShowObsModal] = useState(false);
  const [selectedObsAlert, setSelectedObsAlert] = useState<StaffAlert | null>(null);
  const [obsReplyText, setObsReplyText] = useState('');
  const [sendingObsReply, setSendingObsReply] = useState(false);

  // Info modal (event_accepted / event_refused / event_created / event_modified)
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [selectedInfoAlert, setSelectedInfoAlert] = useState<StaffAlert | null>(null);

  const loadAlerts = useCallback(async () => {
    try {
      const res = await authFetch('/api/alerts');
      if (res.ok) {
        const data = await res.json();
        setAlerts(Array.isArray(data) ? data.filter((a: StaffAlert) => !a.dismissed) : []);
      }
    } catch (e) {
      console.error('Failed to load staff alerts:', e);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const markRead = async (alertId: string) => {
    try {
      await authFetch(`/api/alerts/${alertId}/read`, { method: 'PUT' });
      setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, read: true } : a));
    } catch { /* ignore */ }
  };

  const dismiss = async (alertId: string) => {
    try {
      await authFetch(`/api/alerts/${alertId}/dismiss`, { method: 'PUT' });
      setAlerts(prev => prev.filter(a => a.id !== alertId));
    } catch { /* ignore */ }
  };

  const markAllRead = async () => {
    try {
      await authFetch('/api/alerts/read-all', { method: 'PUT' });
      setAlerts(prev => prev.map(a => ({ ...a, read: true })));
    } catch { /* ignore */ }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadAlerts();
  }, [loadAlerts]);

  const handleAcceptCounterProposal = async () => {
    if (!selectedResponseAlert?.eventId) {
      setShowResponseModal(false);
      setSelectedResponseAlert(null);
      return;
    }
    setAcceptingResponse(true);
    try {
      await authFetch(`/api/events/${selectedResponseAlert.eventId}/confirm-reschedule`, { method: 'PUT' });
      dismiss(selectedResponseAlert.id);
    } catch { /* ignore */ }
    setAcceptingResponse(false);
    setShowResponseModal(false);
    setSelectedResponseAlert(null);
  };

  const handleSendObsReply = async () => {
    if (!selectedObsAlert?.eventId || !obsReplyText.trim()) return;
    setSendingObsReply(true);
    try {
      await authFetch(`/api/events/${selectedObsAlert.eventId}/observations`, {
        method: 'POST',
        body: JSON.stringify({
          author: user?.name || 'Agent',
          role: user?.role || 'staff',
          text: obsReplyText.trim(),
          parentId: null,
        }),
      });
      dismiss(selectedObsAlert.id);
    } catch { /* ignore */ }
    setSendingObsReply(false);
    setShowObsModal(false);
    setSelectedObsAlert(null);
    setObsReplyText('');
  };

  const unreadCount = alerts.filter(a => !a.read).length;
  const displayed = showAll ? alerts : alerts.filter(a => !a.read).concat(alerts.filter(a => a.read)).slice(0, 30);

  if (isLoading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#4A9B8E" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <Text style={styles.unreadBadge}>{unreadCount} non lue{unreadCount > 1 ? 's' : ''}</Text>
          )}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllRead} style={styles.markAllBtn}>
            <Text style={styles.markAllText}>Tout lire</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4A9B8E" />}
        showsVerticalScrollIndicator={false}
      >
        {displayed.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="notifications-outline" size={48} color="#D1D5DB" />
            <Text style={styles.emptyText}>Aucune notification</Text>
          </View>
        ) : (
          displayed.map(alert => {
            const config = ALERT_TYPE_CONFIG[alert.type] || { icon: '🔔', color: '#6B7280', label: alert.type };
            return (
              <TouchableOpacity
                key={alert.id}
                style={[styles.alertRow, !alert.read && styles.alertRowUnread]}
                onPress={() => {
                  markRead(alert.id);
                  if (alert.type === 'event_rescheduled' && alert.eventId) {
                    setSelectedResponseAlert(alert);
                    setShowResponseModal(true);
                  } else if (alert.type === 'event_comment' && alert.eventId) {
                    setSelectedObsAlert(alert);
                    setObsReplyText('');
                    setShowObsModal(true);
                  } else if (
                    (alert.type === 'event_accepted' ||
                     alert.type === 'event_refused' ||
                     alert.type === 'event_created' ||
                     alert.type === 'event_modified') &&
                    alert.eventId
                  ) {
                    setSelectedInfoAlert(alert);
                    setShowInfoModal(true);
                  } else if (alert.eventId) {
                    router.push('/(staff)/calendar');
                  }
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.iconWrap, { backgroundColor: config.color + '20' }]}>
                  <Text style={styles.iconText}>{config.icon}</Text>
                </View>
                <View style={styles.alertContent}>
                  <View style={styles.alertTopRow}>
                    <Text style={styles.alertTitle} numberOfLines={1}>{alert.title}</Text>
                    <Text style={styles.alertTime}>{timeAgo(alert.createdAt)}</Text>
                  </View>
                  <Text style={styles.alertMessage} numberOfLines={2}>{alert.message}</Text>
                  {alert.fromUserName && (
                    <Text style={styles.alertFrom}>De : {alert.fromUserName}{alert.fromUserRole ? ` · ${alert.fromUserRole}` : ''}</Text>
                  )}
                </View>
                {!alert.read && <View style={styles.unreadDot} />}
                <TouchableOpacity
                  onPress={() => dismiss(alert.id)}
                  style={styles.dismissBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close" size={16} color="#9CA3AF" />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })
        )}

        {!showAll && alerts.length > 30 && (
          <TouchableOpacity style={styles.showMoreBtn} onPress={() => setShowAll(true)}>
            <Text style={styles.showMoreText}>Voir tout ({alerts.length})</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* ===== MODAL: Répondre à une observation ===== */}
      <Modal
        visible={showObsModal}
        animationType="slide"
        transparent
        onRequestClose={() => { setShowObsModal(false); setSelectedObsAlert(null); setObsReplyText(''); }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.responseOverlay}
        >
          <View style={styles.responseContent}>
            <View style={styles.responseHeader}>
              <Text style={styles.responseTitle}>Observation du joueur</Text>
              <TouchableOpacity onPress={() => { setShowObsModal(false); setSelectedObsAlert(null); setObsReplyText(''); }}>
                <Ionicons name="close" size={24} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            {selectedObsAlert && (
              <>
                <View style={styles.proposalBox}>
                  <Text style={styles.proposalAlertTitle}>{selectedObsAlert.title}</Text>
                  <Text style={styles.proposalAlertMessage}>{selectedObsAlert.message}</Text>
                  {selectedObsAlert.fromUserName && (
                    <Text style={styles.proposalAlertFrom}>
                      De : {selectedObsAlert.fromUserName}{selectedObsAlert.fromUserRole ? ` · ${selectedObsAlert.fromUserRole}` : ''}
                    </Text>
                  )}
                </View>

                <Text style={styles.obsReplyLabel}>VOTRE RÉPONSE</Text>
                <TextInput
                  style={styles.obsReplyInput}
                  placeholder="Écrire une réponse..."
                  placeholderTextColor="#9CA3AF"
                  value={obsReplyText}
                  onChangeText={setObsReplyText}
                  multiline
                  maxLength={500}
                  autoCorrect
                  autoCapitalize="sentences"
                />
                <Text style={styles.obsCharCount}>{obsReplyText.length}/500</Text>

                <TouchableOpacity
                  style={[styles.responseAcceptBtn, { backgroundColor: '#4A9B8E' }, (!obsReplyText.trim() || sendingObsReply) && { opacity: 0.5 }]}
                  onPress={handleSendObsReply}
                  disabled={!obsReplyText.trim() || sendingObsReply}
                >
                  {sendingObsReply ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Ionicons name="send" size={18} color="#fff" />
                      <Text style={styles.responseAcceptBtnText}>Envoyer la réponse</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.responseCounterBtn}
                  onPress={() => { setShowObsModal(false); setSelectedObsAlert(null); setObsReplyText(''); router.push('/(staff)/calendar'); }}
                >
                  <Ionicons name="calendar-outline" size={18} color="#4A9B8E" />
                  <Text style={styles.responseCounterBtnText}>Voir le calendrier</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ===== MODAL: Réponse à la contre-proposition ===== */}
      <Modal visible={showResponseModal} animationType="fade" transparent>
        <View style={styles.responseOverlay}>
          <View style={styles.responseContent}>
            <View style={styles.responseHeader}>
              <Text style={styles.responseTitle}>Contre-proposition</Text>
              <TouchableOpacity onPress={() => { setShowResponseModal(false); setSelectedResponseAlert(null); }}>
                <Ionicons name="close" size={24} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            {selectedResponseAlert && (
              <>
                <View style={styles.proposalBox}>
                  <Text style={styles.proposalAlertTitle}>{selectedResponseAlert.title}</Text>
                  <Text style={styles.proposalAlertMessage}>{selectedResponseAlert.message}</Text>
                  {selectedResponseAlert.fromUserName && (
                    <Text style={styles.proposalAlertFrom}>
                      De : {selectedResponseAlert.fromUserName}{selectedResponseAlert.fromUserRole ? ` · ${selectedResponseAlert.fromUserRole}` : ''}
                    </Text>
                  )}
                </View>

                <TouchableOpacity
                  style={[styles.responseAcceptBtn, acceptingResponse && { opacity: 0.6 }]}
                  onPress={handleAcceptCounterProposal}
                  disabled={acceptingResponse}
                >
                  {acceptingResponse ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={20} color="#fff" />
                      <Text style={styles.responseAcceptBtnText}>Confirmer le nouvel horaire</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.responseCounterBtn}
                  onPress={() => {
                    setShowResponseModal(false);
                    setSelectedResponseAlert(null);
                    router.push('/(staff)/calendar');
                  }}
                >
                  <Ionicons name="swap-horizontal" size={20} color="#4A9B8E" />
                  <Text style={styles.responseCounterBtnText}>Proposer un autre horaire</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ===== MODAL: Info (event_accepted / event_refused / event_created / event_modified) ===== */}
      <Modal
        visible={showInfoModal}
        animationType="fade"
        transparent
        onRequestClose={() => { setShowInfoModal(false); setSelectedInfoAlert(null); }}
      >
        <View style={styles.responseOverlay}>
          <View style={styles.responseContent}>
            {selectedInfoAlert && (() => {
              const isRefused = selectedInfoAlert.type === 'event_refused';
              const isAccepted = selectedInfoAlert.type === 'event_accepted';
              const accentColor = isAccepted ? '#10B981' : isRefused ? '#EF4444' : '#4A9B8E';
              return (
                <>
                  <View style={styles.responseHeader}>
                    <Text style={[styles.responseTitle, { color: accentColor }]}>
                      {isAccepted ? '✅ Créneau accepté' :
                       isRefused  ? '❌ Créneau refusé' :
                       selectedInfoAlert.type === 'event_created' ? '📅 Nouvel événement' :
                       '✏️ Événement modifié'}
                    </Text>
                    <TouchableOpacity onPress={() => { setShowInfoModal(false); setSelectedInfoAlert(null); }}>
                      <Ionicons name="close" size={24} color="#9CA3AF" />
                    </TouchableOpacity>
                  </View>

                  <View style={[styles.proposalBox, { borderLeftWidth: 3, borderLeftColor: accentColor }]}>
                    <Text style={styles.proposalAlertTitle}>{selectedInfoAlert.title}</Text>
                    <Text style={styles.proposalAlertMessage}>{selectedInfoAlert.message}</Text>
                    {selectedInfoAlert.fromUserName && (
                      <Text style={styles.proposalAlertFrom}>
                        De : {selectedInfoAlert.fromUserName}
                      </Text>
                    )}
                  </View>

                  {isRefused ? (
                    <>
                      <TouchableOpacity
                        style={[styles.responseAcceptBtn, { backgroundColor: '#4A9B8E' }]}
                        onPress={() => {
                          setShowInfoModal(false);
                          setSelectedInfoAlert(null);
                          router.push('/(staff)/calendar');
                        }}
                      >
                        <Ionicons name="swap-horizontal" size={20} color="#fff" />
                        <Text style={styles.responseAcceptBtnText}>Proposer un autre créneau</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.responseCounterBtn}
                        onPress={() => { dismiss(selectedInfoAlert.id); setShowInfoModal(false); setSelectedInfoAlert(null); }}
                      >
                        <Text style={styles.responseCounterBtnText}>Ignorer</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <TouchableOpacity
                      style={[styles.responseAcceptBtn, { backgroundColor: accentColor }]}
                      onPress={() => {
                        dismiss(selectedInfoAlert.id);
                        setShowInfoModal(false);
                        setSelectedInfoAlert(null);
                        router.push('/(staff)/calendar');
                      }}
                    >
                      <Ionicons name="calendar-outline" size={20} color="#fff" />
                      <Text style={styles.responseAcceptBtnText}>Voir le calendrier</Text>
                    </TouchableOpacity>
                  )}
                </>
              );
            })()}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a2744',
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: 8,
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#FFFFFF' },
  unreadBadge: { fontSize: 13, color: '#4A9B8E', marginTop: 2 },
  markAllBtn: {
    backgroundColor: 'rgba(74,155,142,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  markAllText: { color: '#4A9B8E', fontWeight: '600', fontSize: 13 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 32 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyText: { color: '#9CA3AF', fontSize: 16 },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    padding: 14,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  alertRowUnread: {
    borderLeftWidth: 3,
    borderLeftColor: '#4A9B8E',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { fontSize: 20 },
  alertContent: { flex: 1 },
  alertTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 3 },
  alertTitle: { fontSize: 14, fontWeight: '700', color: '#111827', flex: 1, marginRight: 8 },
  alertTime: { fontSize: 11, color: '#9CA3AF', flexShrink: 0 },
  alertMessage: { fontSize: 13, color: '#374151', lineHeight: 18 },
  alertFrom: { fontSize: 11, color: '#6B7280', marginTop: 4 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4A9B8E',
    marginTop: 6,
  },
  dismissBtn: { padding: 4, marginTop: 2 },
  showMoreBtn: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 8,
  },
  showMoreText: { color: '#4A9B8E', fontWeight: '600', fontSize: 14 },

  // Counter-proposal response modal
  responseOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  responseContent: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
  },
  responseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  responseTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  proposalBox: {
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    gap: 6,
  },
  proposalAlertTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  proposalAlertMessage: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
  },
  proposalAlertFrom: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  responseAcceptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 10,
  },
  responseAcceptBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  responseCounterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#4A9B8E',
    borderRadius: 12,
    paddingVertical: 14,
  },
  responseCounterBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4A9B8E',
  },

  // Observation reply modal
  obsReplyLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 4,
  },
  obsReplyInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    padding: 12,
    fontSize: 15,
    color: '#1F2937',
    minHeight: 100,
    maxHeight: 200,
    textAlignVertical: 'top',
  },
  obsCharCount: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'right',
    marginTop: 4,
    marginBottom: 12,
  },
});
