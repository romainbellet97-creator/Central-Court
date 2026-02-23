import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Platform,
  KeyboardAvoidingView,
  Linking,
  AppState,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import api from '../../src/services/api';

// ============ TYPES ============

interface Document {
  id: string;
  name: string;
  category: string;
  type: 'pdf' | 'image';
  date: string;
  amount?: number;
  currency?: string;
  fournisseur?: string;
  description?: string;
  createdAt?: string;
}

// ============ CONSTANTS ============

const MONTHS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

const CATEGORY_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  'Transport': { label: 'Transport', icon: 'airplane', color: '#00796b' },
  'travel': { label: 'Transport', icon: 'airplane', color: '#00796b' },
  'Hébergement': { label: 'Hébergement', icon: 'bed', color: '#1976d2' },
  'Restauration': { label: 'Restauration', icon: 'restaurant', color: '#e64a19' },
  'invoices': { label: 'Factures', icon: 'receipt', color: '#f57c00' },
  'Médical': { label: 'Médical', icon: 'medkit', color: '#c2185b' },
  'medical': { label: 'Médical', icon: 'medkit', color: '#c2185b' },
  'Matériel': { label: 'Équipement', icon: 'tennisball', color: '#2e7d32' },
  'Équipement': { label: 'Équipement', icon: 'tennisball', color: '#2e7d32' },
  'Services': { label: 'Services', icon: 'construct', color: '#0097a7' },
  'Autre': { label: 'Autre', icon: 'document', color: '#757575' },
  'other': { label: 'Autre', icon: 'document', color: '#757575' },
};

// BUG #22 FIX: Aligner les catégories OCR avec CATEGORY_CONFIG
const OCR_CATEGORIES = ['Transport', 'Hébergement', 'Restauration', 'Médical', 'Équipement', 'Services', 'Autre'];

const getCatConfig = (cat: string) => CATEGORY_CONFIG[cat] || CATEGORY_CONFIG['other'] || { label: cat || 'Autre', icon: 'document', color: '#757575' };

// BUG #5 FIX: Helper pour obtenir le symbole de devise
const getCurrencySymbol = (currency?: string): string => {
  switch (currency?.toUpperCase()) {
    case 'USD': return '$';
    case 'GBP': return '£';
    case 'CHF': return 'CHF';
    case 'AED': return 'AED';
    case 'EUR':
    default: return '€';
  }
};

// ============ COMPONENT ============

