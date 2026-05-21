import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '../../src/context/AuthContext';
import { PermissionGate } from '../../src/components/PermissionGate';
import { getStaffRoleLabel } from '../../src/types/staff';
import Constants from 'expo-constants';

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

interface PlayerProfile {
  id?: string;
  prenom?: string;
  email?: string;
  dateNaissance?: string;
  nationality?: string;
  classement?: string;
  circuits?: string[];
  residenceFiscale?: string;
  travelPreferences?: {
    flightClass?: string;
    seatPreference?: string;
    mealPreference?: string;
  };
  hotelPreferences?: {
    roomType?: string;
    essentialAmenities?: string[];
  };
  foodPreferences?: {
    restrictions?: string[];
    allergies?: string[];
  };
}

interface Tournament {
  id: string;
  name: string;
  city: string;
  country: string;
  startDate: string;
  endDate: string;
  category: string;
  surface: string;
}

export default function PlayerInfo() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [player, setPlayer] = useState<PlayerProfile | null>(null);
  const [upcomingTournaments, setUpcomingTournaments] = useState<Tournament[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const linkedPlayerId = user?.player_id;
  const staffRoleLabel = getStaffRoleLabel(user?.role);

  const loadPlayerData = useCallback(async () => {
    if (!linkedPlayerId) {
      setIsLoading(false);
      return;
    }

    try {
      // Fetch player profile with auth
      const profileRes = await authFetch(`/api/users/profile/${linkedPlayerId}`);
      if (profileRes.ok) {
        const profileData = await profileRes.json();
        setPlayer(profileData);
      }

      // Fetch confirmed tournament registrations for this player
      const tournamentsRes = await authFetch(
        `/api/tournaments/player-registrations?userId=${linkedPlayerId}&status=participating`
      );
      if (tournamentsRes.ok) {
        const data = await tournamentsRes.json();
        const list: Tournament[] = Array.isArray(data) ? data : (data.tournaments || []);
        setUpcomingTournaments(list.slice(0, 5));
      }
    } catch (error) {
      console.error('Error loading player data:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [linkedPlayerId]);

  useEffect(() => {
    loadPlayerData();
  }, [loadPlayerData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadPlayerData();
  }, [loadPlayerData]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Non renseigné';
    const parts = dateStr.split('T')[0].split('-').map(Number);
    if (parts.length < 3) return dateStr;
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatTournamentDates = (start?: string, end?: string) => {
    if (!start || !end) return '';
    const startDate = new Date(start);
    const endDate = new Date(end);
    return `${startDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} - ${endDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;
  };

  const CIRCUIT_LABELS: Record<string, string> = {
    atp: 'ATP',
    wta: 'WTA',
    itf: 'ITF',
    itf_wheelchair: 'ITF Wheelchair',
    challenger: 'Challenger',
    future: 'Future',
  };

  const formatCircuit = (c: string) => {
    const key = c.toLowerCase().replace(/-/g, '_');
    return CIRCUIT_LABELS[key] || c;
  };

  const playerName = player?.prenom || 'Joueur';

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

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#1e3c72" />
        <Text style={styles.loadingText}>Chargement du profil...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1e3c72" />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Player Header */}
        <LinearGradient colors={['#1e3c72', '#2a5298']} style={styles.playerHeader}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>
              {playerName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.playerName}>{playerName}</Text>
          <Text style={styles.staffRole}>Vous : {staffRoleLabel}</Text>
        </LinearGradient>

        {/* Profile Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="person" size={20} color="#1e3c72" />
            <Text style={styles.sectionTitle}>Profil</Text>
          </View>
          <View style={styles.card}>
            <InfoRow label="Prénom" value={playerName} />
            <InfoRow label="Email" value={player?.email || 'Non renseigné'} />
            <InfoRow label="Circuits" value={player?.circuits?.map(formatCircuit).join(', ') || 'Non renseigné'} />
            <InfoRow
              label="Date de naissance"
              value={formatDate(player?.dateNaissance)}
              isLast
            />
          </View>
        </View>

        {/* Ranking Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="trophy" size={20} color="#F59E0B" />
            <Text style={styles.sectionTitle}>Classement</Text>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{player?.classement || '—'}</Text>
              <Text style={styles.statLabel}>Classement</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, styles.statValueCircuit]} numberOfLines={2} adjustsFontSizeToFit>
                {player?.circuits?.[0] ? formatCircuit(player.circuits[0]) : '—'}
              </Text>
              <Text style={styles.statLabel}>Circuit</Text>
            </View>
          </View>
        </View>

        {/* Tournaments Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="calendar" size={20} color="#8B5CF6" />
            <Text style={styles.sectionTitle}>Tournois confirmés</Text>
          </View>
          <View style={styles.card}>
            {upcomingTournaments.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="calendar-outline" size={32} color="#D1D5DB" />
                <Text style={styles.emptyText}>Aucun tournoi confirmé</Text>
              </View>
            ) : (
              upcomingTournaments.map((tournament, index) => (
                <View 
                  key={tournament.id} 
                  style={[
                    styles.tournamentRow,
                    index < upcomingTournaments.length - 1 && styles.rowBorder
                  ]}
                >
                  <View style={styles.tournamentInfo}>
                    <Text style={styles.tournamentName}>{tournament.name}</Text>
                    <Text style={styles.tournamentMeta}>
                      {tournament.city}, {tournament.country}
                    </Text>
                    <Text style={styles.tournamentDates}>
                      {formatTournamentDates(tournament.startDate, tournament.endDate)}
                    </Text>
                  </View>
                  <View style={styles.tournamentBadge}>
                    <Text style={styles.tournamentCategory}>{tournament.surface}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </View>

        {/* Travel Preferences Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="airplane" size={20} color="#3B82F6" />
            <Text style={styles.sectionTitle}>Préférences voyage</Text>
          </View>
          <View style={styles.card}>
            <InfoRow label="Classe de vol" value={player?.travelPreferences?.flightClass || 'Non renseigné'} />
            <InfoRow label="Siège préféré" value={player?.travelPreferences?.seatPreference || 'Non renseigné'} />
            <InfoRow
              label="Régime alimentaire"
              value={player?.foodPreferences?.restrictions?.join(', ') || 'Non renseigné'}
              isLast
            />
          </View>
        </View>

        {/* Tax Residency - Only for finance-enabled roles */}
        <PermissionGate permission="canViewFinances">
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="home" size={20} color="#10B981" />
              <Text style={styles.sectionTitle}>Résidence fiscale</Text>
            </View>
            <View style={styles.card}>
              <InfoRow
                label="Pays principal"
                value={player?.residenceFiscale || 'Non renseigné'}
                isLast
              />
            </View>
          </View>
        </PermissionGate>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

// InfoRow component
interface InfoRowProps {
  label: string;
  value: string;
  isLast?: boolean;
}

const InfoRow: React.FC<InfoRowProps> = ({ label, value, isLast }) => (
  <View style={[styles.infoRow, !isLast && styles.rowBorder]}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  playerHeader: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  playerName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  staffRole: {
    fontSize: 14,
    color: '#94A3B8',
  },
  section: {
    paddingHorizontal: 16,
    marginTop: 20,
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
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  infoLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
    textAlign: 'right',
    flex: 1,
    marginLeft: 16,
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
    fontSize: 28,
    fontWeight: '700',
    color: '#1e3c72',
    textAlign: 'center',
  },
  statValueCircuit: {
    fontSize: 20,
    minHeight: 56,
    textAlignVertical: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
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
  tournamentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  tournamentInfo: {
    flex: 1,
  },
  tournamentName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  tournamentMeta: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  tournamentDates: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  tournamentBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tournamentCategory: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4F46E5',
  },
});
