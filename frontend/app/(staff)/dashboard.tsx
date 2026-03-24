import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../src/context/AuthContext';
import { getStaffRoleLabel, getStaffRoleEmoji } from '../../src/types/staff';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

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

interface WeekEvent {
  id: string;
  title: string;
  date: string;
  time?: string;
  type: string;
}

interface Alert {
  id: string;
  type: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
}

interface PlayerProfile {
  name: string;
  firstName?: string;
  lastName?: string;
  ranking?: number;
  rankingPoints?: number;
}

// Helper to get day name
const getDayName = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('fr-FR', { weekday: 'short' });
};

// Helper to format time
const formatTime = (time?: string): string => {
  if (!time) return '';
  return time.substring(0, 5);
};

// Get current week bounds
const getWeekBounds = () => {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  monday.setHours(0, 0, 0, 0);
  
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  
  return { monday, sunday };
};

export default function StaffDashboard() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [weekEvents, setWeekEvents] = useState<WeekEvent[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [playerProfile, setPlayerProfile] = useState<PlayerProfile | null>(null);
  const [tournamentsCount, setTournamentsCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const linkedPlayerId = user?.player_id;

  const loadDashboardData = useCallback(async () => {
    if (!linkedPlayerId) {
      setIsLoading(false);
      return;
    }

    try {
      const { monday, sunday } = getWeekBounds();

      // Fetch events for the week (player's events, staff has access via linked player)
      const eventsRes = await authFetch(
        `/api/events?userId=${linkedPlayerId}&startDate=${monday.toISOString().split('T')[0]}&endDate=${sunday.toISOString().split('T')[0]}`
      );

      if (eventsRes.ok) {
        const eventsData = await eventsRes.json();
        setWeekEvents(Array.isArray(eventsData) ? eventsData.slice(0, 5) : []);
      }

      // Fetch staff's OWN alerts (event responses from player, comments, etc.)
      const alertsRes = await authFetch(`/api/alerts?unread_only=true`);

      if (alertsRes.ok) {
        const alertsData = await alertsRes.json();
        setAlerts(Array.isArray(alertsData) ? alertsData.slice(0, 5) : []);
      }

      // Fetch player profile
      const profileRes = await authFetch(`/api/users/${linkedPlayerId}`);

      if (profileRes.ok) {
        const profileData = await profileRes.json();
        setPlayerProfile(profileData);
      }

      // Fetch tournaments count
      const tournamentsRes = await authFetch(`/api/tournaments/weeks?circuits=ATP,WTA`);
      
      if (tournamentsRes.ok) {
        const tournamentsData = await tournamentsRes.json();
        // Count participating tournaments
        let count = 0;
        tournamentsData.weeks?.forEach((week: any) => {
          week.tournaments?.forEach((t: any) => {
            if (t.registration?.status === 'participating') count++;
          });
        });
        setTournamentsCount(count);
      }

    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [linkedPlayerId]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadDashboardData();
  }, [loadDashboardData]);

  const staffRoleLabel = getStaffRoleLabel(user?.role);
  const staffRoleEmoji = getStaffRoleEmoji(user?.role);
  const playerName = playerProfile?.name || 
    `${playerProfile?.firstName || ''} ${playerProfile?.lastName || ''}`.trim() || 
    'Joueur';

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#4A9B8E" />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

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
      <LinearGradient colors={['#1a2744', '#2d4a6f']} style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.greeting}>Bonjour, {user?.name?.split(' ')[0] || 'Staff'} 👋</Text>
          <Text style={styles.subtitle}>
            {staffRoleEmoji} {staffRoleLabel} · Joueur : {playerName}
          </Text>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4A9B8E" />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Cette semaine */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="flash" size={20} color="#F59E0B" />
            <Text style={styles.sectionTitle}>Cette semaine</Text>
          </View>
          <View style={styles.card}>
            {weekEvents.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="calendar-outline" size={32} color="#D1D5DB" />
                <Text style={styles.emptyText}>Aucun événement cette semaine</Text>
              </View>
            ) : (
              weekEvents.map((event, index) => (
                <View 
                  key={event.id} 
                  style={[styles.eventRow, index < weekEvents.length - 1 && styles.eventRowBorder]}
                >
                  <View style={styles.eventDay}>
                    <Text style={styles.eventDayText}>{getDayName(event.date)}</Text>
                  </View>
                  <View style={styles.eventInfo}>
                    <Text style={styles.eventTitle} numberOfLines={1}>{event.title}</Text>
                    {event.time && (
                      <Text style={styles.eventTime}>{formatTime(event.time)}</Text>
                    )}
                  </View>
                </View>
              ))
            )}
          </View>
        </View>

        {/* Alertes */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="notifications" size={20} color="#EF4444" />
            <Text style={styles.sectionTitle}>
              Alertes {alerts.length > 0 && `(${alerts.length})`}
            </Text>
          </View>
          <View style={styles.card}>
            {alerts.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="checkmark-circle-outline" size={32} color="#10B981" />
                <Text style={styles.emptyText}>Aucune alerte</Text>
              </View>
            ) : (
              alerts.map((alert, index) => (
                <View 
                  key={alert.id} 
                  style={[styles.alertRow, index < alerts.length - 1 && styles.alertRowBorder]}
                >
                  <View style={styles.alertIcon}>
                    <Ionicons 
                      name={alert.type === 'warning' ? 'warning' : 'information-circle'} 
                      size={20} 
                      color={alert.type === 'warning' ? '#F59E0B' : '#3B82F6'} 
                    />
                  </View>
                  <View style={styles.alertInfo}>
                    <Text style={styles.alertTitle}>{alert.title}</Text>
                    <Text style={styles.alertMessage} numberOfLines={1}>{alert.message}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </View>

        {/* Statut rapide */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="stats-chart" size={20} color="#8B5CF6" />
            <Text style={styles.sectionTitle}>Statut rapide</Text>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{playerProfile?.ranking || '—'}</Text>
              <Text style={styles.statLabel}>Classement</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{playerProfile?.rankingPoints || '—'}</Text>
              <Text style={styles.statLabel}>Points</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{tournamentsCount}</Text>
              <Text style={styles.statLabel}>Tournois</Text>
            </View>
          </View>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#6B7280',
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
  header: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    paddingBottom: 32,
  },
  headerContent: {
    gap: 4,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
    marginTop: -16,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 8,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  eventRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  eventDay: {
    width: 48,
    height: 40,
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  eventDayText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4F46E5',
    textTransform: 'capitalize',
  },
  eventInfo: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
  },
  eventTime: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  alertRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  alertIcon: {
    width: 36,
    height: 36,
    backgroundColor: '#FEF3C7',
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  alertInfo: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
  },
  alertMessage: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e3c72',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
});
