import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  Share,
  Platform,
  ActivityIndicator,
  TextInput,
  RefreshControl,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { fetchResidenceStats, ResidenceStats } from '../../src/services/api';
import { useCalendarSync } from '../../src/hooks/useCalendarSync';
import CalendarSyncBanner from '../../src/components/CalendarSyncBanner';

// ============ CONSTANTS ============

const USER_EMAIL_KEY = '@central_court_user_email';

const CIRCUIT_COLORS: Record<string, string> = {
  'ATP': '#1976d2',
  'WTA': '#9c27b0', 
  'ITF': '#2e7d32',
  'ITF_WHEELCHAIR': '#ff5722',
};

const LEVEL_LABELS: Record<string, string> = {
  'grand_slam': 'Grand Slam',
  '1000': 'Masters 1000',
  '500': 'ATP/WTA 500',
  '250': 'ATP/WTA 250',
  'challenger': 'Challenger',
  'itf': 'ITF',
};

const STAFF_ROLES = [
  { id: 'tennis_coach', label: 'Entraîneur Tennis', emoji: '🎾', color: '#388e3c' },
  { id: 'physical_coach', label: 'Préparateur Physique', emoji: '💪', color: '#2e7d32' },
  { id: 'physio', label: 'Kiné', emoji: '🏥', color: '#c2185b' },
  { id: 'agent', label: 'Agent', emoji: '💼', color: '#1976d2' },
  { id: 'family', label: 'Famille', emoji: '👨‍👩‍👧', color: '#ff9800' },
  { id: 'other', label: 'Autre', emoji: '👤', color: '#757575' },
];

// ============ TYPES ============

interface UserProfile {
  id: string;
  prenom: string;
  email: string;
  classement?: string;
  circuits?: string[];
  niveaux?: string[];
  residenceFiscale?: string;
  dateNaissance?: string;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'active' | 'pending';
  token?: string;
  expiresAt?: string;
  reminderCount?: number;
}

