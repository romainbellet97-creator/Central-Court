import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { adminFetch } from '../adminApi';

export default function UserDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [user, setUser] = useState<any>(null);
  const [staff, setStaff] = useState<any[]>([]);
  const [activityChart, setActivityChart] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedStaff, setExpandedStaff] = useState<string | null>(null);
  const [actionModal, setActionModal] = useState<{ type: string; target: any }>({ type: '', target: null });
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadUser = async () => {
    try {
      const data = await adminFetch<{ user: any; staff: any[]; activityChart: any[] }>(`/api/admin/users/${id}`);
      setUser(data.user); setStaff(data.staff || []); setActivityChart(data.activityChart || []);
    } catch (e: any) {
      if (e.message === '401') { router.replace('/admin/login'); return; }
      setLoadError('Impossible de charger cet utilisateur.');
    }
    setLoading(false);
  };

  useEffect(() => { if (id) loadUser(); }, [id]);

  const handleAction = async () => {
    if (!actionModal.target) return;
    setActionLoading(true);
    setActionError(null);
    try {
      if (actionModal.type === 'reset_password_user') {
        await adminFetch(`/api/admin/users/${actionModal.target.id}/reset-password`, { method: 'POST' });
      } else if (actionModal.type === 'suspend') {
        await adminFetch(`/api/admin/users/${actionModal.target.id}/status`, { method: 'PUT', body: JSON.stringify({ status: 'suspended' }) });
      } else if (actionModal.type === 'delete') {
        await adminFetch(`/api/admin/users/${actionModal.target.id}`, { method: 'DELETE' });
        router.replace('/admin/users');
        return;
      } else if (actionModal.type === 'reset_password_staff') {
        await adminFetch(`/api/admin/staff/${actionModal.target.id}/reset-password`, { method: 'POST' });
      }
      // Reload
      const data = await adminFetch<{ user: any; staff: any[] }>(`/api/admin/users/${id}`);
      setUser(data.user); setStaff(data.staff || []);
    } catch (e: any) {
      if (e.message === '401') { router.replace('/admin/login'); return; }
      setActionError('Erreur lors de l\'action. Réessayez.');
      setActionLoading(false);
      return;
    }
    setActionLoading(false);
    setActionModal({ type: '', target: null });
  };

  const roleLabels: Record<string, string> = { coach: 'Coach', manager: 'Manager', physio: 'Kinésithérapeute', nutritionist: 'Nutritionniste', other: 'Autre' };
  const timeAgo = (ts: string) => {
    const diff = (Date.now() - new Date(ts).getTime()) / 60000;
    if (diff < 60) return `Il y a ${Math.round(diff)} min`;
    if (diff < 1440) return `Il y a ${Math.round(diff / 60)}h`;
    return `Il y a ${Math.round(diff / 1440)}j`;
  };
  const formatDate = (ts: string) => new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

  const getStatusColor = (lastLogin: string) => {
    const days = (Date.now() - new Date(lastLogin).getTime()) / 86400000;
    if (days < 7) return '#10B981';
    if (days < 30) return '#F59E0B';
    return '#EF4444';
  };

  if (loading) return <View style={s.loadingContainer}><ActivityIndicator size="large" color="#2D5016" /></View>;
  if (loadError) return (
    <View style={s.loadingContainer}>
      <Text style={{ color: '#EF4444', marginBottom: 12 }}>{loadError}</Text>
      <TouchableOpacity onPress={() => { setLoading(true); setLoadError(null); loadUser(); }} style={{ backgroundColor: '#2D5016', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 }}>
        <Text style={{ color: '#fff', fontWeight: '600' }}>Réessayer</Text>
      </TouchableOpacity>
    </View>
  );
  if (!user) return <View style={s.loadingContainer}><Text>Utilisateur introuvable</Text></View>;

  return (
    <View style={s.container}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.push('/admin/users')} style={s.backBtn}>
          <Text style={s.backText}>← Utilisateurs</Text>
        </TouchableOpacity>
        <Text style={s.topBarTitle}>{user.prenom} {user.nom}</Text>
      </View>

      <ScrollView style={s.content} contentContainerStyle={s.contentInner}>
        {/* User Header */}
        <View style={s.headerRow}>
          <View style={s.headerCard}>
            <View style={s.headerTop}>
              <View style={[s.bigDot, { backgroundColor: getStatusColor(user.activity.lastLoginAt) }]} />
              <Text style={s.headerName}>{user.prenom} {user.nom}</Text>
            </View>
            <Text style={s.headerEmail}>{user.email}</Text>
            {user.telephone && <Text style={s.headerPhone}>{user.telephone}</Text>}
            <View style={s.headerMeta}>
              <Text style={s.headerTag}>🎾 {user.circuits?.join(', ')}</Text>
              {user.classement && <Text style={s.headerTag}>🏆 #{user.classement}</Text>}
              <Text style={s.headerTag}>📅 Inscrit {formatDate(user.createdAt)}</Text>
              <View style={s.headerStatusRow}>
                <View style={[s.statusDotSmall, { backgroundColor: getStatusColor(user.activity.lastLoginAt) }]} />
                <Text style={s.headerTag}>Dernier login : {timeAgo(user.activity.lastLoginAt)}</Text>
              </View>
            </View>
          </View>

          <View style={s.actionsCard}>
            <Text style={s.actionsTitle}>Actions rapides</Text>
            <TouchableOpacity style={s.quickAction} onPress={() => setActionModal({ type: 'reset_password_user', target: user })}>
              <Text style={s.quickActionText}>🔒 Reset mot de passe</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.quickAction, { backgroundColor: '#FFF3E0' }]} onPress={() => setActionModal({ type: 'suspend', target: user })}>
              <Text style={[s.quickActionText, { color: '#E65100' }]}>⏸️ Suspendre compte</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.quickAction, { backgroundColor: '#FEE2E2' }]} onPress={() => setActionModal({ type: 'delete', target: user })}>
              <Text style={[s.quickActionText, { color: '#B91C1C' }]}>🗑️ Supprimer compte</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Metric Cards */}
        <View style={s.metricsGrid}>
          <View style={s.mCard}><Text style={s.mValue}>{user.activity.loginCount}</Text><Text style={s.mLabel}>Connexions/mois</Text></View>
          <View style={s.mCard}><Text style={s.mValue}>{user.events?.total || 0}</Text><Text style={s.mLabel}>Événements ({user.events?.accepted || 0} acceptés)</Text></View>
          <View style={s.mCard}><Text style={s.mValue}>{user.documents?.vaultItemsCount || 0}</Text><Text style={s.mLabel}>Documents ({user.documents?.invoicesCount || 0} factures)</Text></View>
          <View style={s.mCard}><Text style={s.mValue}>{staff.length}</Text><Text style={s.mLabel}>Membres staff</Text></View>
        </View>

        {/* Activity Chart */}
        <View style={s.chartCard}>
          <Text style={s.sectionTitle}>📊 Connexions par jour (30 derniers jours)</Text>
          <View style={{ height: 220, width: '100%' }}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={activityChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(8)} stroke="#9CA3AF" fontSize={11} />
                <YAxis stroke="#9CA3AF" fontSize={11} />
                <Tooltip labelFormatter={(d: string) => d} />
                <Bar dataKey="count" fill="#2D5016" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </View>
          {user.geolocation?.enabled && user.geolocation?.lastKnownLocation && (
            <View style={s.geoRow}>
              <Text style={s.geoLabel}>📍 Géolocalisation active</Text>
              <Text style={s.geoValue}>{user.geolocation.lastKnownLocation.city}, {user.geolocation.lastKnownLocation.country} • {timeAgo(user.geolocation.lastKnownLocation.timestamp)}</Text>
            </View>
          )}
        </View>

        {/* Events Summary */}
        {user.events && (
          <View style={s.eventsCard}>
            <Text style={s.sectionTitle}>📅 Événements</Text>
            <View style={s.eventsRow}>
              <Text style={s.eventStat}>Total: <Text style={s.bold}>{user.events.total}</Text></Text>
              <Text style={s.eventStat}>Acceptés: <Text style={[s.bold, { color: '#10B981' }]}>{user.events.accepted}</Text></Text>
              <Text style={s.eventStat}>Refusés: <Text style={[s.bold, { color: '#EF4444' }]}>{user.events.declined}</Text></Text>
              <Text style={s.eventStat}>Reportés: <Text style={[s.bold, { color: '#F59E0B' }]}>{user.events.rescheduled}</Text></Text>
              <Text style={s.eventStat}>Avec notes: <Text style={s.bold}>{user.events.withNotes} ({user.events.total > 0 ? Math.round((user.events.withNotes / user.events.total) * 100) : 0}%)</Text></Text>
            </View>
          </View>
        )}

        {/* Staff Members */}
        <View style={s.staffSection}>
          <Text style={s.sectionTitle}>👥 Membres du Staff ({staff.length})</Text>
          {staff.length === 0 ? (
            <Text style={s.emptyText}>Aucun membre du staff</Text>
          ) : staff.map(sm => (
            <View key={sm.id} style={s.staffCard}>
              <TouchableOpacity style={s.staffHeader} onPress={() => setExpandedStaff(expandedStaff === sm.id ? null : sm.id)}>
                <View style={s.staffInfo}>
                  <View style={[s.statusDotSmall, { backgroundColor: getStatusColor(sm.activity?.lastLoginAt || '') }]} />
                  <View>
                    <Text style={s.staffName}>{sm.prenom} {sm.nom} — {roleLabels[sm.role] || sm.role}</Text>
                    <Text style={s.staffEmail}>{sm.email}</Text>
                  </View>
                </View>
                <View style={s.staffRight}>
                  <TouchableOpacity style={s.miniActionBtn} onPress={() => setActionModal({ type: 'reset_password_staff', target: sm })}>
                    <Text style={{ fontSize: 12 }}>🔒</Text>
                  </TouchableOpacity>
                  <Text style={s.toggleIcon}>{expandedStaff === sm.id ? '▲' : '▼'}</Text>
                </View>
              </TouchableOpacity>

              {expandedStaff !== sm.id && (
                <View style={s.staffSummary}>
                  <Text style={s.staffSumText}>📊 {sm.activity?.loginCount || 0} conn./mois</Text>
                  <Text style={s.staffSumText}>📅 {sm.events?.created || 0} événements créés</Text>
                </View>
              )}

              {expandedStaff === sm.id && (
                <View style={s.staffDetails}>
                  <View style={s.detailSection}>
                    <Text style={s.detailTitle}>ACTIVITÉ</Text>
                    <Text style={s.detailItem}>• Dernier login : {sm.activity?.lastLoginAt ? timeAgo(sm.activity.lastLoginAt) : 'N/A'}</Text>
                    <Text style={s.detailItem}>• Connexions/mois : {sm.activity?.loginCount || 0}</Text>
                  </View>
                  <View style={s.detailSection}>
                    <Text style={s.detailTitle}>ÉVÉNEMENTS</Text>
                    <Text style={s.detailItem}>• Créés : {sm.events?.created || 0}</Text>
                    <Text style={s.detailItem}>• Modifiés : {sm.events?.modified || 0}</Text>
                    <Text style={s.detailItem}>• Supprimés : {sm.events?.deleted || 0}</Text>
                  </View>
                  <View style={s.detailSection}>
                    <Text style={s.detailTitle}>ACCÈS DOCUMENTS</Text>
                    <Text style={s.detailItem}>• Lecture : {sm.documentsAccess?.canView ? '✅' : '❌'}</Text>
                    <Text style={s.detailItem}>• Édition : {sm.documentsAccess?.canEdit ? '✅' : '❌'}</Text>
                    <Text style={s.detailItem}>• Upload : {sm.documentsAccess?.canUpload ? '✅' : '❌'}</Text>
                  </View>
                  <View style={s.detailSection}>
                    <Text style={s.detailTitle}>MEMBRE DEPUIS</Text>
                    <Text style={s.detailItem}>• Invité : {sm.invitedAt ? formatDate(sm.invitedAt) : 'N/A'}</Text>
                    {sm.acceptedAt && <Text style={s.detailItem}>• Accepté : {formatDate(sm.acceptedAt)}</Text>}
                  </View>
                </View>
              )}
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Action Modal */}
      <Modal visible={!!actionModal.type} animationType="fade" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>
              {actionModal.type === 'delete' ? '⚠️ Supprimer l\'utilisateur' :
               actionModal.type.includes('reset') ? '🔐 Réinitialiser le mot de passe' : '⏸️ Suspendre le compte'}
            </Text>
            <View style={s.modalUserBox}>
              <Text style={s.modalUserName}>{actionModal.target?.prenom} {actionModal.target?.nom}</Text>
              <Text style={s.modalUserEmail}>{actionModal.target?.email}</Text>
            </View>
            {actionModal.type === 'delete' && <Text style={s.modalWarning}>Action irréversible. Toutes les données et {staff.length} membre(s) staff seront supprimés.</Text>}
            {actionError && <Text style={{ color: '#EF4444', fontSize: 13, marginBottom: 8, textAlign: 'center' }}>{actionError}</Text>}
            <View style={s.modalBtns}>
              <TouchableOpacity style={s.modalCancelBtn} onPress={() => setActionModal({ type: '', target: null })}>
                <Text style={s.modalCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalConfirmBtn, actionModal.type === 'delete' && { backgroundColor: '#EF4444' }]} onPress={handleAction} disabled={actionLoading}>
                {actionLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.modalConfirmText}>Confirmer</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' },
  topBar: { backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', gap: 16 },
  backBtn: { paddingVertical: 4, paddingRight: 8 },
  backText: { fontSize: 14, color: '#2D5016', fontWeight: '600' },
  topBarTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  content: { flex: 1 },
  contentInner: { padding: 24, maxWidth: 1200, alignSelf: 'center', width: '100%' },
  headerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 20 },
  headerCard: { flex: 2, minWidth: 300, backgroundColor: '#fff', borderRadius: 12, padding: 20, borderWidth: 1, borderColor: '#E5E7EB' },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  bigDot: { width: 14, height: 14, borderRadius: 7 },
  headerName: { fontSize: 22, fontWeight: '700', color: '#111827' },
  headerEmail: { fontSize: 14, color: '#6B7280' },
  headerPhone: { fontSize: 14, color: '#6B7280', marginTop: 2 },
  headerMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 14 },
  headerTag: { fontSize: 13, color: '#374151' },
  headerStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDotSmall: { width: 8, height: 8, borderRadius: 4 },
  actionsCard: { flex: 1, minWidth: 240, backgroundColor: '#fff', borderRadius: 12, padding: 20, borderWidth: 1, borderColor: '#E5E7EB', gap: 10 },
  actionsTitle: { fontSize: 15, fontWeight: '600', color: '#374151', marginBottom: 6 },
  quickAction: { backgroundColor: '#F3F4F6', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8 },
  quickActionText: { fontSize: 14, fontWeight: '500', color: '#374151' },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  mCard: { flex: 1, minWidth: 150, backgroundColor: '#fff', borderRadius: 10, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  mValue: { fontSize: 28, fontWeight: '800', color: '#111827' },
  mLabel: { fontSize: 12, color: '#6B7280', marginTop: 4, textAlign: 'center' },
  chartCard: { backgroundColor: '#fff', borderRadius: 12, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#E5E7EB' },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 14 },
  geoRow: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  geoLabel: { fontSize: 13, fontWeight: '600', color: '#10B981' },
  geoValue: { fontSize: 13, color: '#6B7280' },
  eventsCard: { backgroundColor: '#fff', borderRadius: 12, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#E5E7EB' },
  eventsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
  eventStat: { fontSize: 14, color: '#6B7280' },
  bold: { fontWeight: '700', color: '#111827' },
  staffSection: { marginBottom: 24 },
  emptyText: { fontSize: 14, color: '#9CA3AF', fontStyle: 'italic' },
  staffCard: { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', padding: 14, marginBottom: 10 },
  staffHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  staffInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  staffName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  staffEmail: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  staffRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  miniActionBtn: { width: 28, height: 28, borderRadius: 6, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  toggleIcon: { fontSize: 12, color: '#9CA3AF' },
  staffSummary: { flexDirection: 'row', gap: 16, marginTop: 8 },
  staffSumText: { fontSize: 12, color: '#6B7280' },
  staffDetails: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#F3F4F6', gap: 14 },
  detailSection: { gap: 4 },
  detailTitle: { fontSize: 11, fontWeight: '600', color: '#9CA3AF', letterSpacing: 0.5, marginBottom: 4 },
  detailItem: { fontSize: 13, color: '#374151' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 28, maxWidth: 420, width: '90%', alignItems: 'center' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827', textAlign: 'center', marginBottom: 12 },
  modalUserBox: { backgroundColor: '#F9FAFB', borderRadius: 10, padding: 14, width: '100%', marginBottom: 12 },
  modalUserName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  modalUserEmail: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  modalWarning: { fontSize: 13, color: '#EF4444', marginBottom: 16, textAlign: 'center' },
  modalBtns: { flexDirection: 'row', gap: 12, width: '100%' },
  modalCancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#D1D5DB', alignItems: 'center' },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: '#374151' },
  modalConfirmBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#2D5016', alignItems: 'center' },
  modalConfirmText: { fontSize: 15, fontWeight: '600', color: '#fff' },
});
