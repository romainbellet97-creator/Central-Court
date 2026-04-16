import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  RefreshControl,
  Switch,
  Alert,
  Linking,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import DateTimePicker from '@react-native-community/datetimepicker';
import Colors from '../../src/constants/colors';
import {
  fetchResidenceStats,
  fetchCountries,
  fetchDayPresences,
  addDayPresence,
  addBulkDays,
  deleteDayPresence,
  updateDayPresence,
  ResidenceStats,
  CountryStats,
  DayPresence,
} from '../../src/services/api';

const TAX_LIMIT = 183;
const STORAGE_KEY_TRACKING = '@central_court_gps_tracking';
const STORAGE_KEY_LAST_LOG = '@central_court_last_gps_log';

// Country code to flag emoji mapping
const countryFlags: Record<string, string> = {
  FR: '🇫🇷', MC: '🇲🇨', CH: '🇨🇭', ES: '🇪🇸', US: '🇺🇸', GB: '🇬🇧',
  DE: '🇩🇪', IT: '🇮🇹', AE: '🇦🇪', AU: '🇦🇺', AT: '🇦🇹', BE: '🇧🇪',
  BR: '🇧🇷', CA: '🇨🇦', CN: '🇨🇳', HR: '🇭🇷', CZ: '🇨🇿', DK: '🇩🇰',
  FI: '🇫🇮', GR: '🇬🇷', HU: '🇭🇺', IN: '🇮🇳', JP: '🇯🇵', KR: '🇰🇷',
  MX: '🇲🇽', NL: '🇳🇱', NO: '🇳🇴', PL: '🇵🇱', PT: '🇵🇹', QA: '🇶🇦',
  RO: '🇷🇴', SA: '🇸🇦', RS: '🇷🇸', SE: '🇸🇪', TR: '🇹🇷', AR: '🇦🇷',
  CL: '🇨🇱', CO: '🇨🇴', MA: '🇲🇦', TN: '🇹🇳',
};

// Country name to code mapping for reverse geocoding
const countryNameToCode: Record<string, string> = {
  'France': 'FR', 'Monaco': 'MC', 'Switzerland': 'CH', 'Suisse': 'CH',
  'Spain': 'ES', 'Espagne': 'ES', 'United States': 'US', 'États-Unis': 'US',
  'United Kingdom': 'GB', 'Royaume-Uni': 'GB', 'Germany': 'DE', 'Allemagne': 'DE',
  'Italy': 'IT', 'Italie': 'IT', 'United Arab Emirates': 'AE', 'Émirats arabes unis': 'AE',
  'Australia': 'AU', 'Australie': 'AU', 'Austria': 'AT', 'Autriche': 'AT',
  'Belgium': 'BE', 'Belgique': 'BE', 'Brazil': 'BR', 'Brésil': 'BR',
  'Canada': 'CA', 'China': 'CN', 'Chine': 'CN', 'Croatia': 'HR', 'Croatie': 'HR',
  'Czech Republic': 'CZ', 'Tchéquie': 'CZ', 'Denmark': 'DK', 'Danemark': 'DK',
  'Finland': 'FI', 'Finlande': 'FI', 'Greece': 'GR', 'Grèce': 'GR',
  'Hungary': 'HU', 'Hongrie': 'HU', 'India': 'IN', 'Inde': 'IN',
  'Japan': 'JP', 'Japon': 'JP', 'South Korea': 'KR', 'Corée du Sud': 'KR',
  'Mexico': 'MX', 'Mexique': 'MX', 'Netherlands': 'NL', 'Pays-Bas': 'NL',
  'Norway': 'NO', 'Norvège': 'NO', 'Poland': 'PL', 'Pologne': 'PL',
  'Portugal': 'PT', 'Qatar': 'QA', 'Romania': 'RO', 'Roumanie': 'RO',
  'Saudi Arabia': 'SA', 'Arabie Saoudite': 'SA', 'Serbia': 'RS', 'Serbie': 'RS',
  'Sweden': 'SE', 'Suède': 'SE', 'Turkey': 'TR', 'Turquie': 'TR',
  'Argentina': 'AR', 'Argentine': 'AR', 'Chile': 'CL', 'Chili': 'CL',
  'Colombia': 'CO', 'Colombie': 'CO', 'Morocco': 'MA', 'Maroc': 'MA',
  'Tunisia': 'TN', 'Tunisie': 'TN',
};

interface Country {
  code: string;
  name: string;
}

interface LocationInfo {
  country: string;
  countryCode: string;
  city?: string;
}