export default function DocumentsScreen() {
  const insets = useSafeAreaInsets();
  
  // Ref pour éviter les appels multiples
  const isProcessingRef = useRef(false);

  // Core state
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Month navigation
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  // Modal states
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [showDocDetail, setShowDocDetail] = useState<Document | null>(null);
  const [showAllCategories, setShowAllCategories] = useState(false);
  
  // P2-7 FIX: État pour la modification de document existant
  const [showEditDocModal, setShowEditDocModal] = useState(false);
  const [editingDoc, setEditingDoc] = useState<Document | null>(null);

  // Upload/OCR state - CRITIQUE: Utiliser des états séparés
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessingOCR, setIsProcessingOCR] = useState(false);
  const [pendingDocUri, setPendingDocUri] = useState<string | null>(null);
  const [pendingDocBase64, setPendingDocBase64] = useState<string | null>(null);
  const [pendingDocType, setPendingDocType] = useState<'pdf' | 'image'>('image');
  const [pendingDocName, setPendingDocName] = useState('');

  // OCR edit state
  const [editedFournisseur, setEditedFournisseur] = useState('');
  const [editedDate, setEditedDate] = useState('');
  const [editedMontant, setEditedMontant] = useState('');
  const [editedMontantHT, setEditedMontantHT] = useState('');
  const [editedMontantTVA, setEditedMontantTVA] = useState('');
  const [editedCategorie, setEditedCategorie] = useState('Autre');
  const [editedCurrency, setEditedCurrency] = useState('EUR');
  const [isSaving, setIsSaving] = useState(false);

  // Available currencies
  const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'AUD', 'CAD', 'AED'];

  // ============ CLEANUP / RESET ============

  // CRITIQUE: Fonction de reset complète pour tout l'état upload
  const resetUploadState = useCallback(() => {
    console.log('🔄 === RESET UPLOAD STATE ===');
    isProcessingRef.current = false;
    setIsUploading(false);
    setIsProcessingOCR(false);
    setPendingDocUri(null);
    setPendingDocBase64(null);
    setPendingDocName('');
    setPendingDocType('image');
  }, []);

  // CRITIQUE: Fonction de reset pour l'OCR
  const resetOCRState = useCallback(() => {
    console.log('🔄 === RESET OCR STATE ===');
    setEditedFournisseur('');
    setEditedDate('');
    setEditedMontant('');
    setEditedMontantHT('');
    setEditedMontantTVA('');
    setEditedCategorie('Autre');
    setEditedCurrency('EUR');
  }, []);

  // Cleanup complet
  const fullReset = useCallback(() => {
    resetUploadState();
    resetOCRState();
    setShowUploadModal(false);
    setShowVerificationModal(false);
  }, [resetUploadState, resetOCRState]);

  // CRITIQUE: Cleanup au démontage du composant
  useEffect(() => {
    return () => {
      console.log('🧹 Component unmounting, cleaning up...');
      isProcessingRef.current = false;
    };
  }, []);

  // ============================================================
  // BUG #2 FIX: Relire les permissions à chaque focus de l'écran
  // ============================================================
  useFocusEffect(
    useCallback(() => {
      const checkPermissions = async () => {
        console.log('🔄 Checking camera permissions on focus...');
        const { status } = await ImagePicker.getCameraPermissionsAsync();
        console.log('📷 Camera permission status:', status);
        if (status !== 'granted') {
          // Permissions perdues, les re-demander au prochain usage
          console.log('⚠️ Camera permission not granted');
        }
      };
      checkPermissions();
      
      // Cleanup: libérer les verrous au blur
      return () => {
        isProcessingRef.current = false;
      };
    }, [])
  );

  // ============================================================
  // BUG #2 FIX: Gérer l'AppState pour le retour de l'app
  // ============================================================
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (nextAppState === 'active') {
        console.log('📱 App returned to foreground, resetting locks...');
        isProcessingRef.current = false;
        
        // Re-vérifier les permissions
        const { status } = await ImagePicker.getCameraPermissionsAsync();
        console.log('📷 Camera permission after foreground:', status);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // ============ COMPUTED ============

  const monthDocs = useMemo(() => {
    return documents.filter(d => {
      if (!d.date || d.date === '--') return false;
      const [y, m] = d.date.split('-').map(Number);
      return y === currentYear && m === currentMonth + 1;
    });
  }, [documents, currentMonth, currentYear]);

  const monthTotal = useMemo(() => monthDocs.reduce((s, d) => s + (d.amount || 0), 0), [monthDocs]);

  const categoryBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    monthDocs.forEach(d => {
      const key = d.category || 'other';
      map[key] = (map[key] || 0) + (d.amount || 0);
    });
    return Object.entries(map)
      .map(([cat, total]) => ({ cat, total, pct: monthTotal > 0 ? (total / monthTotal) * 100 : 0 }))
      .sort((a, b) => b.total - a.total);
  }, [monthDocs, monthTotal]);

  // Group documents by day
  const groupedByDay = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const groups: { label: string; docs: Document[] }[] = [];
    const sorted = [...monthDocs].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const dayMap = new Map<string, Document[]>();
    sorted.forEach(d => {
      const key = d.date || 'unknown';
      if (!dayMap.has(key)) dayMap.set(key, []);
      dayMap.get(key)!.push(d);
    });
    dayMap.forEach((docs, date) => {
      let label = date;
      if (date === today) label = "Aujourd'hui";
      else if (date === yesterday) label = 'Hier';
      else {
        const parts = date.split('-');
        if (parts.length === 3) {
          const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
          label = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
        }
      }
      groups.push({ label, docs });
    });
    return groups;
  }, [monthDocs]);

  // ============ DATA LOADING ============

  const loadDocuments = useCallback(async () => {
    try {
      const response = await api.get('/api/documents');
      const data = Array.isArray(response.data) ? response.data : [];
      const docs: Document[] = data.map((doc: any) => ({
        id: doc.id,
        name: doc.name || doc.fournisseur || 'Document',
        category: doc.category || 'other',
        type: doc.fileType === 'pdf' ? 'pdf' as const : 'image' as const,
        date: doc.dateFacture || '--',
        amount: doc.montantTotal,
        currency: doc.currency || 'EUR',
        fournisseur: doc.fournisseur,
        description: doc.description,
        createdAt: doc.createdAt,
      }));
      setDocuments(docs);
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadDocuments(); }, [loadDocuments]);

  // ============ MONTH NAVIGATION ============

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); }
    else setCurrentMonth(m => m - 1);
  };

  const nextMonth = () => {
    // BUG #9 FIX: Limiter la navigation aux mois futurs (max = mois actuel)
    const now = new Date();
    const currentActualMonth = now.getMonth();
    const currentActualYear = now.getFullYear();
    
    // Si on est déjà au mois actuel, ne pas avancer
    if (currentYear === currentActualYear && currentMonth === currentActualMonth) {
      return; // Ne rien faire
    }
    
    // Calculer le mois suivant
    const nextM = currentMonth === 11 ? 0 : currentMonth + 1;
    const nextY = currentMonth === 11 ? currentYear + 1 : currentYear;
    
    // Vérifier que le mois suivant ne dépasse pas le mois actuel
    if (nextY > currentActualYear || (nextY === currentActualYear && nextM > currentActualMonth)) {
      return; // Ne pas avancer au-delà du mois actuel
    }
    
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); }
    else setCurrentMonth(m => m + 1);
  };

  // BUG #9 FIX: Helper pour vérifier si on peut avancer
  const canGoNextMonth = useMemo(() => {
    const now = new Date();
    const nextM = currentMonth === 11 ? 0 : currentMonth + 1;
    const nextY = currentMonth === 11 ? currentYear + 1 : currentYear;
    return !(nextY > now.getFullYear() || (nextY === now.getFullYear() && nextM > now.getMonth()));
  }, [currentMonth, currentYear]);

  // BUG #10 FIX: Validation du format de date
  const isValidDateFormat = (dateStr: string): boolean => {
    if (!dateStr) return false;
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateStr)) return false;
    const [year, month, day] = dateStr.split('-').map(Number);
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  };

  // ============ UPLOAD / OCR - CORRIGÉ ============

  const handleTakePhoto = async () => {
    console.log('📸 === TAKE PHOTO PRESSED ===');
    
    // CRITIQUE: Garde contre double appel
    if (isProcessingRef.current) {
      console.log('⚠️ Already processing, ignoring click');
      return;
    }
    
    // Fermer le modal immédiatement
    setShowUploadModal(false);
    
    try {
      isProcessingRef.current = true;
      
      // 1. Toujours demander les permissions
      console.log('1. Requesting camera permissions...');
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      console.log('2. Permission result:', permissionResult.status);
      
      if (permissionResult.status !== 'granted') {
        isProcessingRef.current = false;
        Alert.alert(
          'Permission requise',
          'Autorisez l\'accès à la caméra pour scanner les reçus.',
          [
            { text: 'Annuler', style: 'cancel' },
            { 
              text: 'Ouvrir Paramètres', 
              onPress: () => {
                if (Platform.OS === 'ios') {
                  Linking.openURL('app-settings:');
                } else {
                  Linking.openSettings();
                }
              }
            },
          ]
        );
        return;
      }

      console.log('3. Launching camera...');
      
      // 2. Ouvrir caméra avec options fraîches
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
        exif: false, // Éviter les métadonnées qui peuvent bloquer
      });

      console.log('4. Camera result:', result.canceled ? 'CANCELED' : 'PHOTO TAKEN');

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        console.log('5. Photo URI:', asset.uri?.substring(0, 50) + '...');
        console.log('6. Base64 length:', asset.base64?.length || 0);
        
        // Traiter immédiatement
        await processDocumentWithOCRBase64(
          asset.base64 || '', 
          asset.uri, 
          'image', 
          `Photo_${Date.now()}.jpg`
        );
      } else {
        console.log('5. Photo canceled by user');
        isProcessingRef.current = false;
      }
    } catch (error: any) {
      console.error('❌ CAMERA ERROR:', error);
      isProcessingRef.current = false;
      Alert.alert('Erreur', error?.message || 'Impossible d\'ouvrir la caméra');
    }
  };

  const handleSelectGallery = async () => {
    console.log('🖼️ === GALLERY PRESSED ===');
    
    // CRITIQUE: Garde contre double appel
    if (isProcessingRef.current) {
      console.log('⚠️ Already processing, ignoring click');
      return;
    }
    
    // Fermer le modal immédiatement
    setShowUploadModal(false);
    
    try {
      isProcessingRef.current = true;
      
      // 1. Toujours demander les permissions
      console.log('1. Requesting gallery permissions...');
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      console.log('2. Permission result:', permissionResult.status);
      
      if (permissionResult.status !== 'granted') {
        isProcessingRef.current = false;
        Alert.alert(
          'Permission requise',
          'Autorisez l\'accès à la galerie pour sélectionner des photos.',
          [
            { text: 'Annuler', style: 'cancel' },
            { 
              text: 'Ouvrir Paramètres', 
              onPress: () => {
                if (Platform.OS === 'ios') {
                  Linking.openURL('app-settings:');
                } else {
                  Linking.openSettings();
                }
              }
            },
          ]
        );
        return;
      }

      console.log('3. Launching gallery...');

      // 2. Ouvrir galerie avec options fraîches
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
        exif: false,
      });

      console.log('4. Gallery result:', result.canceled ? 'CANCELED' : 'IMAGE SELECTED');

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        console.log('5. Image URI:', asset.uri?.substring(0, 50) + '...');
        console.log('6. Base64 length:', asset.base64?.length || 0);
        
        // Traiter immédiatement
        await processDocumentWithOCRBase64(
          asset.base64 || '', 
          asset.uri, 
          'image', 
          `Galerie_${Date.now()}.jpg`
        );
      } else {
        console.log('5. Selection canceled by user');
        isProcessingRef.current = false;
      }
    } catch (error: any) {
      console.error('❌ GALLERY ERROR:', error);
      isProcessingRef.current = false;
      Alert.alert('Erreur', error?.message || 'Impossible d\'ouvrir la galerie');
    }
  };

  // Fonction OCR corrigée
  const processDocumentWithOCRBase64 = async (base64: string, uri: string, type: 'pdf' | 'image', name: string) => {
    console.log('🔍 === OCR PROCESSING START ===');
    
    // Mettre à jour les états
    setIsUploading(true);
    setIsProcessingOCR(true);
    setPendingDocUri(uri);
    setPendingDocBase64(base64);
    setPendingDocType(type);
    setPendingDocName(name);

    try {
      console.log('OCR: Sending image to API...');
      const response = await api.post('/api/invoices/analyze-base64', {
        image_base64: base64,
        filename: name,
      });

      console.log('OCR Response success:', response.data.success);

      if (response.data.success && response.data.data) {
        const data = response.data.data;
        console.log('OCR Data:', {
          fournisseur: data.fournisseur,
          montant: data.montantTotal,
          date: data.dateFacture,
        });
        
        setEditedFournisseur(data.fournisseur || '');
        setEditedDate(data.dateFacture || new Date().toISOString().split('T')[0]);
        setEditedMontant(data.montantTotal?.toString() || '');
        setEditedMontantHT(data.montantHT?.toString() || '');
        setEditedMontantTVA(data.montantTVA?.toString() || '');
        setEditedCategorie(data.categorie || 'Autre');
        setEditedCurrency(data.currency || 'EUR');
      } else {
        // OCR failed - prepare for manual entry
        console.log('OCR: No data extracted, manual entry mode');
        setEditedFournisseur('');
        setEditedDate(new Date().toISOString().split('T')[0]);
        setEditedMontant('');
        setEditedMontantHT('');
        setEditedMontantTVA('');
        setEditedCategorie('Autre');
        setEditedCurrency('EUR');
      }
      
      // Afficher le modal de vérification
      setShowVerificationModal(true);
      
    } catch (error: any) {
      console.error('❌ OCR ERROR:', error?.message || error);
      // BUG #4 FIX: Afficher une alerte si l'OCR échoue
      Alert.alert(
        'OCR non disponible',
        'L\'analyse automatique n\'a pas pu extraire les données. Veuillez remplir le formulaire manuellement.',
        [{ text: 'OK' }]
      );
      // Still show form for manual entry
      setEditedFournisseur('');
      setEditedDate(new Date().toISOString().split('T')[0]);
      setEditedMontant('');
      setEditedMontantHT('');
      setEditedMontantTVA('');
      setEditedCategorie('Autre');
      setEditedCurrency('EUR');
      setShowVerificationModal(true);
    } finally {
      // CRITIQUE: Toujours libérer les verrous
      console.log('🔓 Releasing OCR lock');
      setIsUploading(false);
      setIsProcessingOCR(false);
      isProcessingRef.current = false;
    }
  };

  const handleSaveDocument = async () => {
    console.log('💾 === SAVE DOCUMENT ===');
    
    if (isSaving) {
      console.log('⚠️ Already saving, ignoring');
      return;
    }
    
    // BUG #17 FIX: Utiliser null check explicite au lieu de || pour gérer 0 correctement
    const parsedMontant = parseFloat(editedMontant.replace(',', '.')) || 0;
    const htValue = parseFloat(editedMontantHT.replace(',', '.'));
    const tvaValue = parseFloat(editedMontantTVA.replace(',', '.'));
    const parsedHT = isNaN(htValue) ? undefined : htValue;
    const parsedTVA = isNaN(tvaValue) ? undefined : tvaValue;

    setIsSaving(true);
    
    try {
      const response = await api.post('/api/documents', {
        userId: 'default-user',
        name: editedFournisseur || pendingDocName,
        fournisseur: editedFournisseur,
        dateFacture: editedDate, // BUG #1 FIX: Utiliser la date extraite par l'IA, PAS new Date()
        category: editedCategorie,
        montantTotal: parsedMontant,
        montantHT: parsedHT,
        montantTVA: parsedTVA,
        currency: editedCurrency,
        fileBase64: pendingDocBase64,
        fileType: pendingDocType,
      });

      console.log('✅ Document saved:', response.data.id);

      const saved = response.data;
      const savedDate = saved.dateFacture || editedDate;
      
      // BUG #1 FIX: Ajouter le document à la liste locale
      setDocuments(prev => [{
        id: saved.id,
        name: saved.name,
        category: saved.category,
        type: pendingDocType,
        date: savedDate,
        amount: saved.montantTotal,
        currency: saved.currency || editedCurrency,
        fournisseur: saved.fournisseur,
        createdAt: saved.createdAt,
      }, ...prev]);

      // ============================================================
      // BUG #1 FIX: Naviguer vers le mois de la facture sauvegardée
      // ============================================================
      if (savedDate && savedDate !== '--') {
        const [year, month] = savedDate.split('-').map(Number);
        if (year && month) {
          console.log(`📅 Navigating to invoice month: ${year}-${month}`);
          setCurrentYear(year);
          setCurrentMonth(month - 1); // Month is 0-indexed
        }
      }

      // CRITIQUE: Reset complet après succès
      setShowVerificationModal(false);
      fullReset();
      
      Alert.alert('Succès', 'Document enregistré avec succès');
      
    } catch (error: any) {
      console.error('❌ SAVE ERROR:', error);
      const errorMsg = error?.response?.data?.detail || error?.message || "Échec de l'enregistrement";
      Alert.alert('Erreur', errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelVerification = () => {
    console.log('❌ Verification canceled');
    setShowVerificationModal(false);
    fullReset();
  };

  const handleDeleteDoc = async (docId: string) => {
    Alert.alert('Supprimer', 'Voulez-vous vraiment supprimer ce reçu ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/api/documents/${docId}`);
            setDocuments(prev => prev.filter(d => d.id !== docId));
            setShowDocDetail(null);
          } catch { Alert.alert('Erreur', 'Échec de la suppression'); }
        },
      },
    ]);
  };

  // P2-7 FIX: Handler pour ouvrir le modal de modification
  const handleEditDoc = (doc: Document) => {
    setEditingDoc(doc);
    setEditedFournisseur(doc.fournisseur || doc.name || '');
    setEditedDate(doc.date || '');
    setEditedMontant(doc.amount?.toString() || '');
    setEditedCategorie(doc.category || 'Autre');
    setEditedCurrency(doc.currency || 'EUR');
    setShowDocDetail(null);
    setShowEditDocModal(true);
  };

  // P2-7 FIX: Handler pour sauvegarder les modifications
  const handleUpdateDocument = async () => {
    if (!editingDoc || isSaving) return;
    
    // P2-10 FIX: Validation du format de date
    if (editedDate && !isValidDateFormat(editedDate)) {
      Alert.alert('Erreur', 'Format de date invalide. Utilisez AAAA-MM-JJ');
      return;
    }
    
    setIsSaving(true);
    try {
      const parsedMontant = parseFloat(editedMontant.replace(',', '.')) || 0;
      
      const response = await api.put(`/api/documents/${editingDoc.id}`, {
        name: editedFournisseur || editingDoc.name,
        fournisseur: editedFournisseur,
        dateFacture: editedDate,
        category: editedCategorie,
        montantTotal: parsedMontant,
        currency: editedCurrency,
      });
      
      // Mettre à jour localement
      setDocuments(prev => prev.map(d => 
        d.id === editingDoc.id 
          ? { ...d, 
              name: editedFournisseur || d.name, 
              fournisseur: editedFournisseur,
              date: editedDate || d.date,
              category: editedCategorie,
              amount: parsedMontant,
              currency: editedCurrency,
            }
          : d
      ));
      
      setShowEditDocModal(false);
      setEditingDoc(null);
      Alert.alert('Succès', 'Document mis à jour');
    } catch (error: any) {
      Alert.alert('Erreur', error?.message || 'Impossible de modifier le document');
    } finally {
      setIsSaving(false);
    }
  };

  // ============ RENDER ============

  if (isLoading) {
    return (
      <View style={[s.container, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#1e3c72" style={{ marginTop: 60 }} />
      </View>
    );
  }

  // CRITIQUE: Désactiver les boutons pendant le traitement
  const isButtonsDisabled = isUploading || isProcessingOCR || isProcessingRef.current;

  return (
    <View style={[s.container, { paddingTop: insets.top }]} data-testid="documents-screen">
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadDocuments(); }} />}
      >
        {/* ── Month Header ── */}
        <View style={s.monthHeader}>
          <View>
            <Text style={s.monthTitle}>{MONTHS_FR[currentMonth]} {currentYear}</Text>
            <Text style={s.monthTotal}>{monthTotal.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</Text>
          </View>
          <View style={s.monthNav}>
            <TouchableOpacity onPress={prevMonth} style={s.monthBtn} data-testid="month-prev">
              <Ionicons name="chevron-back" size={22} color="#1e3c72" />
            </TouchableOpacity>
            {/* BUG #9 FIX: Désactiver le bouton si on ne peut pas avancer */}
            <TouchableOpacity 
              onPress={nextMonth} 
              style={[s.monthBtn, !canGoNextMonth && s.monthBtnDisabled]} 
              disabled={!canGoNextMonth}
              data-testid="month-next"
            >
              <Ionicons name="chevron-forward" size={22} color={canGoNextMonth ? "#1e3c72" : "#ccc"} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Category Breakdown ── */}
        {categoryBreakdown.length > 0 && (
          <View style={s.section}>
            {(showAllCategories ? categoryBreakdown : categoryBreakdown.slice(0, 3)).map(({ cat, total, pct }) => {
              const cfg = getCatConfig(cat);
              return (
                <View key={cat} style={s.catRow}>
                  <View style={s.catHeader}>
                    <View style={s.catLeft}>
                      <Ionicons name={cfg.icon as any} size={18} color={cfg.color} />
                      <Text style={s.catLabel}>{cfg.label}</Text>
                    </View>
                    <Text style={s.catPct}>{pct.toFixed(0)}%</Text>
                  </View>
                  <View style={s.barBg}>
                    <View style={[s.barFill, { width: `${Math.min(pct, 100)}%`, backgroundColor: cfg.color }]} />
                  </View>
                  <Text style={s.catAmount}>{total.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</Text>
                </View>
              );
            })}
            {categoryBreakdown.length > 3 && (
              <TouchableOpacity onPress={() => setShowAllCategories(!showAllCategories)} style={s.seeAllBtn}>
                <Text style={s.seeAllText}>
                  {showAllCategories ? 'Moins' : `Voir tout (${categoryBreakdown.length})`}
                </Text>
                <Ionicons name={showAllCategories ? 'chevron-up' : 'chevron-forward'} size={16} color="#1e3c72" />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── Receipts List ── */}
        <View style={s.receiptsSection}>
          <Text style={s.receiptsTitle}>Reçus du mois ({monthDocs.length})</Text>

          {monthDocs.length === 0 ? (
            <View style={s.emptyState}>
              <Ionicons name="document-text-outline" size={48} color="#ccc" />
              <Text style={s.emptyText}>Aucun reçu ce mois</Text>
              <Text style={s.emptySubtext}>Scannez une facture pour commencer</Text>
            </View>
          ) : (
            groupedByDay.map(group => (
              <View key={group.label}>
                <Text style={s.dayLabel}>{group.label}</Text>
                {group.docs.map(doc => {
                  const cfg = getCatConfig(doc.category);
                  return (
                    <TouchableOpacity
                      key={doc.id}
                      style={s.receiptCard}
                      onPress={() => setShowDocDetail(doc)}
                      data-testid={`receipt-${doc.id}`}
                    >
                      <View style={[s.receiptIcon, { backgroundColor: cfg.color + '15' }]}>
                        <Ionicons name={cfg.icon as any} size={20} color={cfg.color} />
                      </View>
                      <View style={s.receiptInfo}>
                        <Text style={s.receiptName} numberOfLines={1}>{doc.name}</Text>
                        {doc.fournisseur && doc.fournisseur !== doc.name && (
                          <Text style={s.receiptSub} numberOfLines={1}>{doc.fournisseur}</Text>
                        )}
                      </View>
                      <View style={s.receiptRight}>
                        <Text style={s.receiptAmount}>
                          {/* BUG #5 FIX: Utiliser doc.currency au lieu de hardcoder € */}
                          {doc.amount != null ? `${doc.amount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} ${getCurrencySymbol(doc.currency)}` : '--'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))
          )}
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ── FAB Camera ── */}
      <TouchableOpacity
        style={[s.fab, { bottom: insets.bottom + 80 }, isButtonsDisabled && s.fabDisabled]}
        onPress={() => {
          console.log('🔘 FAB pressed');
          if (!isButtonsDisabled) {
            setShowUploadModal(true);
          }
        }}
        disabled={isButtonsDisabled}
        activeOpacity={0.7}
        data-testid="fab-upload"
      >
        <Ionicons name="camera" size={28} color="#fff" />
      </TouchableOpacity>

      {/* ── Upload Modal ── */}
      <Modal 
        visible={showUploadModal} 
        animationType="slide" 
        transparent
        onRequestClose={() => {
          console.log('Upload modal close requested');
          setShowUploadModal(false);
        }}
      >
        <View style={s.modalOverlay}>
          <View style={s.uploadSheet}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>Ajouter un reçu</Text>

            <TouchableOpacity 
              style={[s.uploadOption, isButtonsDisabled && s.uploadOptionDisabled]} 
              onPress={handleTakePhoto} 
              disabled={isButtonsDisabled}
              activeOpacity={0.7}
              data-testid="upload-camera"
            >
              <View style={[s.uploadIconWrap, { backgroundColor: '#e3f2fd' }]}>
                <Ionicons name="camera" size={24} color="#1976d2" />
              </View>
              <View>
                <Text style={s.uploadOptionTitle}>Prendre une photo</Text>
                <Text style={s.uploadOptionSub}>Scanner une facture papier</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[s.uploadOption, isButtonsDisabled && s.uploadOptionDisabled]} 
              onPress={handleSelectGallery} 
              disabled={isButtonsDisabled}
              activeOpacity={0.7}
              data-testid="upload-gallery"
            >
              <View style={[s.uploadIconWrap, { backgroundColor: '#e8f5e9' }]}>
                <Ionicons name="images" size={24} color="#388e3c" />
              </View>
              <View>
                <Text style={s.uploadOptionTitle}>Galerie photos</Text>
                <Text style={s.uploadOptionSub}>Depuis vos photos</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={s.cancelBtn} onPress={() => setShowUploadModal(false)}>
              <Text style={s.cancelText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── OCR Verification Modal ── */}
      <Modal 
        visible={showVerificationModal} 
        animationType="slide" 
        transparent
        onRequestClose={handleCancelVerification}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.modalOverlay}>
          <View style={s.verifySheet}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>Vérifier le reçu</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.fieldLabel}>Fournisseur</Text>
              <TextInput style={s.input} value={editedFournisseur} onChangeText={setEditedFournisseur} placeholder="Nom du fournisseur" />

              <View style={s.amountRow}>
                <View style={s.amountField}>
                  <Text style={s.fieldLabel}>Montant</Text>
                  <TextInput style={s.input} value={editedMontant} onChangeText={setEditedMontant} placeholder="0.00" keyboardType="decimal-pad" />
                </View>
                <View style={s.currencyField}>
                  <Text style={s.fieldLabel}>Devise</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.currencyPicker}>
                    {CURRENCIES.map(cur => (
                      <TouchableOpacity
                        key={cur}
                        style={[s.currencyChip, editedCurrency === cur && s.currencyChipActive]}
                        onPress={() => setEditedCurrency(cur)}
                      >
                        <Text style={[s.currencyChipText, editedCurrency === cur && s.currencyChipTextActive]}>{cur}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>

              <Text style={s.fieldLabel}>Date</Text>
              <TextInput style={s.input} value={editedDate} onChangeText={setEditedDate} placeholder="AAAA-MM-JJ" />

              <Text style={s.fieldLabel}>Catégorie</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.catPicker}>
                {OCR_CATEGORIES.map(c => {
                  const cfg = getCatConfig(c);
                  const active = editedCategorie === c;
                  return (
                    <TouchableOpacity
                      key={c}
                      style={[s.catChip, active && { backgroundColor: cfg.color }]}
                      onPress={() => setEditedCategorie(c)}
                    >
                      <Ionicons name={cfg.icon as any} size={14} color={active ? '#fff' : cfg.color} />
                      <Text style={[s.catChipText, active && { color: '#fff' }]}>{cfg.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <TouchableOpacity 
                style={[s.saveBtn, isSaving && s.saveBtnDisabled]} 
                onPress={handleSaveDocument} 
                disabled={isSaving}
                data-testid="save-document"
              >
                {isSaving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={s.saveBtnText}>Enregistrer</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={s.cancelBtn} onPress={handleCancelVerification}>
                <Text style={s.cancelText}>Annuler</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Document Detail Modal ── */}
      <Modal visible={!!showDocDetail} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.detailSheet}>
            <View style={s.sheetHandle} />
            {showDocDetail && (() => {
              const cfg = getCatConfig(showDocDetail.category);
              return (
                <>
                  <View style={s.detailHeader}>
                    <View style={[s.detailIconWrap, { backgroundColor: cfg.color + '15' }]}>
                      <Ionicons name={cfg.icon as any} size={28} color={cfg.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.detailName}>{showDocDetail.name}</Text>
                      <Text style={s.detailSub}>{cfg.label} — {showDocDetail.date}</Text>
                    </View>
                  </View>

                  <View style={s.detailAmountBox}>
                    <Text style={s.detailAmountLabel}>Montant</Text>
                    <Text style={s.detailAmount}>
                      {showDocDetail.amount ? `${showDocDetail.amount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €` : '--'}
                    </Text>
                  </View>

                  {showDocDetail.fournisseur && (
                    <View style={s.detailRow}>
                      <Text style={s.detailRowLabel}>Fournisseur</Text>
                      <Text style={s.detailRowValue}>{showDocDetail.fournisseur}</Text>
                    </View>
                  )}
                  {showDocDetail.description && (
                    <View style={s.detailRow}>
                      <Text style={s.detailRowLabel}>Description</Text>
                      <Text style={s.detailRowValue}>{showDocDetail.description}</Text>
                    </View>
                  )}

                  {/* P2-7 FIX: Bouton Modifier */}
                  <TouchableOpacity style={s.editBtn} onPress={() => handleEditDoc(showDocDetail)}>
                    <Ionicons name="pencil-outline" size={18} color="#1e3c72" />
                    <Text style={s.editText}>Modifier</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={s.deleteBtn} onPress={() => handleDeleteDoc(showDocDetail.id)}>
                    <Ionicons name="trash-outline" size={18} color="#E53935" />
                    <Text style={s.deleteText}>Supprimer</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.cancelBtn} onPress={() => setShowDocDetail(null)}>
                    <Text style={s.cancelText}>Fermer</Text>
                  </TouchableOpacity>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* ── Uploading Overlay ── */}
      {isUploading && (
        <View style={s.uploadingOverlay}>
          <View style={s.uploadingCard}>
            <ActivityIndicator size="large" color="#1e3c72" />
            <Text style={s.uploadingText}>Analyse en cours...</Text>
            <Text style={s.uploadingSub}>Extraction des données de la facture</Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ============ STYLES ============

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },

  // Month Header
  monthHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 },
  monthTitle: { fontSize: 24, fontWeight: '700', color: '#1a1a1a' },
  monthTotal: { fontSize: 28, fontWeight: '800', color: '#1e3c72', marginTop: 4 },
  monthNav: { flexDirection: 'row', gap: 8 },
  monthBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#e8f0fe', justifyContent: 'center', alignItems: 'center' },
  monthBtnDisabled: { backgroundColor: '#f5f5f5', opacity: 0.5 },

  // Category Breakdown
  section: { backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 16, padding: 16, marginBottom: 16 },
  catRow: { marginBottom: 14 },
  catHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  catLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  catLabel: { fontSize: 15, fontWeight: '600', color: '#333' },
  catPct: { fontSize: 13, fontWeight: '600', color: '#999' },
  barBg: { height: 6, backgroundColor: '#f0f0f0', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  catAmount: { fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginTop: 4 },
  seeAllBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingTop: 8 },
  seeAllText: { fontSize: 14, fontWeight: '600', color: '#1e3c72' },

  // Receipts
  receiptsSection: { paddingHorizontal: 16 },
  receiptsTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginBottom: 16 },
  dayLabel: { fontSize: 13, fontWeight: '600', color: '#999', marginTop: 16, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  receiptCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8 },
  receiptIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  receiptInfo: { flex: 1 },
  receiptName: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  receiptSub: { fontSize: 12, color: '#999', marginTop: 2 },
  receiptRight: { alignItems: 'flex-end' },
  receiptAmount: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },

  // Empty
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#999', marginTop: 12 },
  emptySubtext: { fontSize: 13, color: '#bbb', marginTop: 4 },

  // FAB
  fab: { position: 'absolute', right: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: '#1e3c72', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 8 },
  fabDisabled: { opacity: 0.5 },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  uploadSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  verifySheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, maxHeight: '90%' },
  detailSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  sheetHandle: { width: 40, height: 4, backgroundColor: '#ddd', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 20, fontWeight: '700', color: '#1a1a1a', marginBottom: 20 },

  // Upload options
  uploadOption: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  uploadOptionDisabled: { opacity: 0.5 },
  uploadIconWrap: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  uploadOptionTitle: { fontSize: 16, fontWeight: '600', color: '#1a1a1a' },
  uploadOptionSub: { fontSize: 13, color: '#999', marginTop: 2 },

  // Form
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#666', marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: '#f5f5f5', borderRadius: 12, padding: 14, fontSize: 16, color: '#1a1a1a' },
  rowInputs: { flexDirection: 'row', gap: 12 },
  catPicker: { flexDirection: 'row', marginVertical: 8 },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#f0f0f0', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8 },
  catChipText: { fontSize: 13, fontWeight: '500', color: '#666' },
  
  // Amount & Currency row
  amountRow: { flexDirection: 'row', gap: 12 },
  amountField: { flex: 2 },
  currencyField: { flex: 3 },
  currencyPicker: { flexDirection: 'row' },
  currencyChip: { backgroundColor: '#f0f0f0', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, marginRight: 6 },
  currencyChipActive: { backgroundColor: '#1e3c72' },
  currencyChipText: { fontSize: 14, fontWeight: '600', color: '#666' },
  currencyChipTextActive: { color: '#fff' },

  // Buttons
  saveBtn: { backgroundColor: '#1e3c72', borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 20 },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  cancelBtn: { padding: 14, alignItems: 'center', marginTop: 8 },
  cancelText: { fontSize: 15, fontWeight: '600', color: '#999' },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, marginTop: 16, backgroundColor: '#ffebee', borderRadius: 12 },
  deleteText: { fontSize: 15, fontWeight: '600', color: '#E53935' },

  // Detail
  detailHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 },
  detailIconWrap: { width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  detailName: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  detailSub: { fontSize: 13, color: '#999', marginTop: 2 },
  detailAmountBox: { backgroundColor: '#f8f9fa', borderRadius: 14, padding: 16, marginBottom: 16, alignItems: 'center' },
  detailAmountLabel: { fontSize: 12, color: '#999', marginBottom: 4 },
  detailAmount: { fontSize: 28, fontWeight: '800', color: '#1e3c72' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  detailRowLabel: { fontSize: 14, color: '#999' },
  detailRowValue: { fontSize: 14, fontWeight: '600', color: '#1a1a1a', maxWidth: '60%', textAlign: 'right' },

  // Uploading overlay
  uploadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  uploadingCard: { backgroundColor: '#fff', borderRadius: 20, padding: 32, alignItems: 'center', width: '80%' },
  uploadingText: { fontSize: 18, fontWeight: '600', color: '#1a1a1a', marginTop: 16 },
  uploadingSub: { fontSize: 13, color: '#999', marginTop: 8, textAlign: 'center' },
});