// ============ COMPONENT ============

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  
  // State
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [residenceStats, setResidenceStats] = useState<ResidenceStats | null>(null);
  
  // Modals
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const calendarSync = useCalendarSync();
  
  // Edit form
  const [editClassement, setEditClassement] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editResidenceFiscale, setEditResidenceFiscale] = useState('');

  // ============ DATA LOADING ============

  const loadProfile = useCallback(async () => {
    try {
      const savedEmail = await AsyncStorage.getItem(USER_EMAIL_KEY);
      if (!savedEmail) {
        setIsLoading(false);
        return;
      }

      // Load profile and residence stats in parallel
      const [profileResponse, residenceData] = await Promise.all([
        api.get(`/api/users/profile/email/${encodeURIComponent(savedEmail)}`),
        fetchResidenceStats(new Date().getFullYear()).catch(() => null),
      ]);

      if (profileResponse.data) {
        setUserProfile(profileResponse.data);
        
        // Load team from backend
        const [staffRes, invitesRes] = await Promise.all([
          api.get(`/api/invitations/staff/player/${profileResponse.data.id}`).catch(() => ({ data: { staff: [] } })),
          api.get(`/api/invitations/player/${profileResponse.data.id}`).catch(() => ({ data: { invitations: [] } })),
        ]);
        
        const activeStaff = (staffRes.data.staff || []).map((s: any) => ({
          id: s.id,
          name: `${s.firstName}${s.lastName ? ' ' + s.lastName : ''}`,
          email: s.email,
          role: s.role,
          status: 'active' as const,
        }));
        
        const pendingInvites = (invitesRes.data.invitations || [])
          .filter((inv: any) => inv.status === 'pending')
          .map((inv: any) => ({
            id: inv.id,
            name: inv.inviteeName || inv.inviteeEmail.split('@')[0],
            email: inv.inviteeEmail,
            role: inv.role,
            status: 'pending' as const,
            token: inv.token,
            expiresAt: inv.expiresAt,
            reminderCount: inv.reminderCount || 0,
          }));
        
        setTeam([...activeStaff, ...pendingInvites]);
      }

      if (residenceData) {
        setResidenceStats(residenceData);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      // BUG #15 FIX: Afficher une alerte si le chargement échoue
      Alert.alert(
        'Erreur de chargement',
        'Impossible de charger votre profil. Vérifiez votre connexion et réessayez.',
        [{ text: 'Réessayer', onPress: () => loadProfile() }]
      );
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadProfile();
  }, [loadProfile]);

  // ============ ACTIONS ============

  const openEditModal = () => {
    setEditClassement(userProfile?.classement || '');
    setEditEmail(userProfile?.email || '');
    setEditResidenceFiscale(userProfile?.residenceFiscale || '');
    setShowEditModal(true);
  };

  const saveProfile = async () => {
    if (!userProfile?.id) return;
    
    setIsSaving(true);
    try {
      await api.put(`/api/users/profile/${userProfile.id}`, {
        classement: editClassement,
        email: editEmail,
        residenceFiscale: editResidenceFiscale,
      });
      
      // Update local state
      setUserProfile(prev => prev ? {
        ...prev,
        classement: editClassement,
        email: editEmail,
        residenceFiscale: editResidenceFiscale,
      } : null);
      
      // Update stored email if changed
      if (editEmail !== userProfile.email) {
        await AsyncStorage.setItem(USER_EMAIL_KEY, editEmail);
      }
      
      setShowEditModal(false);
      Alert.alert('Succès', 'Profil mis à jour');
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('Erreur', 'Impossible de sauvegarder le profil');
    } finally {
      setIsSaving(false);
    }
  };

  const handleInvite = async () => {
    // BUG #21 FIX: Validation du format email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!selectedRole || !inviteEmail || !inviteName || !userProfile?.id) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }
    if (!emailRegex.test(inviteEmail)) {
      Alert.alert('Erreur', 'Veuillez entrer une adresse email valide');
      return;
    }
    
    setIsSaving(true);
    try {
      const response = await api.post('/api/invitations/create', {
        playerId: userProfile.id,
        inviteeEmail: inviteEmail,
        inviteeName: inviteName,
        role: selectedRole,
      });
      
      const invitation = response.data;
      const roleInfo = STAFF_ROLES.find(r => r.id === selectedRole);
      // Build join URL pointing to the frontend (not the backend API)
      let webUrl: string;
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        webUrl = `${window.location.origin}/join/${invitation.token}`;
      } else {
        const frontendWebUrl = process.env.EXPO_PUBLIC_WEB_URL || process.env.EXPO_PUBLIC_BACKEND_URL?.replace(':8001', ':8081') || '';
        webUrl = `${frontendWebUrl}/join/${invitation.token}`;
      }
      
      // Add to local team
      setTeam(prev => [...prev, {
        id: invitation.id,
        name: inviteName,
        email: inviteEmail,
        role: selectedRole,
        status: 'pending',
      }]);
      
      // Share invitation
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(webUrl);
        Alert.alert('Invitation créée ! ✉️', `Lien copié. ${inviteName} peut rejoindre votre équipe en tant que ${roleInfo?.label}.`);
      } else {
        await Share.share({
          message: `${userProfile.prenom} vous invite à rejoindre son équipe en tant que ${roleInfo?.label}!\n\n${webUrl}`,
          title: 'Invitation Le Court Central'
        });
      }
      
      setShowInviteModal(false);
      resetInviteForm();
    } catch (error: any) {
      Alert.alert('Erreur', error.response?.data?.detail || 'Impossible de créer l\'invitation');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveMember = (member: TeamMember) => {
    Alert.alert(
      'Retirer du staff',
      `Voulez-vous retirer ${member.name} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Retirer',
          style: 'destructive',
          onPress: async () => {
            try {
              if (member.status === 'active') {
                await api.delete(`/api/invitations/staff/${member.id}`);
              } else {
                await api.post(`/api/invitations/${member.id}/cancel`);
              }
            } catch (e) {
              console.log('Error removing member:', e);
            }
            setTeam(prev => prev.filter(m => m.id !== member.id));
          }
        }
      ]
    );
  };

  const handleResendInvitation = async (member: TeamMember) => {
    try {
      await api.post(`/api/invitations/${member.id}/resend`);
      // Refresh team to get updated expiresAt
      setTeam(prev => prev.map(m =>
        m.id === member.id
          ? { ...m, expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(), reminderCount: (m.reminderCount || 0) + 1 }
          : m
      ));
      Alert.alert('Invitation relancée ✅', `Un nouveau lien valable 7 jours a été généré pour ${member.email}.`);
    } catch {
      Alert.alert('Erreur', 'Impossible de relancer l\'invitation.');
    }
  };

  const handleShareInvitation = async (member: TeamMember) => {
    if (!member.token) return;
    const frontendWebUrl = process.env.EXPO_PUBLIC_FRONTEND_URL || '';
    let webUrl = '';
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      webUrl = `${window.location.origin}/join/${member.token}`;
    } else {
      webUrl = `${frontendWebUrl}/join/${member.token}`;
    }
    try {
      await Share.share({ message: `Rejoins mon équipe sur Le Court Central : ${webUrl}` });
    } catch { /* ignore */ }
  };

  const resetInviteForm = () => {
    setSelectedRole(null);
    setInviteEmail('');
    setInviteName('');
  };

  const getRoleInfo = (roleId: string) => STAFF_ROLES.find(r => r.id === roleId) || STAFF_ROLES[5];

  const handleLogout = () => {
    Alert.alert(
      'Déconnexion',
      'Voulez-vous vraiment vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Se déconnecter',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem(USER_EMAIL_KEY);
              await AsyncStorage.removeItem('onboarding_completed');
              await AsyncStorage.removeItem('onboarding_data');
              router.replace('/onboarding');
            } catch (e) {
              console.error('Error during logout:', e);
            }
          },
        },
      ]
    );
  };

  // ============ RENDER HELPERS ============

  const renderCircuitBadges = () => {
    const circuits = userProfile?.circuits || [];
    if (circuits.length === 0) return null;
    
    return (
      <View style={styles.badgesRow}>
        {circuits.map(circuit => (
          <View 
            key={circuit} 
            style={[styles.badge, { backgroundColor: CIRCUIT_COLORS[circuit] || '#666' }]}
          >
            <Text style={styles.badgeText}>{circuit}</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderLevelBadges = () => {
    const niveaux = userProfile?.niveaux || [];
    if (niveaux.length === 0) return null;
    
    return (
      <View style={styles.badgesRow}>
        {niveaux.map(niveau => (
          <View key={niveau} style={[styles.levelBadge]}>
            <Text style={styles.levelBadgeText}>{LEVEL_LABELS[niveau] || niveau}</Text>
          </View>
        ))}
      </View>
    );
  };

  // ============ LOADING STATE ============

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#1e3c72" />
      </View>
    );
  }

  // ============ MAIN RENDER ============

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#1e3c72', '#2a5298']}
        style={[styles.header, { paddingTop: insets.top + 16 }]}
      >
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              {userProfile?.prenom ? (
                <Text style={styles.avatarInitials}>{userProfile.prenom.charAt(0).toUpperCase()}</Text>
              ) : (
                <Ionicons name="person" size={36} color="#fff" />
              )}
            </View>
          </View>

          <View style={styles.profileInfo}>
            <Text style={styles.playerName}>{userProfile?.prenom || 'Configurer le profil'}</Text>

            {userProfile?.residenceFiscale && (
              <Text style={styles.residenceText}>📍 {userProfile.residenceFiscale}</Text>
            )}

            {renderCircuitBadges()}
          </View>

          <TouchableOpacity style={styles.editBtn} onPress={openEditModal} testID="btn-edit-profile">
            <Ionicons name="create-outline" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Stats bar */}
        <View style={styles.headerStatsBar}>
          {userProfile?.classement && (
            <View style={styles.headerStat}>
              <Text style={styles.headerStatValue}>#{userProfile.classement}</Text>
              <Text style={styles.headerStatLabel}>Classement</Text>
            </View>
          )}
          {team.length > 0 && (
            <View style={styles.headerStat}>
              <Text style={styles.headerStatValue}>{team.length}</Text>
              <Text style={styles.headerStatLabel}>Staff</Text>
            </View>
          )}
          {residenceStats && (
            <View style={styles.headerStat}>
              <Text style={styles.headerStatValue}>{residenceStats.totalDaysTracked}</Text>
              <Text style={styles.headerStatLabel}>Jours suivis</Text>
            </View>
          )}
          {residenceStats?.countries && residenceStats.countries.length > 0 && (
            <View style={styles.headerStat}>
              <Text style={styles.headerStatValue}>{residenceStats.countries.length}</Text>
              <Text style={styles.headerStatLabel}>Pays</Text>
            </View>
          )}
        </View>
      </LinearGradient>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Niveaux de tournois */}
        {userProfile?.niveaux && userProfile.niveaux.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Niveaux de tournois</Text>
            <View style={styles.levelsCard}>
              {renderLevelBadges()}
            </View>
          </View>
        )}

        {/* Résidence Fiscale */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Résidence Fiscale</Text>
            <TouchableOpacity 
              style={styles.viewAllBtn} 
              onPress={() => router.push('/(tabs)/residence')}
              testID="btn-residence"
            >
              <Text style={styles.viewAllBtnText}>Voir tout</Text>
              <Ionicons name="chevron-forward" size={16} color="#1e3c72" />
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity 
            style={styles.residenceCard}
            onPress={() => router.push('/(tabs)/residence')}
            activeOpacity={0.7}
          >
            {residenceStats ? (
              <>
                {/* Stats row */}
                <View style={styles.residenceStatsRow}>
                  <View style={styles.residenceStat}>
                    <Text style={styles.residenceStatNumber}>{residenceStats.totalDaysTracked}</Text>
                    <Text style={styles.residenceStatLabel}>jours suivis</Text>
                  </View>
                  <View style={styles.residenceStatDivider} />
                  <View style={styles.residenceStat}>
                    <Text style={styles.residenceStatNumber}>{residenceStats.countries?.length || 0}</Text>
                    <Text style={styles.residenceStatLabel}>pays</Text>
                  </View>
                  <View style={styles.residenceStatDivider} />
                  <View style={styles.residenceStat}>
                    <Text style={[styles.residenceStatNumber, { color: '#1e3c72' }]}>
                      {365 - residenceStats.totalDaysTracked}
                    </Text>
                    <Text style={styles.residenceStatLabel}>restants</Text>
                  </View>
                </View>

                {/* Primary country */}
                {residenceStats.primaryCountry && (
                  <View style={styles.primaryCountryRow}>
                    <View style={styles.primaryCountryInfo}>
                      <Text style={styles.primaryCountryLabel}>Pays principal</Text>
                      <Text style={styles.primaryCountryName}>
                        {residenceStats.primaryCountry.countryName}
                      </Text>
                    </View>
                    <View style={styles.primaryCountryProgress}>
                      <Text style={styles.primaryCountryDays}>
                        {residenceStats.primaryCountry.totalDays}
                        <Text style={styles.primaryCountryLimit}>/183j</Text>
                      </Text>
                      <View style={styles.miniProgressBar}>
                        <View 
                          style={[
                            styles.miniProgressFill,
                            { 
                              width: `${Math.min(residenceStats.primaryCountry.percentOfThreshold, 100)}%`,
                              backgroundColor: residenceStats.primaryCountry.percentOfThreshold >= 100 
                                ? '#E53935' 
                                : residenceStats.primaryCountry.percentOfThreshold >= 75 
                                  ? '#FF9800' 
                                  : '#4CAF50'
                            }
                          ]} 
                        />
                      </View>
                    </View>
                  </View>
                )}

                {/* Warnings */}
                {residenceStats.warnings && residenceStats.warnings.length > 0 && (
                  <View style={styles.residenceWarning}>
                    <Ionicons 
                      name={residenceStats.warnings[0].severity === 'critical' ? 'alert-circle' : 'warning'} 
                      size={16} 
                      color={residenceStats.warnings[0].severity === 'critical' ? '#E53935' : '#FF9800'} 
                    />
                    <Text style={styles.residenceWarningText} numberOfLines={1}>
                      {residenceStats.warnings[0].message}
                    </Text>
                  </View>
                )}

                {/* Action hint */}
                <View style={styles.residenceHint}>
                  <Ionicons name="arrow-forward-circle" size={16} color="#999" />
                  <Text style={styles.residenceHintText}>Appuyer pour gérer vos jours</Text>
                </View>
              </>
            ) : (
              <View style={styles.residenceEmpty}>
                <Ionicons name="globe-outline" size={32} color="#999" />
                <Text style={styles.residenceEmptyTitle}>Suivi de résidence</Text>
                <Text style={styles.residenceEmptySubtitle}>
                  Suivez vos jours par pays pour optimiser votre fiscalité
                </Text>
                <View style={styles.residenceStartBtn}>
                  <Ionicons name="add" size={18} color="#fff" />
                  <Text style={styles.residenceStartBtnText}>Commencer</Text>
                </View>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Équipe */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Mon équipe</Text>
            <TouchableOpacity style={styles.addBtn} onPress={() => setShowInviteModal(true)} testID="btn-invite">
              <Ionicons name="person-add" size={16} color="#fff" />
              <Text style={styles.addBtnText}>Inviter</Text>
            </TouchableOpacity>
          </View>

          {team.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="people-outline" size={36} color="#999" />
              <Text style={styles.emptyTitle}>Aucun membre</Text>
              <Text style={styles.emptySubtitle}>Invitez votre coach, kiné, agent...</Text>
            </View>
          ) : (
            <View style={styles.teamCard}>
              {team.map((member, index) => {
                const roleInfo = getRoleInfo(member.role);
                return (
                  <TouchableOpacity
                    key={member.id}
                    style={[styles.teamMember, index < team.length - 1 && styles.teamMemberBorder]}
                    onLongPress={() => handleRemoveMember(member)}
                  >
                    <View style={[styles.memberAvatar, { backgroundColor: roleInfo.color + '20' }]}>
                      <Text style={styles.memberEmoji}>{roleInfo.emoji}</Text>
                    </View>
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>{member.name}</Text>
                      <Text style={styles.memberEmail} numberOfLines={1}>{member.email}</Text>
                      <Text style={[styles.memberRole, { color: roleInfo.color }]}>
                        {roleInfo.label}
                        {member.status === 'pending' && ' · En attente'}
                      </Text>
                      {member.status === 'pending' && member.expiresAt && (
                        <Text style={styles.memberExpiry}>
                          Expire le {new Date(member.expiresAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                          {member.reminderCount ? ` · ${member.reminderCount} relance${member.reminderCount > 1 ? 's' : ''}` : ''}
                        </Text>
                      )}
                    </View>
                    {member.status === 'pending' ? (
                      <View style={styles.pendingActions}>
                        <TouchableOpacity
                          style={styles.resendBtn}
                          onPress={() => handleResendInvitation(member)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="send-outline" size={14} color="#1976d2" />
                          <Text style={styles.resendBtnText}>Relancer</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.shareBtn}
                          onPress={() => handleShareInvitation(member)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="share-outline" size={16} color="#6B7280" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.removeMemberBtn}
                          onPress={() => handleRemoveMember(member)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="close-circle-outline" size={18} color="#E53935" />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.removeMemberBtn}
                        onPress={() => handleRemoveMember(member)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons name="close-circle-outline" size={22} color="#E53935" />
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Sync Calendrier */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Calendrier</Text>
          <CalendarSyncBanner sync={calendarSync} />
        </View>

        {/* Réglages */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Réglages</Text>
          <View style={styles.actionsCard}>
            <TouchableOpacity style={styles.actionItem} onPress={openEditModal}>
              <View style={[styles.actionIcon, { backgroundColor: '#EEF2FF' }]}>
                <Ionicons name="person-outline" size={18} color="#1e3c72" />
              </View>
              <Text style={styles.actionText}>Modifier mon profil</Text>
              <Ionicons name="chevron-forward" size={16} color="#C4CDD6" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionItem} onPress={() => router.push('/onboarding')}>
              <View style={[styles.actionIcon, { backgroundColor: '#F0FDF4' }]}>
                <Ionicons name="refresh-outline" size={18} color="#16A34A" />
              </View>
              <Text style={styles.actionText}>Refaire l'onboarding</Text>
              <Ionicons name="chevron-forward" size={16} color="#C4CDD6" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionItem, styles.actionItemLast]} onPress={handleLogout} data-testid="btn-logout">
              <View style={[styles.actionIcon, { backgroundColor: '#FEF2F2' }]}>
                <Ionicons name="log-out-outline" size={18} color="#E53935" />
              </View>
              <Text style={[styles.actionText, { color: '#E53935' }]}>Se déconnecter</Text>
              <Ionicons name="chevron-forward" size={16} color="#C4CDD6" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal visible={showEditModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Modifier le profil</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalBody}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Classement</Text>
                <TextInput
                  style={styles.formInput}
                  value={editClassement}
                  onChangeText={setEditClassement}
                  placeholder="Ex: 45"
                  placeholderTextColor="#999"
                  keyboardType="number-pad"
                />
              </View>
              
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Email</Text>
                <TextInput
                  style={styles.formInput}
                  value={editEmail}
                  onChangeText={setEditEmail}
                  placeholder="votre@email.com"
                  placeholderTextColor="#999"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
              
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Résidence fiscale désirée</Text>
                <TextInput
                  style={styles.formInput}
                  value={editResidenceFiscale}
                  onChangeText={setEditResidenceFiscale}
                  placeholder="Ex: Monaco, Suisse..."
                  placeholderTextColor="#999"
                />
              </View>
              
              <TouchableOpacity style={styles.saveBtn} onPress={saveProfile} disabled={isSaving}>
                {isSaving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>Enregistrer</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Invite Modal */}
      <Modal visible={showInviteModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalOverlay}>
              <View style={styles.inviteModalContent}>
                {/* HEADER fixe */}
                <View style={styles.inviteModalHeader}>
                  <Text style={styles.modalTitle}>Inviter un membre</Text>
                  <TouchableOpacity onPress={() => { setShowInviteModal(false); resetInviteForm(); }}>
                    <Ionicons name="close" size={24} color="#333" />
                  </TouchableOpacity>
                </View>
                
                {/* CONTENU scrollable (rôles) */}
                <ScrollView 
                  style={styles.inviteScrollContent}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  <Text style={styles.formLabel}>Choisir un rôle</Text>
                  <View style={styles.roleGrid}>
                    {STAFF_ROLES.map(role => (
                      <TouchableOpacity
                        key={role.id}
                        style={[
                          styles.roleCard,
                          selectedRole === role.id && { backgroundColor: role.color + '15', borderColor: role.color }
                        ]}
                        onPress={() => setSelectedRole(role.id)}
                      >
                        <Text style={styles.roleEmoji}>{role.emoji}</Text>
                        <Text style={[styles.roleLabel, selectedRole === role.id && { color: role.color }]}>
                          {role.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
                
                {/* INPUT + BOUTON épinglés en bas — toujours visibles */}
                <View style={styles.bottomInputContainer}>
                  <TextInput
                    style={styles.inviteNameInput}
                    value={inviteName}
                    onChangeText={setInviteName}
                    placeholder="Prénom Nom"
                    placeholderTextColor="#6b7a8d"
                  />
                  <TextInput
                    style={styles.inviteEmailInput}
                    value={inviteEmail}
                    onChangeText={setInviteEmail}
                    placeholder="Adresse email du membre"
                    placeholderTextColor="#6b7a8d"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    returnKeyType="send"
                    onSubmitEditing={handleInvite}
                  />
                  <TouchableOpacity 
                    style={[
                      styles.inviteSendButton, 
                      (!selectedRole || !inviteEmail.trim()) && styles.inviteSendButtonDisabled
                    ]} 
                    onPress={handleInvite} 
                    disabled={isSaving || !selectedRole || !inviteEmail.trim()}
                  >
                    {isSaving ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="send" size={18} color="#fff" />
                        <Text style={styles.inviteSendButtonText}>Envoyer l'invitation</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ============ STYLES ============

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F8FA',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 0,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 20,
  },
  avatarContainer: {
    marginRight: 16,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  avatarInitials: {
    fontSize: 30,
    fontWeight: '700',
    color: '#fff',
  },
  profileInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  rankingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  rankingText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFD700',
  },
  headerStatsBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
    paddingTop: 14,
    paddingBottom: 18,
    gap: 0,
  },
  headerStat: {
    flex: 1,
    alignItems: 'center',
  },
  headerStatValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  headerStatLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  levelBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255,215,0,0.2)',
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  levelBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFD700',
  },
  residenceText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  editBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8A9BAE',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e3c72',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
  },
  addBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  levelsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#1a2744',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 36,
    alignItems: 'center',
    shadowColor: '#1a2744',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  teamCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#1a2744',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  teamMember: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  teamMemberBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  memberEmoji: {
    fontSize: 20,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  memberRole: {
    fontSize: 13,
    marginTop: 2,
  },
  pendingBadge: {
    padding: 6,
  },
  memberEmail: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 1,
  },
  memberExpiry: {
    fontSize: 11,
    color: '#ff9800',
    marginTop: 2,
  },
  pendingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  resendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  resendBtnText: {
    fontSize: 12,
    color: '#1976d2',
    fontWeight: '600',
  },
  shareBtn: {
    padding: 5,
  },
  removeMemberBtn: {
    padding: 6,
    marginLeft: 4,
  },
  hint: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
  },
  actionsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#1a2744',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 12,
  },
  actionItemLast: {
    borderBottomWidth: 0,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#1A2744',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  // Invite modal - keyboard-aware styles
  inviteModalContent: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: 100,
  },
  inviteModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  inviteScrollContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  bottomInputContainer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#fff',
    gap: 10,
  },
  inviteNameInput: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1a2744',
    backgroundColor: '#f8f9fb',
  },
  inviteEmailInput: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1a2744',
    backgroundColor: '#f8f9fb',
  },
  inviteSendButton: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#4A9B8E',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  inviteSendButtonDisabled: {
    backgroundColor: '#c5d0d8',
  },
  inviteSendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  modalBody: {
    padding: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  saveBtn: {
    backgroundColor: '#1e3c72',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    marginBottom: 32,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  roleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  roleCard: {
    width: '47%',
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  roleEmoji: {
    fontSize: 28,
    marginBottom: 6,
  },
  roleLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
  },
  // Residence Fiscale Section
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewAllBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e3c72',
  },
  residenceCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    overflow: 'hidden',
    shadowColor: '#1a2744',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  residenceStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  residenceStat: {
    alignItems: 'center',
  },
  residenceStatNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
  },
  residenceStatLabel: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  residenceStatDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#f0f0f0',
  },
  primaryCountryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  primaryCountryInfo: {
    flex: 1,
  },
  primaryCountryLabel: {
    fontSize: 11,
    color: '#999',
  },
  primaryCountryName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginTop: 2,
  },
  primaryCountryProgress: {
    alignItems: 'flex-end',
  },
  primaryCountryDays: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  primaryCountryLimit: {
    fontSize: 12,
    fontWeight: '400',
    color: '#999',
  },
  miniProgressBar: {
    width: 80,
    height: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 3,
    marginTop: 4,
    overflow: 'hidden',
  },
  miniProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  residenceWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF3E0',
    padding: 10,
    borderRadius: 8,
    marginTop: 12,
  },
  residenceWarningText: {
    flex: 1,
    fontSize: 12,
    color: '#E65100',
  },
  residenceHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  residenceHintText: {
    fontSize: 12,
    color: '#999',
  },
  residenceEmpty: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  residenceEmptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 10,
  },
  residenceEmptySubtitle: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 20,
  },
  residenceStartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1e3c72',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 14,
  },
  residenceStartBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