export default function ResidenceScreen() {
  const insets = useSafeAreaInsets();
  const currentYear = new Date().getFullYear();
  
  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<ResidenceStats | null>(null);
  const [countries, setCountries] = useState<Country[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // GPS Tracking state
  const [gpsEnabled, setGpsEnabled] = useState(false);
  const [locationPermission, setLocationPermission] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
  const [notifPermission, setNotifPermission] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
  const [currentLocation, setCurrentLocation] = useState<LocationInfo | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [lastLogDate, setLastLogDate] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  
  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [submitting, setSubmitting] = useState(false);
  
  // Country detail modal state
  const [showCountryDetail, setShowCountryDetail] = useState(false);
  const [selectedCountryStats, setSelectedCountryStats] = useState<CountryStats | null>(null);
  const [countryDays, setCountryDays] = useState<DayPresence[]>([]);
  const [loadingDays, setLoadingDays] = useState(false);
  const [deletingDay, setDeletingDay] = useState<string | null>(null);
  
  // Edit day modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingDay, setEditingDay] = useState<DayPresence | null>(null);
  const [editCountry, setEditCountry] = useState<Country | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  
  // Date picker state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [singleDate, setSingleDate] = useState(new Date());
  const [bulkStartDate, setBulkStartDate] = useState(new Date());
  const [bulkEndDate, setBulkEndDate] = useState(new Date());
  const [notes, setNotes] = useState('');
  const [showNotesField, setShowNotesField] = useState(false);

  // Calculate days between two dates (INCLUSIVE)
  const calculateDaysBetween = (startDate: Date, endDate: Date): number => {
    const diffTime = endDate.getTime() - startDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, diffDays);
  };

  // Open country detail modal
  const openCountryDetail = async (countryStats: CountryStats) => {
    setSelectedCountryStats(countryStats);
    setShowCountryDetail(true);
    setLoadingDays(true);
    
    try {
      const days = await fetchDayPresences(currentYear);
      // Filter days for this country
      const filteredDays = days.filter(d => d.country === countryStats.country);
      // Sort by date descending
      filteredDays.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setCountryDays(filteredDays);
    } catch (err) {
      console.error('Error loading country days:', err);
    } finally {
      setLoadingDays(false);
    }
  };

  // Delete a day
  const handleDeleteDay = async (date: string) => {
    Alert.alert(
      'Supprimer ce jour ?',
      // BUG #18 FIX: Utiliser formatDateStringDisplay au lieu de new Date(date)
      `Voulez-vous vraiment supprimer le ${formatDateStringDisplay(date)} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            setDeletingDay(date);
            try {
              await deleteDayPresence(date);
              // Remove from local state
              setCountryDays(prev => prev.filter(d => d.date !== date));
              // Reload stats
              loadData();
            } catch (err) {
              console.error('Error deleting day:', err);
              Alert.alert('Erreur', 'Impossible de supprimer ce jour');
            } finally {
              setDeletingDay(null);
            }
          },
        },
      ]
    );
  };

  // Open edit modal for a day
  const handleEditDay = (day: DayPresence) => {
    const country = countries.find(c => c.code === day.country);
    setEditingDay(day);
    setEditCountry(country || null);
    setEditNotes(day.notes || '');
    setShowEditModal(true);
  };

  // Save edited day
  const handleSaveEdit = async () => {
    if (!editingDay || !editCountry) return;
    
    setSavingEdit(true);
    try {
      await updateDayPresence(editingDay.date, {
        country: editCountry.code,
        countryName: editCountry.name,
        notes: editNotes || undefined,
      });
      
      // Update local state
      setCountryDays(prev => prev.map(d => 
        d.date === editingDay.date 
          ? { ...d, country: editCountry.code, countryName: editCountry.name, notes: editNotes }
          : d
      ));
      
      setShowEditModal(false);
      setEditingDay(null);
      setEditCountry(null);
      setEditNotes('');
      
      // Reload stats to update counters
      loadData();
      
      Alert.alert('Succès', 'Jour modifié avec succès');
    } catch (err) {
      console.error('Error updating day:', err);
      Alert.alert('Erreur', 'Impossible de modifier ce jour');
    } finally {
      setSavingEdit(false);
    }
  };

  // Load GPS settings on mount
  useEffect(() => {
    loadGpsSettings();
  }, []);

  // Auto-fetch location when GPS is enabled and permission granted
  useEffect(() => {
    const fetchLocationIfNeeded = async () => {
      if (gpsEnabled && locationPermission === 'granted' && !currentLocation && !isLocating) {
        console.log('Auto-fetching location...');
        await getCurrentLocation();
      }
    };
    fetchLocationIfNeeded();
  }, [gpsEnabled, locationPermission]);

  const loadGpsSettings = async () => {
    try {
      const [trackingEnabled, lastLog] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY_TRACKING),
        AsyncStorage.getItem(STORAGE_KEY_LAST_LOG),
      ]);

      // Check notification permission status
      const { status: notifStatus } = await Notifications.getPermissionsAsync();
      setNotifPermission(notifStatus === 'granted' ? 'granted' : notifStatus === 'undetermined' ? 'undetermined' : 'denied');

      if (trackingEnabled === 'true') {
        setGpsEnabled(true);
        // Check permission and get location immediately
        const { status } = await Location.getForegroundPermissionsAsync();
        const permGranted = status === 'granted';
        setLocationPermission(permGranted ? 'granted' : 'denied');

        // Fetch location right away if permission granted
        if (permGranted) {
          console.log('Permission granted, fetching location...');
          getCurrentLocation();
        }
      }
      
      if (lastLog) {
        setLastLogDate(lastLog);
      }
    } catch (err) {
      console.error('Error loading GPS settings:', err);
    }
  };

  const checkLocationPermission = async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      setLocationPermission(status === 'granted' ? 'granted' : 'denied');
      
      if (status === 'granted') {
        getCurrentLocation();
      }
    } catch (err) {
      console.error('Error checking location permission:', err);
    }
  };

  const requestLocationPermission = async (): Promise<boolean> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status === 'granted' ? 'granted' : 'denied');
      return status === 'granted';
    } catch (err) {
      console.error('Error requesting location permission:', err);
      return false;
    }
  };

  const getCurrentLocation = async () => {
    setIsLocating(true);
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      
      const [geocode] = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      
      if (geocode?.country) {
        const countryCode = countryNameToCode[geocode.country] || 
                          countryNameToCode[geocode.isoCountryCode || ''] ||
                          geocode.isoCountryCode || '';
        
        setCurrentLocation({
          country: geocode.country,
          countryCode: countryCode,
          city: geocode.city || geocode.subregion || undefined,
        });
      }
    } catch (err) {
      console.error('Error getting location:', err);
    } finally {
      setIsLocating(false);
    }
  };

  const toggleGpsTracking = async (enabled: boolean) => {
    if (enabled) {
      // If already denied, the system won't show the dialog again — open Settings directly
      if (locationPermission === 'denied') {
        Alert.alert(
          'Localisation refusée',
          'Vous avez refusé l\'accès à la localisation. Veuillez l\'activer dans les Réglages de l\'appareil.',
          [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Ouvrir les Réglages', onPress: () => Linking.openSettings() },
          ]
        );
        return;
      }

      const granted = await requestLocationPermission();
      if (!granted) {
        // Permission was just denied for the first time
        Alert.alert(
          'Permission requise',
          'Le tracking GPS nécessite l\'accès à votre localisation. Vous pouvez l\'activer dans les Réglages.',
          [
            { text: 'Plus tard', style: 'cancel' },
            { text: 'Ouvrir les Réglages', onPress: () => Linking.openSettings() },
          ]
        );
        return;
      }
      await getCurrentLocation();
    }

    setGpsEnabled(enabled);
    await AsyncStorage.setItem(STORAGE_KEY_TRACKING, enabled ? 'true' : 'false');
  };

  const logCurrentDay = async () => {
    if (!currentLocation?.countryCode) {
      Alert.alert('Erreur', 'Impossible de déterminer votre position actuelle.');
      return;
    }
    
    const today = new Date().toISOString().split('T')[0];
    
    // Check if already logged today
    if (lastLogDate === today) {
      Alert.alert('Déjà enregistré', 'Votre présence a déjà été enregistrée aujourd\'hui.');
      return;
    }
    
    setSubmitting(true);
    try {
      const countryName = countries.find(c => c.code === currentLocation.countryCode)?.name || currentLocation.country;
      
      await addDayPresence({
        date: today,
        country: currentLocation.countryCode,
        countryName: countryName,
        status: 'confirmed',
        notes: currentLocation.city ? `GPS - ${currentLocation.city}` : 'GPS',
      });
      
      setLastLogDate(today);
      await AsyncStorage.setItem(STORAGE_KEY_LAST_LOG, today);
      
      Alert.alert(
        'Enregistré !',
        `Présence en ${countryName} enregistrée pour aujourd'hui.`
      );
      
      loadData();
    } catch (err) {
      console.error('Error logging day:', err);
      Alert.alert('Erreur', 'Impossible d\'enregistrer le jour.');
    } finally {
      setSubmitting(false);
    }
  };

  // Load data
  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [statsData, countriesData] = await Promise.all([
        fetchResidenceStats(currentYear),
        fetchCountries(),
      ]);
      setStats(statsData);
      setCountries(countriesData);
    } catch (err) {
      console.error('Error loading residence data:', err);
      setError('Erreur de chargement des données');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentYear]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
    if (gpsEnabled && locationPermission === 'granted') {
      getCurrentLocation();
    }
  }, [loadData, gpsEnabled, locationPermission]);

  // Get color based on percentage
  const getProgressColor = (percent: number): string => {
    if (percent >= 100) return Colors.danger;
    if (percent >= 75) return Colors.warning;
    if (percent >= 50) return '#FFA726';
    return Colors.success;
  };

  // Format date for display
  const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  // BUG #18/#19 FIX: Parser les dates YYYY-MM-DD sans décalage UTC
  const parseDateString = (dateStr: string): Date => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day); // Mois est 0-indexé
  };

  const formatDateDisplay = (date: Date): string => {
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // BUG #18/#19 FIX: Formater une string date sans décalage UTC
  const formatDateStringDisplay = (dateStr: string): string => {
    const date = parseDateString(dateStr);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // Add single day
  const handleAddDay = async () => {
    if (!selectedCountry) return;
    
    setSubmitting(true);
    try {
      await addDayPresence({
        date: formatDate(singleDate),
        country: selectedCountry.code,
        countryName: selectedCountry.name,
        status: 'manual',
        notes: notes || undefined,
      });
      setShowAddModal(false);
      setSingleDate(new Date());
      setNotes('');
      setShowNotesField(false); // BUG #11 FIX: Reset l'état des notes
      setSelectedCountry(null);
      loadData();
      // BUG #6 FIX: Message de succès
      Alert.alert('Succès', 'Jour de présence enregistré.');
    } catch (err) {
      console.error('Error adding day:', err);
      // BUG #6 FIX: Afficher une alerte si l'ajout échoue
      Alert.alert('Erreur', 'Impossible d\'enregistrer ce jour de présence. Veuillez réessayer.');
    } finally {
      setSubmitting(false);
    }
  };

  // Add bulk days
  const handleAddBulkDays = async () => {
    if (!selectedCountry) return;
    
    if (bulkEndDate < bulkStartDate) {
      Alert.alert('Erreur', 'La date de fin doit être après la date de début.');
      return;
    }
    
    setSubmitting(true);
    try {
      // Calculer le nombre de jours ajoutés
      const diffTime = Math.abs(bulkEndDate.getTime() - bulkStartDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      
      await addBulkDays({
        startDate: formatDate(bulkStartDate),
        endDate: formatDate(bulkEndDate),
        country: selectedCountry.code,
        countryName: selectedCountry.name,
        notes: notes || undefined,
      });
      setShowBulkModal(false);
      setBulkStartDate(new Date());
      setBulkEndDate(new Date());
      setNotes('');
      setShowNotesField(false); // BUG #11 FIX: Reset l'état des notes
      setSelectedCountry(null);
      loadData();
      // BUG #14 FIX: Message de succès avec le nombre de jours
      Alert.alert('Succès', `${diffDays} jour${diffDays > 1 ? 's' : ''} de présence enregistré${diffDays > 1 ? 's' : ''}.`);
    } catch (err) {
      console.error('Error adding bulk days:', err);
      Alert.alert('Erreur', 'Maximum 90 jours par séjour.');
    } finally {
      setSubmitting(false);
    }
  };

  // Quick add from GPS
  const handleQuickAddFromGps = () => {
    if (currentLocation?.countryCode) {
      const country = countries.find(c => c.code === currentLocation.countryCode);
      if (country) {
        setSelectedCountry(country);
        setSingleDate(new Date());
        setNotes(currentLocation.city ? `Séjour à ${currentLocation.city}` : '');
        setShowAddModal(true);
      }
    }
  };

  // Render country card
  const renderCountryCard = (country: CountryStats, index: number) => {
    const flag = countryFlags[country.country] || '🌍';
    const progressPercent = Math.min(country.percentOfThreshold, 100);
    const progressColor = getProgressColor(country.percentOfThreshold);
    const remaining = Math.max(0, country.threshold - country.totalDays);
    
    const isWarning = country.percentOfThreshold >= 75;
    const isCritical = country.percentOfThreshold >= 100;

    return (
      <TouchableOpacity
        key={country.country}
        style={[
          styles.countryCard,
          isCritical && styles.countryCardCritical,
          isWarning && !isCritical && styles.countryCardWarning,
        ]}
        onPress={() => openCountryDetail(country)}
        activeOpacity={0.7}
      >
        {isCritical && (
          <View style={styles.alertBadge}>
            <Ionicons name="warning" size={12} color="#fff" />
            <Text style={styles.alertBadgeText}>Seuil dépassé</Text>
          </View>
        )}
        
        <View style={styles.countryHeader}>
          <View style={styles.countryInfo}>
            <Text style={styles.countryFlag}>{flag}</Text>
            <View>
              <Text style={styles.countryName}>{country.countryName}</Text>
              <Text style={styles.countryCode}>{country.country}</Text>
            </View>
          </View>
          <View style={styles.daysContainer}>
            <Text style={[styles.daysCount, isCritical && styles.daysCountCritical]}>
              {country.totalDays}
            </Text>
            <Text style={styles.daysLimit}>/ {country.threshold}j</Text>
          </View>
        </View>

        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${progressPercent}%`, backgroundColor: progressColor }
              ]}
            />
          </View>
          <View style={styles.progressLabels}>
            <Text style={[styles.percentText, { color: progressColor }]}>
              {country.percentOfThreshold.toFixed(0)}%
            </Text>
            <Text style={styles.remainingText}>
              {isCritical 
                ? `+${country.totalDays - country.threshold}j au-delà` 
                : `${remaining}j restants`}
            </Text>
          </View>
        </View>

        {country.longestStreak > 1 && (
          <View style={styles.streakInfo}>
            <Ionicons name="flame" size={14} color={Colors.warning} />
            <Text style={styles.streakText}>
              Plus longue série: {country.longestStreak} jours consécutifs
            </Text>
          </View>
        )}

        {/* Tap hint */}
        <View style={styles.tapHint}>
          <Text style={styles.tapHintText}>Appuyer pour voir les détails</Text>
          <Ionicons name="chevron-forward" size={14} color={Colors.text.muted} />
        </View>
      </TouchableOpacity>
    );
  };

  // Loading state
  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Chargement des données...</Text>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Ionicons name="cloud-offline" size={48} color={Colors.text.muted} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={loadData}>
          <Text style={styles.retryBtnText}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const today = new Date().toISOString().split('T')[0];
  const alreadyLoggedToday = lastLogDate === today;

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        style={[styles.header, { paddingTop: insets.top + 16 }]}
      >
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>Résidence {currentYear}</Text>
            <Text style={styles.headerSubtitle}>
              Suivi des jours par pays
            </Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity 
              style={styles.settingsBtn}
              onPress={() => setShowSettings(true)}
            >
              <Ionicons name="settings-outline" size={22} color="#fff" />
            </TouchableOpacity>
            <View style={styles.totalBadge}>
              <Text style={styles.totalBadgeNumber}>{stats?.totalDaysTracked || 0}</Text>
              <Text style={styles.totalBadgeLabel}>jours</Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      {/* GPS Card */}
      {gpsEnabled && (
        <View style={styles.gpsCard}>
          <View style={styles.gpsHeader}>
            <View style={styles.gpsStatus}>
              <View style={[styles.gpsIndicator, Platform.OS !== 'web' && locationPermission === 'granted' && styles.gpsIndicatorActive]} />
              <Text style={styles.gpsStatusText}>
                {Platform.OS === 'web' ? 'GPS non disponible sur navigateur' : isLocating ? 'Localisation...' : locationPermission === 'granted' ? 'GPS actif' : 'GPS désactivé'}
              </Text>
            </View>
            {currentLocation && Platform.OS !== 'web' && (
              <TouchableOpacity style={styles.refreshLocationBtn} onPress={getCurrentLocation}>
                <Ionicons name="refresh" size={16} color={Colors.primary} />
              </TouchableOpacity>
            )}
          </View>
          
          {Platform.OS === 'web' ? (
            <View style={styles.webUnavailableRow}>
              <Ionicons name="phone-portrait-outline" size={18} color="#9CA3AF" />
              <Text style={styles.webUnavailableText}>
                Téléchargez l'application mobile pour utiliser le GPS
              </Text>
            </View>
          ) : currentLocation ? (
            <View style={styles.currentLocationInfo}>
              <Text style={styles.currentLocationFlag}>
                {countryFlags[currentLocation.countryCode] || '🌍'}
              </Text>
              <View style={styles.currentLocationText}>
                <Text style={styles.currentLocationCountry}>{currentLocation.country}</Text>
                {currentLocation.city && (
                  <Text style={styles.currentLocationCity}>{currentLocation.city}</Text>
                )}
              </View>
              <TouchableOpacity
                style={[
                  styles.logTodayBtn,
                  alreadyLoggedToday && styles.logTodayBtnDisabled,
                ]}
                onPress={logCurrentDay}
                disabled={alreadyLoggedToday || submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons
                      name={alreadyLoggedToday ? "checkmark-circle" : "add-circle"}
                      size={18}
                      color="#fff"
                    />
                    <Text style={styles.logTodayBtnText}>
                      {alreadyLoggedToday ? 'Enregistré' : 'Aujourd\'hui'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : isLocating ? (
            <View style={styles.locatingContainer}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.locatingText}>Recherche de votre position...</Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.enableGpsBtn} onPress={getCurrentLocation}>
              <Ionicons name="location" size={18} color={Colors.primary} />
              <Text style={styles.enableGpsBtnText}>Obtenir ma position</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Warnings */}
      {stats?.warnings && stats.warnings.length > 0 && (
        <View style={styles.warningsContainer}>
          {stats.warnings.map((warning, idx) => (
            <View
              key={idx}
              style={[
                styles.warningCard,
                warning.severity === 'critical' ? styles.warningCritical : styles.warningNormal,
              ]}
            >
              <Ionicons
                name={warning.severity === 'critical' ? 'alert-circle' : 'warning'}
                size={20}
                color={warning.severity === 'critical' ? Colors.danger : Colors.warning}
              />
              <Text style={styles.warningText}>{warning.message}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Stats Summary */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{stats?.countries?.length || 0}</Text>
          <Text style={styles.statLabel}>Pays visités</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: Colors.success }]}>
            {stats?.primaryCountry?.totalDays || 0}
          </Text>
          <Text style={styles.statLabel}>
            {stats?.primaryCountry?.countryName || 'Principal'}
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: Colors.primary }]}>
            {365 - (stats?.totalDaysTracked || 0)}
          </Text>
          <Text style={styles.statLabel}>Jours restants</Text>
        </View>
      </View>

      {/* Country List */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Jours par pays</Text>
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => setShowAddModal(true)}
            >
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.addBtnText}>Jour</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.addBtn, styles.bulkBtn]}
              onPress={() => setShowBulkModal(true)}
            >
              <Ionicons name="calendar" size={18} color="#fff" />
              <Text style={styles.addBtnText}>Séjour</Text>
            </TouchableOpacity>
          </View>
        </View>

        {stats?.countries && stats.countries.length > 0 ? (
          stats.countries.map((country, idx) => renderCountryCard(country, idx))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="globe-outline" size={48} color={Colors.text.muted} />
            <Text style={styles.emptyTitle}>Aucun jour enregistré</Text>
            <Text style={styles.emptySubtitle}>
              {gpsEnabled 
                ? 'Utilisez le bouton GPS ci-dessus pour enregistrer votre position' 
                : 'Activez le GPS ou ajoutez des jours manuellement'}
            </Text>
            {!gpsEnabled && (
              <TouchableOpacity
                style={[styles.enableGpsEmptyBtn, Platform.OS === 'web' && { opacity: 0.4 }]}
                onPress={Platform.OS === 'web'
                  ? () => Alert.alert('Application mobile requise', 'Le tracking GPS n\'est pas disponible sur navigateur. Téléchargez l\'application mobile pour utiliser cette fonctionnalité.')
                  : () => setShowSettings(true)
                }
              >
                <Ionicons name="location" size={18} color="#fff" />
                <Text style={styles.enableGpsEmptyBtnText}>
                  {Platform.OS === 'web' ? 'GPS — Application requise' : 'Activer le GPS'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={20} color={Colors.primary} />
          <Text style={styles.infoText}>
            Règle des 183 jours : vous devenez résident fiscal d'un pays si vous y passez plus de 183 jours par an.
          </Text>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Settings Modal */}
      <Modal visible={showSettings} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Paramètres GPS</Text>
              <TouchableOpacity onPress={() => setShowSettings(false)}>
                <Ionicons name="close" size={24} color={Colors.text.primary} />
              </TouchableOpacity>
            </View>

            <View style={[styles.settingRow, Platform.OS === 'web' && { opacity: 0.4 }]}>
              <View style={styles.settingInfo}>
                <View style={styles.settingIconContainer}>
                  <Ionicons name="location" size={24} color={Colors.primary} />
                </View>
                <View style={styles.settingText}>
                  <Text style={styles.settingTitle}>Tracking GPS</Text>
                  <Text style={styles.settingDesc}>
                    {Platform.OS === 'web'
                      ? 'Téléchargez l\'application mobile pour utiliser le GPS'
                      : 'Détecte automatiquement votre pays actuel'}
                  </Text>
                </View>
              </View>
              <Switch
                value={Platform.OS === 'web' ? false : gpsEnabled}
                onValueChange={Platform.OS === 'web'
                  ? () => Alert.alert('Application mobile requise', 'Le tracking GPS n\'est pas disponible sur navigateur. Téléchargez l\'application mobile pour utiliser cette fonctionnalité.')
                  : toggleGpsTracking
                }
                trackColor={{ false: Colors.border.light, true: Colors.primary + '50' }}
                thumbColor={gpsEnabled ? Colors.primary : '#f4f3f4'}
                disabled={Platform.OS === 'web'}
              />
            </View>

            {gpsEnabled && (
              <>
                <View style={styles.settingDivider} />
                
                <View style={styles.settingInfoCard}>
                  <Ionicons name="shield-checkmark" size={20} color={Colors.success} />
                  <Text style={styles.settingInfoText}>
                    Vos données de localisation restent sur votre appareil et ne sont utilisées que pour le suivi fiscal.
                  </Text>
                </View>

                <View style={styles.permissionStatus}>
                  <Text style={styles.permissionLabel}>Statut permission :</Text>
                  <View style={[
                    styles.permissionBadge,
                    locationPermission === 'granted' ? styles.permissionGranted : styles.permissionDenied
                  ]}>
                    <Ionicons 
                      name={locationPermission === 'granted' ? 'checkmark-circle' : 'close-circle'} 
                      size={14} 
                      color="#fff" 
                    />
                    <Text style={styles.permissionBadgeText}>
                      {locationPermission === 'granted' ? 'Autorisé' : 'Non autorisé'}
                    </Text>
                  </View>
                </View>

                {locationPermission !== 'granted' && (
                  <TouchableOpacity
                    style={styles.requestPermissionBtn}
                    onPress={locationPermission === 'denied'
                      ? () => Linking.openSettings()
                      : requestLocationPermission
                    }
                  >
                    <Ionicons name="settings-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
                    <Text style={styles.requestPermissionBtnText}>
                      {locationPermission === 'denied' ? 'Ouvrir les Réglages' : 'Autoriser la localisation'}
                    </Text>
                  </TouchableOpacity>
                )}

                <View style={styles.settingDivider} />

                {/* Notification permission status */}
                <View style={styles.permissionStatus}>
                  <Text style={styles.permissionLabel}>Notifications :</Text>
                  <View style={[
                    styles.permissionBadge,
                    notifPermission === 'granted' ? styles.permissionGranted : styles.permissionDenied
                  ]}>
                    <Ionicons
                      name={notifPermission === 'granted' ? 'notifications' : 'notifications-off'}
                      size={14}
                      color="#fff"
                    />
                    <Text style={styles.permissionBadgeText}>
                      {notifPermission === 'granted' ? 'Activées' : 'Désactivées'}
                    </Text>
                  </View>
                </View>

                {notifPermission !== 'granted' && (
                  <TouchableOpacity
                    style={[styles.requestPermissionBtn, { backgroundColor: '#e67e22' }]}
                    onPress={async () => {
                      if (notifPermission === 'denied') {
                        Linking.openSettings();
                      } else {
                        const { status } = await Notifications.requestPermissionsAsync();
                        setNotifPermission(status === 'granted' ? 'granted' : 'denied');
                      }
                    }}
                  >
                    <Ionicons name="notifications-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
                    <Text style={styles.requestPermissionBtnText}>
                      {notifPermission === 'denied' ? 'Activer dans les Réglages' : 'Activer les notifications'}
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            <TouchableOpacity 
              style={styles.closeSettingsBtn}
              onPress={() => setShowSettings(false)}
            >
              <Text style={styles.closeSettingsBtnText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add Single Day Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Ajouter un jour</Text>
              <TouchableOpacity onPress={() => {
                setShowAddModal(false);
                // P2-11 FIX: Reset state when closing modal
                setNotes('');
                setShowNotesField(false);
                setSelectedCountry(null);
              }}>
                <Ionicons name="close" size={24} color={Colors.text.primary} />
              </TouchableOpacity>
            </View>

            {/* Quick GPS suggestion */}
            {currentLocation && !selectedCountry && (
              <TouchableOpacity 
                style={styles.gpsSuggestion}
                onPress={handleQuickAddFromGps}
              >
                <View style={styles.gpsSuggestionLeft}>
                  <Text style={styles.gpsSuggestionFlag}>
                    {countryFlags[currentLocation.countryCode] || '🌍'}
                  </Text>
                  <View>
                    <Text style={styles.gpsSuggestionCountry}>{currentLocation.country}</Text>
                    <Text style={styles.gpsSuggestionLabel}>Position actuelle</Text>
                  </View>
                </View>
                <Ionicons name="arrow-forward" size={20} color={Colors.primary} />
              </TouchableOpacity>
            )}

            <Text style={styles.inputLabel}>Pays</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.countrySelector}>
              {countries.map(country => (
                <TouchableOpacity
                  key={country.code}
                  style={[
                    styles.countryOption,
                    selectedCountry?.code === country.code && styles.countryOptionSelected,
                  ]}
                  onPress={() => setSelectedCountry(country)}
                >
                  <Text style={styles.countryOptionFlag}>
                    {countryFlags[country.code] || '🌍'}
                  </Text>
                  {/* P2-12 FIX: Afficher le nom complet du pays */}
                  <Text style={styles.countryOptionName}>{country.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.inputLabel}>Date</Text>
            <TouchableOpacity 
              style={styles.datePickerBtn}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={20} color={Colors.primary} />
              <Text style={styles.datePickerBtnText}>{formatDateDisplay(singleDate)}</Text>
              <Ionicons name="chevron-down" size={20} color={Colors.text.muted} />
            </TouchableOpacity>

            {/* iOS Date Picker */}
            {showDatePicker && Platform.OS === 'ios' && (
              <View style={styles.iosDatePickerContainer}>
                <View style={styles.iosDatePickerHeader}>
                  <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                    <Text style={styles.iosDatePickerCancel}>Annuler</Text>
                  </TouchableOpacity>
                  <Text style={styles.iosDatePickerTitle}>Sélectionner une date</Text>
                  <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                    <Text style={styles.iosDatePickerDone}>OK</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={singleDate}
                  mode="date"
                  display="spinner"
                  onChange={(event, date) => {
                    if (date) setSingleDate(date);
                  }}
                  maximumDate={new Date()}
                  themeVariant="dark"
                  textColor="#FFFFFF"
                  style={styles.iosDatePicker}
                />
              </View>
            )}

            {/* Android Date Picker */}
            {showDatePicker && Platform.OS === 'android' && (
              <DateTimePicker
                value={singleDate}
                mode="date"
                display="default"
                onChange={(event, date) => {
                  setShowDatePicker(false);
                  if (date) setSingleDate(date);
                }}
                maximumDate={new Date()}
              />
            )}

            {/* Collapsible Notes Field */}
            <TouchableOpacity 
              style={styles.notesToggle}
              onPress={() => setShowNotesField(!showNotesField)}
            >
              <Ionicons name="create-outline" size={18} color={Colors.text.secondary} />
              <Text style={styles.notesToggleText}>
                {notes ? notes : 'Ajouter une note (optionnel)'}
              </Text>
              <Ionicons 
                name={showNotesField ? "chevron-up" : "chevron-down"} 
                size={18} 
                color={Colors.text.muted} 
              />
            </TouchableOpacity>
            
            {showNotesField && (
              <TextInput
                style={styles.notesInput}
                value={notes}
                onChangeText={setNotes}
                placeholder="Ex: Tournoi, entraînement..."
                placeholderTextColor={Colors.text.muted}
                multiline
                numberOfLines={2}
                maxLength={200}
              />
            )}

            <TouchableOpacity
              style={[
                styles.submitBtn,
                !selectedCountry && styles.submitBtnDisabled,
              ]}
              onPress={handleAddDay}
              disabled={!selectedCountry || submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  <Text style={styles.submitBtnText}>Enregistrer</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add Bulk Days Modal */}
      <Modal visible={showBulkModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Ajouter un séjour</Text>
              <TouchableOpacity onPress={() => {
                setShowBulkModal(false);
                // P2-11 FIX: Reset state when closing modal
                setNotes('');
                setShowNotesField(false);
                setSelectedCountry(null);
                setBulkStartDate(new Date());
                setBulkEndDate(new Date());
              }}>
                <Ionicons name="close" size={24} color={Colors.text.primary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Pays</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.countrySelector}>
              {countries.map(country => (
                <TouchableOpacity
                  key={country.code}
                  style={[
                    styles.countryOption,
                    selectedCountry?.code === country.code && styles.countryOptionSelected,
                  ]}
                  onPress={() => setSelectedCountry(country)}
                >
                  <Text style={styles.countryOptionFlag}>
                    {countryFlags[country.code] || '🌍'}
                  </Text>
                  {/* P2-12 FIX: Afficher le nom complet du pays */}
                  <Text style={styles.countryOptionName}>{country.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.dateRow}>
              <View style={styles.dateField}>
                <Text style={styles.inputLabel}>Date début</Text>
                <TouchableOpacity 
                  style={styles.datePickerBtn}
                  onPress={() => setShowStartDatePicker(true)}
                >
                  <Ionicons name="calendar-outline" size={18} color={Colors.primary} />
                  <Text style={styles.datePickerBtnTextSmall}>{formatDateDisplay(bulkStartDate)}</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.dateField}>
                <Text style={styles.inputLabel}>Date fin</Text>
                <TouchableOpacity 
                  style={styles.datePickerBtn}
                  onPress={() => setShowEndDatePicker(true)}
                >
                  <Ionicons name="calendar-outline" size={18} color={Colors.primary} />
                  <Text style={styles.datePickerBtnTextSmall}>{formatDateDisplay(bulkEndDate)}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* iOS Date Picker - Start Date */}
            {showStartDatePicker && Platform.OS === 'ios' && (
              <View style={styles.iosDatePickerContainer}>
                <View style={styles.iosDatePickerHeader}>
                  <TouchableOpacity onPress={() => setShowStartDatePicker(false)}>
                    <Text style={styles.iosDatePickerCancel}>Annuler</Text>
                  </TouchableOpacity>
                  <Text style={styles.iosDatePickerTitle}>Date début</Text>
                  <TouchableOpacity onPress={() => setShowStartDatePicker(false)}>
                    <Text style={styles.iosDatePickerDone}>OK</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={bulkStartDate}
                  mode="date"
                  display="spinner"
                  onChange={(event, date) => {
                    if (date) setBulkStartDate(date);
                  }}
                  maximumDate={new Date()}  // P2-13 FIX: Limite date future
                  themeVariant="dark"
                  textColor="#FFFFFF"
                  style={styles.iosDatePicker}
                />
              </View>
            )}

            {/* Android Date Picker - Start Date */}
            {showStartDatePicker && Platform.OS === 'android' && (
              <DateTimePicker
                value={bulkStartDate}
                mode="date"
                display="default"
                onChange={(event, date) => {
                  setShowStartDatePicker(false);
                  if (date) setBulkStartDate(date);
                }}
                maximumDate={new Date()}  // P2-13 FIX: Limite date future
              />
            )}

            {/* iOS Date Picker - End Date */}
            {showEndDatePicker && Platform.OS === 'ios' && (
              <View style={styles.iosDatePickerContainer}>
                <View style={styles.iosDatePickerHeader}>
                  <TouchableOpacity onPress={() => setShowEndDatePicker(false)}>
                    <Text style={styles.iosDatePickerCancel}>Annuler</Text>
                  </TouchableOpacity>
                  <Text style={styles.iosDatePickerTitle}>Date fin</Text>
                  <TouchableOpacity onPress={() => setShowEndDatePicker(false)}>
                    <Text style={styles.iosDatePickerDone}>OK</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={bulkEndDate}
                  mode="date"
                  display="spinner"
                  onChange={(event, date) => {
                    if (date) setBulkEndDate(date);
                  }}
                  maximumDate={new Date()}  // P2-13 FIX: Limite date future
                  themeVariant="dark"
                  textColor="#FFFFFF"
                  style={styles.iosDatePicker}
                />
              </View>
            )}

            {/* Android Date Picker - End Date */}
            {showEndDatePicker && Platform.OS === 'android' && (
              <DateTimePicker
                value={bulkEndDate}
                mode="date"
                display="default"
                onChange={(event, date) => {
                  setShowEndDatePicker(false);
                  if (date) setBulkEndDate(date);
                }}
                maximumDate={new Date()}  // P2-13 FIX: Limite date future
              />
            )}

            {/* Duration indicator - Using correct inclusive calculation */}
            {bulkEndDate >= bulkStartDate && (
              <View style={styles.durationIndicator}>
                <Ionicons name="time-outline" size={16} color={Colors.primary} />
                <Text style={styles.durationText}>
                  {calculateDaysBetween(bulkStartDate, bulkEndDate)} jours
                </Text>
              </View>
            )}

            {/* Collapsible Notes Field */}
            <TouchableOpacity 
              style={styles.notesToggle}
              onPress={() => setShowNotesField(!showNotesField)}
            >
              <Ionicons name="create-outline" size={18} color={Colors.text.secondary} />
              <Text style={styles.notesToggleText}>
                {notes ? notes : 'Ajouter une note (optionnel)'}
              </Text>
              <Ionicons 
                name={showNotesField ? "chevron-up" : "chevron-down"} 
                size={18} 
                color={Colors.text.muted} 
              />
            </TouchableOpacity>
            
            {showNotesField && (
              <TextInput
                style={styles.notesInput}
                value={notes}
                onChangeText={setNotes}
                placeholder="Ex: Tournoi Open d'Australie"
                placeholderTextColor={Colors.text.muted}
                multiline
                numberOfLines={2}
                maxLength={200}
              />
            )}

            <TouchableOpacity
              style={[
                styles.submitBtn,
                !selectedCountry && styles.submitBtnDisabled,
              ]}
              onPress={handleAddBulkDays}
              disabled={!selectedCountry || submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="calendar-outline" size={20} color="#fff" />
                  <Text style={styles.submitBtnText}>Ajouter le séjour</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Country Detail Modal */}
      <Modal visible={showCountryDetail} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.countryDetailSheet}>
            <View style={styles.sheetHandle} />
            
            {/* Header */}
            <View style={styles.countryDetailHeader}>
              <View style={styles.countryDetailTitleRow}>
                <Text style={styles.countryDetailFlag}>
                  {selectedCountryStats ? countryFlags[selectedCountryStats.country] || '🌍' : '🌍'}
                </Text>
                <View>
                  <Text style={styles.countryDetailTitle}>
                    {selectedCountryStats?.countryName || 'Pays'}
                  </Text>
                  <Text style={styles.countryDetailSubtitle}>
                    {selectedCountryStats?.totalDays || 0} jours en {currentYear}
                  </Text>
                </View>
              </View>
              <TouchableOpacity 
                style={styles.countryDetailClose}
                onPress={() => {
                  setShowCountryDetail(false);
                  setSelectedCountryStats(null);
                  setCountryDays([]);
                }}
              >
                <Ionicons name="close" size={24} color={Colors.text.primary} />
              </TouchableOpacity>
            </View>

            {/* Days List */}
            {loadingDays ? (
              <View style={styles.countryDetailLoading}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.countryDetailLoadingText}>Chargement...</Text>
              </View>
            ) : countryDays.length > 0 ? (
              <ScrollView style={styles.daysList} showsVerticalScrollIndicator={false}>
                <Text style={styles.daysListTitle}>
                  {countryDays.length} jour{countryDays.length > 1 ? 's' : ''} enregistré{countryDays.length > 1 ? 's' : ''}
                </Text>
                
                {countryDays.map((day) => (
                  <View key={day.id} style={styles.dayItem}>
                    <View style={styles.dayItemLeft}>
                      <Text style={styles.dayItemDate}>
                        {new Date(day.date).toLocaleDateString('fr-FR', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </Text>
                      {day.notes && (
                        <Text style={styles.dayItemNotes}>{day.notes}</Text>
                      )}
                      <View style={styles.dayItemStatus}>
                        <Ionicons 
                          name={day.status === 'confirmed' ? 'location' : 'create-outline'} 
                          size={12} 
                          color={day.status === 'confirmed' ? Colors.success : Colors.text.muted} 
                        />
                        <Text style={[
                          styles.dayItemStatusText,
                          { color: day.status === 'confirmed' ? Colors.success : Colors.text.muted }
                        ]}>
                          {day.status === 'confirmed' ? 'GPS' : 'Manuel'}
                        </Text>
                      </View>
                    </View>
                    
                    <View style={styles.dayItemActions}>
                      <TouchableOpacity
                        style={styles.dayItemEdit}
                        onPress={() => handleEditDay(day)}
                      >
                        <Ionicons name="pencil" size={18} color={Colors.primary} />
                      </TouchableOpacity>
                      
                      <TouchableOpacity
                        style={styles.dayItemDelete}
                        onPress={() => handleDeleteDay(day.date)}
                        disabled={deletingDay === day.date}
                      >
                        {deletingDay === day.date ? (
                          <ActivityIndicator size="small" color={Colors.danger} />
                        ) : (
                          <Ionicons name="trash-outline" size={20} color={Colors.danger} />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
                
                <View style={{ height: 40 }} />
              </ScrollView>
            ) : (
              <View style={styles.noDaysMessage}>
                <Ionicons name="calendar-outline" size={48} color={Colors.text.muted} />
                <Text style={styles.noDaysText}>Aucun jour enregistré</Text>
              </View>
            )}

            {/* Add more days button */}
            <View style={styles.countryDetailActions}>
              <TouchableOpacity
                style={styles.addMoreDaysBtn}
                onPress={() => {
                  setShowCountryDetail(false);
                  if (selectedCountryStats) {
                    const country = countries.find(c => c.code === selectedCountryStats.country);
                    if (country) {
                      setSelectedCountry(country);
                      setShowBulkModal(true);
                    }
                  }
                }}
              >
                <Ionicons name="add-circle" size={20} color="#fff" />
                <Text style={styles.addMoreDaysBtnText}>Ajouter des jours</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Day Modal */}
      <Modal visible={showEditModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Modifier le jour</Text>
              <TouchableOpacity onPress={() => {
                setShowEditModal(false);
                setEditingDay(null);
                setEditCountry(null);
                setEditNotes('');
              }}>
                <Ionicons name="close" size={24} color={Colors.text.primary} />
              </TouchableOpacity>
            </View>

            {editingDay && (
              <>
                {/* Date display (read-only) */}
                <View style={styles.editDateDisplay}>
                  <Ionicons name="calendar" size={20} color={Colors.primary} />
                  <Text style={styles.editDateText}>
                    {new Date(editingDay.date).toLocaleDateString('fr-FR', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </Text>
                </View>

                <Text style={styles.inputLabel}>Pays</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.countrySelector}>
                  {countries.map(country => (
                    <TouchableOpacity
                      key={country.code}
                      style={[
                        styles.countryOption,
                        editCountry?.code === country.code && styles.countryOptionSelected,
                      ]}
                      onPress={() => setEditCountry(country)}
                    >
                      <Text style={styles.countryOptionFlag}>
                        {countryFlags[country.code] || '🌍'}
                      </Text>
                      {/* P2-12 FIX: Afficher le nom complet du pays */}
                  <Text style={styles.countryOptionName}>{country.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={styles.inputLabel}>Notes (optionnel)</Text>
                <TextInput
                  style={[styles.input, styles.editNotesInput]}
                  value={editNotes}
                  onChangeText={setEditNotes}
                  placeholder="Ex: Tournoi, entraînement..."
                  placeholderTextColor={Colors.text.muted}
                  multiline
                  numberOfLines={2}
                  maxLength={200}
                />

                <TouchableOpacity
                  style={[
                    styles.submitBtn,
                    (!editCountry || savingEdit) && styles.submitBtnDisabled,
                  ]}
                  onPress={handleSaveEdit}
                  disabled={!editCountry || savingEdit}
                >
                  {savingEdit ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={20} color="#fff" />
                      <Text style={styles.submitBtnText}>Enregistrer les modifications</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.secondary,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.text.secondary,
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: Colors.primary,
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
  // Header
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingsBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
  },
  totalBadgeNumber: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  totalBadgeLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.9)',
  },
  // GPS Card
  gpsCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  gpsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  gpsStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  gpsIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.text.muted,
  },
  gpsIndicatorActive: {
    backgroundColor: Colors.success,
  },
  gpsStatusText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  refreshLocationBtn: {
    padding: 8,
  },
  currentLocationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  currentLocationFlag: {
    fontSize: 36,
  },
  currentLocationText: {
    flex: 1,
  },
  currentLocationCountry: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  currentLocationCity: {
    fontSize: 13,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  logTodayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.success,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
  },
  logTodayBtnDisabled: {
    backgroundColor: Colors.text.muted,
  },
  logTodayBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  locatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  locatingText: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  enableGpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: Colors.primary + '10',
    borderRadius: 8,
  },
  enableGpsBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  // Warnings
  warningsContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    gap: 10,
  },
  warningCritical: {
    backgroundColor: Colors.danger + '15',
    borderLeftWidth: 4,
    borderLeftColor: Colors.danger,
  },
  warningNormal: {
    backgroundColor: Colors.warning + '15',
    borderLeftWidth: 4,
    borderLeftColor: Colors.warning,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: Colors.text.primary,
    lineHeight: 18,
  },
  // Stats row
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.primary,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.text.secondary,
    marginTop: 2,
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.border.light,
    marginVertical: 4,
  },
  // Content
  content: {
    flex: 1,
    marginTop: 16,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  bulkBtn: {
    backgroundColor: '#764ba2',
  },
  addBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  // Country cards
  countryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  countryCardWarning: {
    borderWidth: 2,
    borderColor: Colors.warning + '50',
    backgroundColor: Colors.warning + '05',
  },
  countryCardCritical: {
    borderWidth: 2,
    borderColor: Colors.danger + '50',
    backgroundColor: Colors.danger + '05',
  },
  alertBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: Colors.danger,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  alertBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  countryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  countryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  countryFlag: {
    fontSize: 32,
  },
  countryName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  countryCode: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  daysContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  daysCount: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  daysCountCritical: {
    color: Colors.danger,
  },
  daysLimit: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginLeft: 2,
  },
  progressContainer: {
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: Colors.background.tertiary,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  percentText: {
    fontSize: 12,
    fontWeight: '600',
  },
  remainingText: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  streakInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
  },
  streakText: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  enableGpsEmptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    marginTop: 20,
  },
  enableGpsEmptyBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  // Info card
  infoCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(29, 161, 242, 0.1)',
    borderRadius: 10,
    padding: 12,
    gap: 10,
    marginTop: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: Colors.text.secondary,
    lineHeight: 18,
  },
  // Settings Modal
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 14,
  },
  settingIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  settingDesc: {
    fontSize: 13,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  settingDivider: {
    height: 1,
    backgroundColor: Colors.border.light,
  },
  settingInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.success + '10',
    padding: 12,
    borderRadius: 10,
    marginTop: 16,
  },
  settingInfoText: {
    flex: 1,
    fontSize: 13,
    color: Colors.text.secondary,
    lineHeight: 18,
  },
  permissionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  permissionLabel: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  permissionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  permissionGranted: {
    backgroundColor: Colors.success,
  },
  permissionDenied: {
    backgroundColor: Colors.danger,
  },
  permissionBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  requestPermissionBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  requestPermissionBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  closeSettingsBtn: {
    backgroundColor: Colors.background.secondary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  closeSettingsBtnText: {
    color: Colors.text.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  // GPS Suggestion
  gpsSuggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.primary + '10',
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
  },
  gpsSuggestionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  gpsSuggestionFlag: {
    fontSize: 28,
  },
  gpsSuggestionCountry: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  gpsSuggestionLabel: {
    fontSize: 12,
    color: Colors.primary,
    marginTop: 2,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.secondary,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: Colors.background.secondary,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: Colors.text.primary,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  countrySelector: {
    marginBottom: 8,
  },
  countryOption: {
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    backgroundColor: Colors.background.secondary,
    marginRight: 8,
    borderWidth: 2,
    borderColor: 'transparent',
    minWidth: 60,
  },
  countryOptionSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '10',
  },
  countryOptionFlag: {
    fontSize: 28,
  },
  countryOptionCode: {
    fontSize: 11,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  // P2-12 FIX: Style pour le nom complet du pays
  countryOptionName: {
    fontSize: 11,
    color: Colors.text.secondary,
    marginTop: 2,
    textAlign: 'center',
    maxWidth: 80,
  },
  // Date picker
  datePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.background.secondary,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  datePickerBtnText: {
    flex: 1,
    fontSize: 16,
    color: Colors.text.primary,
  },
  datePickerBtnTextSmall: {
    flex: 1,
    fontSize: 14,
    color: Colors.text.primary,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dateField: {
    flex: 1,
  },
  durationIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.primary + '10',
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 12,
  },
  durationText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  // iOS DatePicker styles - DARK THEME for visibility
  iosDatePickerContainer: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    marginTop: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#333333',
  },
  iosDatePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
    backgroundColor: '#2A2A2A',
  },
  iosDatePickerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  iosDatePickerCancel: {
    fontSize: 15,
    color: '#FF6B6B',
  },
  iosDatePickerDone: {
    fontSize: 15,
    fontWeight: '600',
    color: '#10B981',
  },
  iosDatePicker: {
    height: 180,
    backgroundColor: '#1A1A1A',
  },
  // Notes field - Collapsible
  notesToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.background.secondary,
    padding: 14,
    borderRadius: 10,
    marginTop: 16,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  notesToggleText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text.secondary,
  },
  notesInput: {
    backgroundColor: Colors.background.secondary,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: Colors.text.primary,
    marginTop: 8,
    minHeight: 60,
    maxHeight: 100,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 20,
    marginBottom: Platform.OS === 'ios' ? 20 : 0,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Tap hint on country card
  tapHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
  },
  tapHintText: {
    fontSize: 12,
    color: Colors.text.muted,
  },
  // Country Detail Modal
  countryDetailSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    minHeight: '50%',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.border.light,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  countryDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  countryDetailTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  countryDetailFlag: {
    fontSize: 40,
  },
  countryDetailTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  countryDetailSubtitle: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  countryDetailClose: {
    padding: 8,
  },
  countryDetailLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  countryDetailLoadingText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.text.secondary,
  },
  daysList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  daysListTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.secondary,
    marginTop: 16,
    marginBottom: 12,
  },
  dayItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.background.secondary,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  dayItemLeft: {
    flex: 1,
  },
  dayItemDate: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  dayItemNotes: {
    fontSize: 13,
    color: Colors.text.secondary,
    marginTop: 4,
    fontStyle: 'italic',
  },
  dayItemStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  dayItemStatusText: {
    fontSize: 11,
    fontWeight: '500',
  },
  dayItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dayItemEdit: {
    padding: 10,
  },
  dayItemDelete: {
    padding: 10,
  },
  // Edit Modal
  editDateDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.primary + '10',
    padding: 14,
    borderRadius: 10,
    marginBottom: 16,
  },
  editDateText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    textTransform: 'capitalize',
  },
  editNotesInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  noDaysMessage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  noDaysText: {
    fontSize: 16,
    color: Colors.text.muted,
    marginTop: 12,
  },
  countryDetailActions: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
  },
  addMoreDaysBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
  },
  addMoreDaysBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  webUnavailableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  webUnavailableText: {
    fontSize: 13,
    color: '#9CA3AF',
    fontStyle: 'italic',
    flex: 1,
  },
});
