import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { useAuth } from '../../src/context/AuthContext';
import { PermissionGate, RestrictedScreen } from '../../src/components/PermissionGate';
import { getStaffPermissions } from '../../src/types/staff';
import Constants from 'expo-constants';

function getApiBase(): string {
  if (process.env.EXPO_PUBLIC_BACKEND_URL) return process.env.EXPO_PUBLIC_BACKEND_URL;
  const debuggerHost =
    Constants.expoGoConfig?.debuggerHost ??
    (Constants as any).manifest2?.extra?.expoClient?.hostUri ??
    (Constants as any).manifest?.debuggerHost;
  if (debuggerHost) {
    const host = debuggerHost.split(':')[0];
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return `http://${host}:8001`;
  }
  return 'http://127.0.0.1:8001';
}

const API_URL = getApiBase();

async function getStoredToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return typeof localStorage !== 'undefined' ? localStorage.getItem('session_token') : null;
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
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
}

interface Document {
  id: string;
  name: string;
  fournisseur?: string;
  category: string;
  dateFacture?: string;
  montantTotal?: number;
  currency?: string;
  uploadedByName?: string;
  fileType?: string;
  createdAt: string;
}

const CATEGORY_MAP: Record<string, { icon: string; color: string; label: string }> = {
  travel:         { icon: 'airplane',      color: '#3B82F6', label: 'Transport' },
  accommodation:  { icon: 'bed',           color: '#8B5CF6', label: 'Hébergement' },
  restaurant:     { icon: 'restaurant',    color: '#F59E0B', label: 'Restauration' },
  medical:        { icon: 'medkit',        color: '#EF4444', label: 'Médical' },
  equipment:      { icon: 'tennisball',    color: '#10B981', label: 'Matériel' },
  services:       { icon: 'briefcase',     color: '#6366F1', label: 'Services' },
  other:          { icon: 'document-text', color: '#6B7280', label: 'Autre' },
  // Legacy French names
  Transport:      { icon: 'airplane',      color: '#3B82F6', label: 'Transport' },
  Hébergement:    { icon: 'bed',           color: '#8B5CF6', label: 'Hébergement' },
  Médical:        { icon: 'medkit',        color: '#EF4444', label: 'Médical' },
  Matériel:       { icon: 'tennisball',    color: '#10B981', label: 'Matériel' },
  Autre:          { icon: 'document-text', color: '#6B7280', label: 'Autre' },
};

