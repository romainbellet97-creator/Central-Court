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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { ALERT_TYPE_CONFIG, AlertType } from '../../src/data/alertsV1';

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
  const [alerts, setAlerts] = useState<StaffAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAll, setShowAll] = useState(false);

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
                  if (alert.eventId) {
                    // Navigate to calendar focused on this event
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
});
