import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LineChart, PieChart, ResponsiveContainer, Line, XAxis, YAxis, CartesianGrid, Tooltip, Pie, Cell, Legend } from 'recharts';
import { adminFetch } from './adminApi';

const CIRCUIT_COLORS: Record<string, string> = { ATP: '#2D5016', WTA: '#E8B923', ITF: '#3B82F6', 'ITF Wheelchair': '#8B5CF6' };

interface Metrics {
  users: { total: number; active: number; inactive: number; suspended: number; byCircuit: Record<string, number> };
  activation: { onboardingCompletionRate: number; usersWithDocuments: number; usersWithEvents: number; usersWithMembers: number };
  engagement: { averageLoginsPerUser: number; dailyLogins: { date: string; count: number }[]; totalStaff: number };
  geolocation: { enabledUsers: number; enabledRate: number };
  documents: { totalUploads: number; totalInvoices: number; totalStorageUsed: number };
}

interface Activity { type: string; userId: string; userName: string; description: string; timestamp: string; }

export default function AdminDashboard() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const screenWidth = Dimensions.get('window').width;

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [m, aData] = await Promise.all([
        adminFetch<Metrics>('/api/admin/metrics'),
        adminFetch<{ activities: Activity[] }>('/api/admin/activity/recent?limit=10'),
      ]);
      setMetrics(m);
      setActivities(aData.activities || []);
    } catch (e: any) {
      if (e.message === '401') { router.replace('/admin/login'); return; }
      setError('Erreur de chargement. Vérifiez votre connexion.');
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleLogout = async () => {
    await AsyncStorage.removeItem('admin_token');
    await AsyncStorage.removeItem('admin_user');
    router.replace('/admin/login');
  };

  const activityIcon = (type: string) => {
    const icons: Record<string, string> = { login: '🟢', upload: '📄', invite: '👥', event_create: '📅', event_update: '✏️', password_reset: '🔒', user_deleted: '🗑️' };
    return icons[type] || '●';
  };

  const timeAgo = (ts: string) => {
    const diff = (Date.now() - new Date(ts).getTime()) / 60000;
    if (diff < 60) return `Il y a ${Math.round(diff)} min`;
    if (diff < 1440) return `Il y a ${Math.round(diff / 60)}h`;
    return `Il y a ${Math.round(diff / 1440)}j`;
  };

  if (loading) return <View style={s.loadingContainer}><ActivityIndicator size="large" color="#2D5016" /></View>;
  if (error) return (
    <View style={s.loadingContainer}>
      <Text style={{ color: '#EF4444', marginBottom: 12 }}>{error}</Text>
      <TouchableOpacity onPress={loadData} style={{ backgroundColor: '#2D5016', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 }}>
        <Text style={{ color: '#fff', fontWeight: '600' }}>Réessayer</Text>
      </TouchableOpacity>
    </View>
  );
  if (!metrics) return <View style={s.loadingContainer}><Text>Erreur de chargement</Text></View>;

  const circuitData = Object.entries(metrics.users.byCircuit ?? {}).map(([name, value]) => ({ name, value }));

  return (
    <View style={s.container}>
      {/* TopBar */}
      <View style={s.topBar}>
        <View style={s.topBarLeft}>
          <Text style={s.topBarEmoji}>🎾</Text>
          <Text style={s.topBarTitle}>LE COURT CENTRAL</Text>
          <Text style={s.topBarTag}>Admin</Text>
        </View>
        <View style={s.topBarRight}>
          <TouchableOpacity style={s.navBtn} onPress={() => router.push('/admin/users')}>
            <Text style={s.navBtnText}>👥 Utilisateurs</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
            <Text style={s.logoutText}>Déconnexion</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={s.content} contentContainerStyle={s.contentInner}>
        <Text style={s.pageTitle}>📊 Vue d'ensemble</Text>

        {/* Metric Cards */}
        <View style={s.metricsGrid}>
          <View style={[s.metricCard, { borderLeftColor: '#2D5016' }]}>
            <Text style={s.metricLabel}>Utilisateurs</Text>
            <Text style={s.metricValue}>{metrics.users.total}</Text>
            <Text style={s.metricSub}>Total enregistrés</Text>
          </View>
          <View style={[s.metricCard, { borderLeftColor: '#10B981' }]}>
            <Text style={s.metricLabel}>Actifs</Text>
            <Text style={[s.metricValue, { color: '#10B981' }]}>{metrics.users.active}</Text>
            <Text style={s.metricSub}>Connectés récemment</Text>
          </View>
          <View style={[s.metricCard, { borderLeftColor: '#F59E0B' }]}>
            <Text style={s.metricLabel}>Taux d'activation</Text>
            <Text style={[s.metricValue, { color: '#F59E0B' }]}>{metrics.activation.onboardingCompletionRate}%</Text>
            <Text style={s.metricSub}>Onboarding complété</Text>
          </View>
          <View style={[s.metricCard, { borderLeftColor: '#3B82F6' }]}>
            <Text style={s.metricLabel}>Staff</Text>
            <Text style={[s.metricValue, { color: '#3B82F6' }]}>{metrics.engagement.totalStaff}</Text>
            <Text style={s.metricSub}>Membres rattachés</Text>
          </View>
        </View>

        {/* Charts Row */}
        <View style={s.chartsRow}>
          {/* Daily Logins Chart */}
          <View style={s.chartCard}>
            <Text style={s.chartTitle}>Connexions par jour (7 derniers jours)</Text>
            <View style={{ height: 250, width: '100%' }}>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={metrics.engagement.dailyLogins}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(8)} stroke="#9CA3AF" fontSize={12} />
                  <YAxis stroke="#9CA3AF" fontSize={12} />
                  <Tooltip labelFormatter={(d: string) => `Date: ${d}`} />
                  <Line type="monotone" dataKey="count" stroke="#2D5016" strokeWidth={2.5} dot={{ fill: '#2D5016', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </View>
          </View>

          {/* Circuit Distribution */}
          <View style={s.chartCard}>
            <Text style={s.chartTitle}>Distribution par circuit</Text>
            <View style={{ height: 250, width: '100%' }}>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={circuitData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }: any) => `${name}: ${(percent * 100).toFixed(0)}%`}>
                    {circuitData.map((entry, i) => <Cell key={i} fill={CIRCUIT_COLORS[entry.name] || '#888'} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </View>
          </View>
        </View>

        {/* Stats Grid */}
        <View style={s.statsRow}>
          <View style={s.statBox}>
            <Text style={s.statIcon}>📍</Text>
            <Text style={s.statValue}>{metrics.geolocation.enabledRate}%</Text>
            <Text style={s.statLabel}>Géolocalisation activée</Text>
          </View>
          <View style={s.statBox}>
            <Text style={s.statIcon}>📄</Text>
            <Text style={s.statValue}>{metrics.documents.totalUploads}</Text>
            <Text style={s.statLabel}>Documents uploadés</Text>
          </View>
          <View style={s.statBox}>
            <Text style={s.statIcon}>🧾</Text>
            <Text style={s.statValue}>{metrics.documents.totalInvoices}</Text>
            <Text style={s.statLabel}>Factures</Text>
          </View>
          <View style={s.statBox}>
            <Text style={s.statIcon}>💾</Text>
            <Text style={s.statValue}>{metrics.documents.totalStorageUsed} GB</Text>
            <Text style={s.statLabel}>Stockage utilisé</Text>
          </View>
        </View>

        {/* Recent Activity */}
        <View style={s.activityCard}>
          <Text style={s.chartTitle}>Activité récente</Text>
          {activities.map((a, i) => (
            <View key={i} style={s.activityRow}>
              <Text style={s.activityIconText}>{activityIcon(a.type)}</Text>
              <View style={s.activityContent}>
                <Text style={s.activityDesc}>{a.description}</Text>
                <Text style={s.activityTime}>{timeAgo(a.timestamp)}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' },
  topBar: { backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  topBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  topBarEmoji: { fontSize: 22 },
  topBarTitle: { fontSize: 17, fontWeight: '800', color: '#2D5016', letterSpacing: 0.5 },
  topBarTag: { fontSize: 11, fontWeight: '600', color: '#fff', backgroundColor: '#2D5016', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  navBtn: { backgroundColor: '#F3F4F6', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  navBtnText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  logoutBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  logoutText: { fontSize: 13, color: '#EF4444', fontWeight: '600' },
  content: { flex: 1 },
  contentInner: { padding: 24, maxWidth: 1200, alignSelf: 'center', width: '100%' },
  pageTitle: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 20 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 24 },
  metricCard: { flex: 1, minWidth: 200, backgroundColor: '#fff', borderRadius: 12, padding: 20, borderLeftWidth: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  metricLabel: { fontSize: 13, fontWeight: '500', color: '#6B7280', marginBottom: 6 },
  metricValue: { fontSize: 32, fontWeight: '800', color: '#111827' },
  metricSub: { fontSize: 12, color: '#9CA3AF', marginTop: 4 },
  chartsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 24 },
  chartCard: { flex: 1, minWidth: 320, backgroundColor: '#fff', borderRadius: 12, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  chartTitle: { fontSize: 15, fontWeight: '600', color: '#374151', marginBottom: 16 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 24 },
  statBox: { flex: 1, minWidth: 140, backgroundColor: '#fff', borderRadius: 12, padding: 16, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  statIcon: { fontSize: 28, marginBottom: 8 },
  statValue: { fontSize: 22, fontWeight: '700', color: '#111827' },
  statLabel: { fontSize: 12, color: '#6B7280', marginTop: 4, textAlign: 'center' },
  activityCard: { backgroundColor: '#fff', borderRadius: 12, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  activityRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', gap: 12 },
  activityIconText: { fontSize: 18, width: 30 },
  activityContent: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  activityDesc: { fontSize: 14, color: '#374151', flex: 1 },
  activityTime: { fontSize: 12, color: '#9CA3AF', marginLeft: 8 },
});