export default function StaffDocuments() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // RIB modal
  const [showRibModal, setShowRibModal] = useState(false);
  const [ribValue, setRibValue] = useState('');
  const [ribBankName, setRibBankName] = useState('');
  const [savingRib, setSavingRib] = useState(false);

  const permissions = getStaffPermissions(user?.role);
  const canViewFinances = permissions?.canViewFinances ?? false;

  const loadDocuments = useCallback(async () => {
    try {
      const res = await authFetch('/api/documents');
      if (res.ok) {
        const data = await res.json();
        setDocuments(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadDocuments();
  }, [loadDocuments]);

  const handleUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;

      const file = result.assets[0];
      setIsUploading(true);

      const formData = new FormData();
      formData.append('file', {
        uri: file.uri,
        name: file.name,
        type: file.mimeType || 'application/octet-stream',
      } as any);

      const token = await getStoredToken();
      const res = await fetch(`${API_URL}/api/documents/upload`, {
        method: 'POST',
        body: formData,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          // Note: do NOT set Content-Type for multipart — browser/RN sets it with boundary
        },
      });

      if (res.ok) {
        Alert.alert('Succès', 'Document ajouté avec succès');
        loadDocuments();
      } else {
        const err = await res.text().catch(() => 'Erreur inconnue');
        Alert.alert('Erreur', err || 'Impossible d\'ajouter le document');
      }
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Erreur', 'Une erreur est survenue');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveRib = async () => {
    if (!ribValue.trim()) return;
    setSavingRib(true);
    try {
      const res = await authFetch('/api/staff/me/rib', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rib: ribValue.trim(), bankName: ribBankName.trim() }),
      });
      if (res.ok) {
        Alert.alert('RIB enregistré', 'Votre RIB est maintenant visible par le joueur');
        setShowRibModal(false);
      } else {
        Alert.alert('Erreur', 'Impossible d\'enregistrer le RIB');
      }
    } catch {
      Alert.alert('Erreur', 'Une erreur est survenue');
    } finally {
      setSavingRib(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatAmount = (amount?: number, currency?: string) => {
    if (!amount) return '';
    return `${amount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} ${currency || '€'}`;
  };

  if (!permissions?.canViewDocuments) {
    return <RestrictedScreen message="Votre rôle ne permet pas d'accéder aux documents" icon="folder-open" />;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Mes justificatifs</Text>
          <Text style={styles.headerSubtitle}>{documents.length} document{documents.length !== 1 ? 's' : ''} · visibles par le joueur</Text>
        </View>
        <TouchableOpacity style={styles.ribBtn} onPress={() => setShowRibModal(true)}>
          <Ionicons name="card-outline" size={18} color="#1e3c72" />
          <Text style={styles.ribBtnText}>Mon RIB</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1e3c72" />
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1e3c72" />}
          showsVerticalScrollIndicator={false}
        >
          {documents.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="folder-open-outline" size={64} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>Aucun document</Text>
              <Text style={styles.emptyText}>Ajoutez vos justificatifs de frais — ils seront visibles par le joueur</Text>
            </View>
          ) : (
            documents.map(doc => {
              const cat = CATEGORY_MAP[doc.category] || CATEGORY_MAP.other;
              const isStaffUploaded = !!doc.uploadedByName;
              return (
                <TouchableOpacity key={doc.id} style={styles.documentCard} activeOpacity={0.7}>
                  <View style={[styles.documentIcon, { backgroundColor: cat.color + '20' }]}>
                    <Ionicons name={cat.icon as any} size={24} color={cat.color} />
                  </View>
                  <View style={styles.documentInfo}>
                    <Text style={styles.documentTitle} numberOfLines={1}>
                      {doc.fournisseur || doc.name || 'Document'}
                    </Text>
                    <View style={styles.documentMeta}>
                      <Text style={styles.documentCategory}>{cat.label}</Text>
                      {doc.dateFacture && (
                        <Text style={styles.documentDate}>· {formatDate(doc.dateFacture)}</Text>
                      )}
                    </View>
                    {isStaffUploaded && (
                      <View style={styles.staffBadge}>
                        <Ionicons name="person-outline" size={10} color="#6B7280" />
                        <Text style={styles.staffBadgeText}>Ajouté par {doc.uploadedByName}</Text>
                      </View>
                    )}
                  </View>
                  {canViewFinances && doc.montantTotal != null && (
                    <Text style={styles.documentAmount}>
                      {formatAmount(doc.montantTotal, doc.currency)}
                    </Text>
                  )}
                  <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
                </TouchableOpacity>
              );
            })
          )}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* Upload FAB */}
      <PermissionGate permission="canUploadDocuments">
        <TouchableOpacity
          style={[styles.fab, { bottom: insets.bottom + 90 }]}
          onPress={handleUpload}
          disabled={isUploading}
          activeOpacity={0.8}
        >
          {isUploading ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="add" size={28} color="#FFFFFF" />}
        </TouchableOpacity>
      </PermissionGate>

      {/* RIB Modal */}
      <Modal visible={showRibModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowRibModal(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Mon RIB</Text>
            <TouchableOpacity onPress={() => setShowRibModal(false)}>
              <Ionicons name="close" size={24} color="#1F2937" />
            </TouchableOpacity>
          </View>
          <Text style={styles.modalSubtitle}>
            Enregistrez votre IBAN / RIB pour que le joueur puisse vous rembourser facilement depuis ses factures.
          </Text>
          <Text style={styles.fieldLabel}>IBAN / RIB *</Text>
          <TextInput
            style={styles.input}
            placeholder="FR76 3000 1007 9412 3456 7890 185"
            value={ribValue}
            onChangeText={setRibValue}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <Text style={styles.fieldLabel}>Nom de la banque</Text>
          <TextInput
            style={styles.input}
            placeholder="BNP Paribas"
            value={ribBankName}
            onChangeText={setRibBankName}
          />
          <TouchableOpacity
            style={[styles.saveBtn, (!ribValue.trim() || savingRib) && styles.saveBtnDisabled]}
            onPress={handleSaveRib}
            disabled={!ribValue.trim() || savingRib}
          >
            {savingRib ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Enregistrer</Text>}
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1F2937' },
  headerSubtitle: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  ribBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  ribBtnText: { fontSize: 13, fontWeight: '600', color: '#1e3c72' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16 },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#1F2937', marginTop: 16 },
  emptyText: { fontSize: 14, color: '#9CA3AF', marginTop: 4 },
  documentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  documentIcon: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  documentInfo: { flex: 1 },
  documentTitle: { fontSize: 15, fontWeight: '600', color: '#1F2937' },
  documentMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  documentCategory: { fontSize: 12, color: '#6B7280' },
  documentDate: { fontSize: 12, color: '#9CA3AF', marginLeft: 4 },
  staffBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  staffBadgeText: { fontSize: 11, color: '#9CA3AF' },
  documentAmount: { fontSize: 14, fontWeight: '600', color: '#1e3c72', marginRight: 8 },
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
  modalContainer: { flex: 1, padding: 24, backgroundColor: '#fff' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1F2937' },
  modalSubtitle: { fontSize: 14, color: '#6B7280', marginBottom: 24, lineHeight: 20 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1F2937',
    marginBottom: 16,
    backgroundColor: '#F9FAFB',
  },
  saveBtn: {
    backgroundColor: '#1e3c72',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
