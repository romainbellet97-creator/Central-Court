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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useAuth } from '../../src/context/AuthContext';
import { PermissionGate, RestrictedScreen } from '../../src/components/PermissionGate';
import { getStaffPermissions } from '../../src/types/staff';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || 
                process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface Document {
  id: string;
  title: string;
  type: string;
  category: string;
  dateFacture?: string;
  montant?: number;
  currency?: string;
  merchant?: string;
  createdAt: string;
}

const CATEGORY_ICONS: Record<string, string> = {
  'Transport': 'airplane',
  'Hébergement': 'bed',
  'Équipement': 'tennisball',
  'Matériel': 'tennisball',
  'Médical': 'medkit',
  'Administratif': 'document',
  'Autre': 'document-text',
};

const CATEGORY_COLORS: Record<string, string> = {
  'Transport': '#3B82F6',
  'Hébergement': '#8B5CF6',
  'Équipement': '#10B981',
  'Matériel': '#10B981',
  'Médical': '#EF4444',
  'Administratif': '#F59E0B',
  'Autre': '#6B7280',
};

export default function StaffDocuments() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const linkedPlayerId = user?.player_id;
  const permissions = getStaffPermissions(user?.role);
  const canViewFinances = permissions?.canViewFinances ?? false;
  const canUpload = permissions?.canUploadDocuments ?? false;

  const loadDocuments = useCallback(async () => {
    if (!linkedPlayerId) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/api/documents?userId=${linkedPlayerId}`
      );

      if (response.ok) {
        const data = await response.json();
        setDocuments(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [linkedPlayerId]);

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

      // Create form data
      const formData = new FormData();
      formData.append('file', {
        uri: file.uri,
        name: file.name,
        type: file.mimeType || 'application/octet-stream',
      } as any);
      formData.append('userId', linkedPlayerId || '');
      formData.append('uploadedBy', user?.name || 'Staff');

      const response = await fetch(`${API_URL}/api/documents/upload`, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.ok) {
        Alert.alert('Succès', 'Document ajouté avec succès');
        loadDocuments();
      } else {
        Alert.alert('Erreur', 'Impossible d\'ajouter le document');
      }
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Erreur', 'Une erreur est survenue');
    } finally {
      setIsUploading(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { 
      day: 'numeric', 
      month: 'short',
      year: 'numeric'
    });
  };

  const formatAmount = (amount?: number, currency?: string) => {
    if (!amount) return '';
    return `${amount.toLocaleString()} ${currency || '€'}`;
  };

  // Check permission to view documents
  if (!permissions?.canViewDocuments) {
    return (
      <RestrictedScreen
        message="Votre rôle ne permet pas d'accéder aux documents"
        icon="folder-open"
      />
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
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Documents</Text>
        <Text style={styles.headerSubtitle}>{documents.length} documents</Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1e3c72" />
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1e3c72" />
          }
          showsVerticalScrollIndicator={false}
        >
          {documents.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="folder-open-outline" size={64} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>Aucun document</Text>
              <Text style={styles.emptyText}>
                Les documents du joueur apparaîtront ici
              </Text>
            </View>
          ) : (
            documents.map(doc => (
              <TouchableOpacity 
                key={doc.id} 
                style={styles.documentCard}
                activeOpacity={0.7}
              >
                <View 
                  style={[
                    styles.documentIcon, 
                    { backgroundColor: (CATEGORY_COLORS[doc.category] || '#6B7280') + '20' }
                  ]}
                >
                  <Ionicons 
                    name={(CATEGORY_ICONS[doc.category] || 'document-text') as any}
                    size={24} 
                    color={CATEGORY_COLORS[doc.category] || '#6B7280'} 
                  />
                </View>
                <View style={styles.documentInfo}>
                  <Text style={styles.documentTitle} numberOfLines={1}>
                    {doc.title || doc.merchant || 'Document'}
                  </Text>
                  <View style={styles.documentMeta}>
                    <Text style={styles.documentCategory}>{doc.category}</Text>
                    {doc.dateFacture && (
                      <Text style={styles.documentDate}>
                        · {formatDate(doc.dateFacture)}
                      </Text>
                    )}
                  </View>
                </View>
                {/* Show amount only if user has finance permission */}
                {canViewFinances && doc.montant && (
                  <Text style={styles.documentAmount}>
                    {formatAmount(doc.montant, doc.currency)}
                  </Text>
                )}
                <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
              </TouchableOpacity>
            ))
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
          accessibilityLabel="Ajouter un document"
          accessibilityRole="button"
        >
          {isUploading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Ionicons name="add" size={28} color="#FFFFFF" />
          )}
        </TouchableOpacity>
      </PermissionGate>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
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
  headerSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
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
  scrollContent: {
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
  },
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
  documentIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  documentInfo: {
    flex: 1,
  },
  documentTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  documentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  documentCategory: {
    fontSize: 12,
    color: '#6B7280',
  },
  documentDate: {
    fontSize: 12,
    color: '#9CA3AF',
    marginLeft: 4,
  },
  documentAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e3c72',
    marginRight: 8,
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
});
