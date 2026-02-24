import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import Colors from '../../src/constants/colors';
import { useApp } from '../../src/context/AppContext';
import { CountryDays } from '../../src/types';

const TAX_LIMIT = 183;
const STORAGE_KEY_ONBOARDING = '@central_court_fiscal_onboarding';
const STORAGE_KEY_RESIDENCE = '@central_court_fiscal_residence';
const STORAGE_KEY_LOCATION_ENABLED = '@central_court_location_enabled';

interface FiscalOnboarding {
  completed: boolean;
  residenceCountry: {
    country: string;
    countryCode: string;
    flag: string;
  } | null;
  locationEnabled: boolean;
}

const availableCountries = [
  { flag: '🇲🇨', code: 'MC', name: 'Monaco', taxInfo: 'Pas d\'impôt sur le revenu' },
  { flag: '🇦🇪', code: 'AE', name: 'Émirats Arabes Unis', taxInfo: 'Pas d\'impôt sur le revenu' },
  { flag: '🇨🇭', code: 'CH', name: 'Suisse', taxInfo: 'Forfait fiscal possible' },
  { flag: '🇪🇸', code: 'ES', name: 'Espagne', taxInfo: 'Régime Beckham disponible' },
  { flag: '🇫🇷', code: 'FR', name: 'France', taxInfo: 'Imposition progressive' },
  { flag: '🇬🇧', code: 'GB', name: 'Royaume-Uni', taxInfo: 'Régime résident non-domicilié' },
  { flag: '🇺🇸', code: 'US', name: 'États-Unis', taxInfo: 'Imposition mondiale' },
  { flag: '🇮🇹', code: 'IT', name: 'Italie', taxInfo: 'Régime forfaitaire possible' },
  { flag: '🇵🇹', code: 'PT', name: 'Portugal', taxInfo: 'Régime NHR disponible' },
  { flag: '🇧🇪', code: 'BE', name: 'Belgique', taxInfo: 'Pas de plus-values mobilières' },
];

export default function FiscalityScreen() {
  const insets = useSafeAreaInsets();
  const { taxHistory, currentYear, updateCountryDays, addCountry, setTaxHistory } = useApp();
  
  // Onboarding state
  const [onboardingStep, setOnboardingStep] = useState<'loading' | 'residence' | 'location' | 'complete'>('loading');
  const [selectedResidence, setSelectedResidence] = useState<typeof availableCountries[0] | null>(null);
  const [locationStatus, setLocationStatus] = useState<'pending' | 'granted' | 'denied'>('pending');
  const [isTrackingLocation, setIsTrackingLocation] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<string | null>(null);
  
  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<CountryDays | null>(null);
  const [newCountry, setNewCountry] = useState({
    country: '',
    countryCode: '',
    flag: '',
    days: '0',
  });
  const [editDays, setEditDays] = useState('');

  // Load onboarding state on mount
  useEffect(() => {
    loadOnboardingState();
  }, []);

  const loadOnboardingState = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY_ONBOARDING);
      if (stored) {
        const data: FiscalOnboarding = JSON.parse(stored);
        if (data.completed) {
          setOnboardingStep('complete');
          if (data.residenceCountry) {
            setSelectedResidence({
              flag: data.residenceCountry.flag,
              code: data.residenceCountry.countryCode,
              name: data.residenceCountry.country,
              taxInfo: ''
            });
          }
          if (data.locationEnabled) {
            checkLocationPermission();
          }
        } else {
          setOnboardingStep('residence');
        }
      } else {
        setOnboardingStep('residence');
      }
    } catch (error) {
      console.error('Error loading onboarding:', error);
      setOnboardingStep('residence');
    }
  };

  const saveOnboardingState = async (data: Partial<FiscalOnboarding>) => {
    try {
      const existing = await AsyncStorage.getItem(STORAGE_KEY_ONBOARDING);
      const current: FiscalOnboarding = existing ? JSON.parse(existing) : {
        completed: false,
        residenceCountry: null,
        locationEnabled: false
      };
      const updated = { ...current, ...data };
      await AsyncStorage.setItem(STORAGE_KEY_ONBOARDING, JSON.stringify(updated));
    } catch (error) {
      console.error('Error saving onboarding:', error);
    }
  };

  const handleSelectResidence = (country: typeof availableCountries[0]) => {
    setSelectedResidence(country);
  };

  const handleConfirmResidence = async () => {
    if (!selectedResidence) return;
    
    await saveOnboardingState({
      residenceCountry: {
        country: selectedResidence.name,
        countryCode: selectedResidence.code,
        flag: selectedResidence.flag
      }
    });
    
    // Initialize tax history with residence country
    const residenceEntry: CountryDays = {
      country: selectedResidence.name,
      countryCode: selectedResidence.code,
      flag: selectedResidence.flag,
      days: 0,
      limit: TAX_LIMIT,
      isResidence: true,
    };
    
    // Reset tax history with just the residence
    if (setTaxHistory) {
      setTaxHistory([residenceEntry]);
    }
    
    setOnboardingStep('location');
  };

  const checkLocationPermission = async () => {
    const { status } = await Location.getForegroundPermissionsAsync();
    setLocationStatus(status === 'granted' ? 'granted' : 'denied');
    if (status === 'granted') {
      getCurrentCountry();
    }
  };

  const requestLocationPermission = async () => {
    setIsTrackingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setLocationStatus('granted');
        await saveOnboardingState({ locationEnabled: true });
        await getCurrentCountry();
      } else {
        setLocationStatus('denied');
      }
    } catch (error) {
      console.error('Error requesting location:', error);
      setLocationStatus('denied');
    } finally {
      setIsTrackingLocation(false);
    }
  };

  const getCurrentCountry = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({});
      const [geocode] = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      });
      if (geocode?.country) {
        setCurrentLocation(geocode.country);
      }
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  const handleSkipLocation = async () => {
    await saveOnboardingState({ completed: true, locationEnabled: false });
    setOnboardingStep('complete');
  };

  const handleEnableLocation = async () => {
    await requestLocationPermission();
    await saveOnboardingState({ completed: true, locationEnabled: locationStatus === 'granted' });
    setOnboardingStep('complete');
  };

  // Stats
  const stats = useMemo(() => {
    const totalDays = taxHistory.reduce((sum, c) => sum + c.days, 0);
    const countriesVisited = taxHistory.length;
    const residenceCountry = taxHistory.find(c => (c as any).isResidence);
    const daysInResidence = residenceCountry?.days || 0;
    const daysNeeded = Math.max(0, TAX_LIMIT - daysInResidence);
    return { totalDays, countriesVisited, daysInResidence, daysNeeded };
  }, [taxHistory]);

  // Sort countries by days (descending)
  const sortedCountries = useMemo(() => {
    return [...taxHistory].sort((a, b) => {
      // Residence country always first
      if ((a as any).isResidence) return -1;
      if ((b as any).isResidence) return 1;
      return b.days - a.days;
    });
  }, [taxHistory]);

  const getProgressColor = (days: number, limit: number, isResidence: boolean): string => {
    const percentage = (days / limit) * 100;
    if (isResidence) {
      // For residence: green when approaching limit (good)
      if (percentage >= 80) return Colors.success;
      if (percentage >= 50) return Colors.primary;
      return Colors.warning;
    } else {
      // For other countries: red when approaching limit (bad)
      if (percentage >= 95) return Colors.danger;
      if (percentage >= 80) return Colors.warning;
      return Colors.success;
    }
  };

  const getStatusText = (days: number, limit: number, isResidence: boolean): string => {
    const remaining = limit - days;
    if (isResidence) {
      if (days >= limit) return '✓ Objectif atteint !';
      if (remaining <= 30) return `Plus que ${remaining}j pour l'objectif`;
      return `${remaining}j restants pour être résident`;
    } else {
      if (remaining <= 0) return 'Limite atteinte !';
      if (remaining <= 8) return `Attention: ${remaining}j restants`;
      if (remaining <= 33) return `Vigilance: ${remaining}j restants`;
      return `${remaining}j restants`;
    }
  };

  const handleEditCountry = (country: CountryDays) => {
    setSelectedCountry(country);
    setEditDays(country.days.toString());
    setShowEditModal(true);
  };

  const handleSaveEdit = () => {
    if (!selectedCountry) return;
    const days = parseInt(editDays) || 0;
    updateCountryDays(selectedCountry.countryCode, days);
    setShowEditModal(false);
    setSelectedCountry(null);
  };

  const handleAddCountry = () => {
    if (!newCountry.country || !newCountry.countryCode || !newCountry.flag) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }

    const country: CountryDays = {
      country: newCountry.country,
      countryCode: newCountry.countryCode.toUpperCase(),
      flag: newCountry.flag,
      days: parseInt(newCountry.days) || 0,
      limit: TAX_LIMIT,
    };

    addCountry(country);
    setShowAddModal(false);
    setNewCountry({ country: '', countryCode: '', flag: '', days: '0' });
  };

  const commonFlags = [
    { flag: '🇫🇷', code: 'FR', name: 'France' },
    { flag: '🇪🇸', code: 'ES', name: 'Espagne' },
    { flag: '🇺🇸', code: 'US', name: 'États-Unis' },
    { flag: '🇬🇧', code: 'GB', name: 'Royaume-Uni' },
    { flag: '🇩🇪', code: 'DE', name: 'Allemagne' },
    { flag: '🇮🇹', code: 'IT', name: 'Italie' },
    { flag: '🇦🇺', code: 'AU', name: 'Australie' },
    { flag: '🇦🇪', code: 'AE', name: 'Émirats' },
    { flag: '🇲🇨', code: 'MC', name: 'Monaco' },
    { flag: '🇨🇭', code: 'CH', name: 'Suisse' },
  ];

  // LOADING STATE
  if (onboardingStep === 'loading') {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  // ONBOARDING STEP 1: Choose residence country
  if (onboardingStep === 'residence') {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          style={[styles.onboardingHeader, { paddingTop: insets.top + 20 }]}
        >
          <View style={styles.onboardingIconContainer}>
            <Ionicons name="globe-outline" size={48} color="#fff" />
          </View>
          <Text style={styles.onboardingTitle}>Configuration fiscale</Text>
          <Text style={styles.onboardingSubtitle}>
            Choisissez le pays où vous souhaitez établir votre résidence fiscale
          </Text>
        </LinearGradient>

        <ScrollView 
          style={styles.onboardingContent}
          contentContainerStyle={styles.onboardingContentContainer}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.onboardingInstruction}>
            La règle des 183 jours : vous devez passer au moins 183 jours par an dans un pays pour y être résident fiscal.
          </Text>

          {availableCountries.map(country => (
            <TouchableOpacity
              key={country.code}
              style={[
                styles.residenceOption,
                selectedResidence?.code === country.code && styles.residenceOptionSelected
              ]}
              onPress={() => handleSelectResidence(country)}
            >
              <Text style={styles.residenceFlag}>{country.flag}</Text>
              <View style={styles.residenceInfo}>
                <Text style={styles.residenceName}>{country.name}</Text>
                <Text style={styles.residenceTaxInfo}>{country.taxInfo}</Text>
              </View>
              {selectedResidence?.code === country.code && (
                <View style={styles.selectedCheck}>
                  <Ionicons name="checkmark-circle" size={24} color={Colors.success} />
                </View>
              )}
            </TouchableOpacity>
          ))}

          <View style={{ height: 100 }} />
        </ScrollView>

        <View style={[styles.onboardingFooter, { paddingBottom: insets.bottom + 16 }]}>
          <TouchableOpacity
            style={[styles.onboardingBtn, !selectedResidence && styles.onboardingBtnDisabled]}
            onPress={handleConfirmResidence}
            disabled={!selectedResidence}
          >
            <Text style={styles.onboardingBtnText}>Continuer</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ONBOARDING STEP 2: Location permission
  if (onboardingStep === 'location') {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#11998e', '#38ef7d']}
          style={[styles.onboardingHeader, { paddingTop: insets.top + 20 }]}
        >
          <View style={styles.onboardingIconContainer}>
            <Ionicons name="location-outline" size={48} color="#fff" />
          </View>
          <Text style={styles.onboardingTitle}>Géolocalisation</Text>
          <Text style={styles.onboardingSubtitle}>
            Facilitez le suivi de vos jours avec la localisation automatique
          </Text>
        </LinearGradient>

        <View style={styles.locationContent}>
          <View style={styles.residenceChosen}>
            <Text style={styles.residenceChosenLabel}>Résidence fiscale choisie</Text>
            <View style={styles.residenceChosenCard}>
              <Text style={styles.residenceChosenFlag}>{selectedResidence?.flag}</Text>
              <Text style={styles.residenceChosenName}>{selectedResidence?.name}</Text>
            </View>
          </View>

          <View style={styles.locationBenefits}>
            <Text style={styles.locationBenefitsTitle}>Avantages de la géolocalisation</Text>
            
            <View style={styles.benefitItem}>
              <View style={[styles.benefitIcon, { backgroundColor: '#4CAF50' + '20' }]}>
                <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
              </View>
              <View style={styles.benefitText}>
                <Text style={styles.benefitTitle}>Comptage automatique</Text>
                <Text style={styles.benefitDesc}>Vos jours sont comptés automatiquement</Text>
              </View>
            </View>

            <View style={styles.benefitItem}>
              <View style={[styles.benefitIcon, { backgroundColor: Colors.primary + '20' }]}>
                <Ionicons name="notifications" size={24} color={Colors.primary} />
              </View>
              <View style={styles.benefitText}>
                <Text style={styles.benefitTitle}>Alertes intelligentes</Text>
                <Text style={styles.benefitDesc}>Soyez prévenu quand vous approchez des limites</Text>
              </View>
            </View>

            <View style={styles.benefitItem}>
              <View style={[styles.benefitIcon, { backgroundColor: Colors.warning + '20' }]}>
                <Ionicons name="shield-checkmark" size={24} color={Colors.warning} />
              </View>
              <View style={styles.benefitText}>
                <Text style={styles.benefitTitle}>Données sécurisées</Text>
                <Text style={styles.benefitDesc}>Vos données restent sur votre appareil</Text>
              </View>
            </View>
          </View>

          {isTrackingLocation && (
            <View style={styles.locationLoading}>
              <ActivityIndicator color={Colors.primary} />
              <Text style={styles.locationLoadingText}>Demande d'autorisation...</Text>
            </View>
          )}
        </View>

        <View style={[styles.onboardingFooter, { paddingBottom: insets.bottom + 16 }]}>
          <TouchableOpacity
            style={styles.onboardingBtnSecondary}
            onPress={handleSkipLocation}
          >
            <Text style={styles.onboardingBtnSecondaryText}>Pas maintenant</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.onboardingBtn}
            onPress={handleEnableLocation}
            disabled={isTrackingLocation}
          >
            <Ionicons name="location" size={20} color="#fff" />
            <Text style={styles.onboardingBtnText}>Activer la localisation</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // MAIN SCREEN (onboardingStep === 'complete')
  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#f093fb', '#f5576c']}
        style={[styles.header, { paddingTop: insets.top + 16 }]}
      >
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>Fiscalité {currentYear}</Text>
            <Text style={styles.headerSubtitle}>
              {selectedResidence ? `Objectif: ${selectedResidence.name}` : 'Règle des 183 jours'}
            </Text>
          </View>
          <View style={styles.headerRight}>
            {locationStatus === 'granted' && (
              <View style={styles.locationBadge}>
                <Ionicons name="location" size={14} color="#fff" />
                <Text style={styles.locationBadgeText}>GPS actif</Text>
              </View>
            )}
          </View>
        </View>
      </LinearGradient>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{stats.totalDays}</Text>
          <Text style={styles.statLabel}>Jours total</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: Colors.success }]}>{stats.daysInResidence}</Text>
          <Text style={styles.statLabel}>En résidence</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, stats.daysNeeded > 100 ? { color: Colors.warning } : { color: Colors.success }]}>
            {stats.daysNeeded}
          </Text>
          <Text style={styles.statLabel}>Jours requis</Text>
        </View>
      </View>

      {/* Current Location */}
      {currentLocation && (
        <View style={styles.currentLocationCard}>
          <Ionicons name="navigate" size={18} color={Colors.primary} />
          <Text style={styles.currentLocationText}>
            Position actuelle : <Text style={styles.currentLocationCountry}>{currentLocation}</Text>
          </Text>
        </View>
      )}

      {/* Info Card */}
      <View style={styles.infoCard}>
        <Ionicons name="information-circle" size={20} color={Colors.primary} />
        <Text style={styles.infoText}>
          Pour être résident fiscal {selectedResidence ? `en ${selectedResidence.name}` : ''}, 
          vous devez y passer au moins 183 jours par an.
        </Text>
      </View>

      {/* Country List */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Jours par pays</Text>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setShowAddModal(true)}
          >
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.addBtnText}>Ajouter</Text>
          </TouchableOpacity>
        </View>

        {sortedCountries.map(country => {
          const isResidence = (country as any).isResidence;
          const progressPercent = Math.min((country.days / country.limit) * 100, 100);
          const progressColor = getProgressColor(country.days, country.limit, isResidence);
          const statusText = getStatusText(country.days, country.limit, isResidence);

          return (
            <TouchableOpacity
              key={country.countryCode}
              style={[
                styles.countryCard,
                isResidence && styles.countryCardResidence
              ]}
              onPress={() => handleEditCountry(country)}
            >
              {isResidence && (
                <View style={styles.residenceBadge}>
                  <Ionicons name="home" size={12} color={Colors.success} />
                  <Text style={styles.residenceBadgeText}>Résidence fiscale</Text>
                </View>
              )}
              
              <View style={styles.countryHeader}>
                <View style={styles.countryInfo}>
                  <Text style={styles.countryFlag}>{country.flag}</Text>
                  <View>
                    <Text style={styles.countryName}>{country.country}</Text>
                    <Text style={styles.countryCode}>{country.countryCode}</Text>
                  </View>
                </View>
                <View style={styles.daysContainer}>
                  <Text style={[styles.daysCount, isResidence && styles.daysCountResidence]}>
                    {country.days}
                  </Text>
                  <Text style={styles.daysLimit}>/ {country.limit}j</Text>
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
                <Text style={[styles.statusText, { color: progressColor }]}>
                  {statusText}
                </Text>
              </View>

              <View style={styles.editHint}>
                <Ionicons name="create-outline" size={14} color={Colors.text.muted} />
                <Text style={styles.editHintText}>Appuyer pour modifier</Text>
              </View>
            </TouchableOpacity>
          );
        })}

        {/* Location Status Note */}
        <View style={styles.noteCard}>
          <Ionicons 
            name={locationStatus === 'granted' ? 'location' : 'hand-left-outline'} 
            size={20} 
            color={locationStatus === 'granted' ? Colors.success : Colors.text.secondary} 
          />
          <View style={styles.noteContent}>
            <Text style={styles.noteTitle}>
              {locationStatus === 'granted' ? 'Tracking GPS actif' : 'Saisie manuelle'}
            </Text>
            <Text style={styles.noteText}>
              {locationStatus === 'granted' 
                ? 'Vos déplacements sont suivis automatiquement pour le comptage des jours.'
                : 'Ajoutez vos jours manuellement. Activez le GPS pour un suivi automatique.'}
            </Text>
            {locationStatus !== 'granted' && (
              <TouchableOpacity 
                style={styles.enableLocationBtn}
                onPress={requestLocationPermission}
              >
                <Ionicons name="location-outline" size={16} color={Colors.primary} />
                <Text style={styles.enableLocationBtnText}>Activer le GPS</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={showEditModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Modifier les jours</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Ionicons name="close" size={24} color={Colors.text.primary} />
              </TouchableOpacity>
            </View>

            {selectedCountry && (
              <View style={styles.editCountryInfo}>
                <Text style={styles.editCountryFlag}>{selectedCountry.flag}</Text>
                <Text style={styles.editCountryName}>{selectedCountry.country}</Text>
              </View>
            )}

            <Text style={styles.inputLabel}>Nombre de jours</Text>
            <TextInput
              style={styles.input}
              value={editDays}
              onChangeText={setEditDays}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={Colors.text.muted}
            />

            <View style={styles.quickButtons}>
              {[1, 5, 7, 14, 30].map(num => (
                <TouchableOpacity
                  key={num}
                  style={styles.quickBtn}
                  onPress={() => setEditDays(String((parseInt(editDays) || 0) + num))}
                >
                  <Text style={styles.quickBtnText}>+{num}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.submitBtn} onPress={handleSaveEdit}>
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.submitBtnText}>Enregistrer</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add Country Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Ajouter un pays</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color={Colors.text.primary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Sélection rapide</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.flagSelector}>
              {commonFlags.map(item => (
                <TouchableOpacity
                  key={item.code}
                  style={[
                    styles.flagOption,
                    newCountry.countryCode === item.code && styles.flagOptionSelected
                  ]}
                  onPress={() => setNewCountry({
                    ...newCountry,
                    country: item.name,
                    countryCode: item.code,
                    flag: item.flag,
                  })}
                >
                  <Text style={styles.flagEmoji}>{item.flag}</Text>
                  <Text style={styles.flagCode}>{item.code}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.inputLabel}>Nom du pays</Text>
            <TextInput
              style={styles.input}
              value={newCountry.country}
              onChangeText={country => setNewCountry({ ...newCountry, country })}
              placeholder="Ex: France"
              placeholderTextColor={Colors.text.muted}
            />

            <Text style={styles.inputLabel}>Jours passés</Text>
            <TextInput
              style={styles.input}
              value={newCountry.days}
              onChangeText={days => setNewCountry({ ...newCountry, days })}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={Colors.text.muted}
            />

            <TouchableOpacity
              style={[
                styles.submitBtn,
                (!newCountry.country || !newCountry.countryCode || !newCountry.flag) && styles.submitBtnDisabled
              ]}
              onPress={handleAddCountry}
              disabled={!newCountry.country || !newCountry.countryCode || !newCountry.flag}
            >
              <Ionicons name="add-circle" size={20} color="#fff" />
              <Text style={styles.submitBtnText}>Ajouter le pays</Text>
            </TouchableOpacity>
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
  // Onboarding styles
  onboardingHeader: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    alignItems: 'center',
  },
  onboardingIconContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  onboardingTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  onboardingSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  onboardingContent: {
    flex: 1,
  },
  onboardingContentContainer: {
    padding: 20,
  },
  onboardingInstruction: {
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 20,
    marginBottom: 20,
    backgroundColor: Colors.background.primary,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  residenceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  residenceOptionSelected: {
    borderColor: Colors.success,
    backgroundColor: Colors.success + '08',
  },
  residenceFlag: {
    fontSize: 36,
    marginRight: 14,
  },
  residenceInfo: {
    flex: 1,
  },
  residenceName: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  residenceTaxInfo: {
    fontSize: 13,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  selectedCheck: {
    marginLeft: 10,
  },
  onboardingFooter: {
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
    gap: 12,
  },
  onboardingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
  },
  onboardingBtnDisabled: {
    opacity: 0.5,
  },
  onboardingBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  onboardingBtnSecondary: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  onboardingBtnSecondaryText: {
    color: Colors.text.secondary,
    fontSize: 15,
    fontWeight: '500',
  },
  // Location step
  locationContent: {
    flex: 1,
    padding: 20,
  },
  residenceChosen: {
    marginBottom: 24,
  },
  residenceChosenLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.secondary,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  residenceChosenCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  residenceChosenFlag: {
    fontSize: 32,
  },
  residenceChosenName: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  locationBenefits: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
  },
  locationBenefitsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 16,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  benefitIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  benefitText: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  benefitDesc: {
    fontSize: 13,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  locationLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 20,
    padding: 16,
    backgroundColor: Colors.primary + '10',
    borderRadius: 12,
  },
  locationLoadingText: {
    fontSize: 14,
    color: Colors.primary,
  },
  // Main screen styles
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
    alignItems: 'flex-end',
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  locationBadgeText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: -10,
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
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.border.light,
    marginVertical: 4,
  },
  currentLocationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary + '10',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  currentLocationText: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  currentLocationCountry: {
    fontWeight: '600',
    color: Colors.primary,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(29, 161, 242, 0.1)',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: Colors.text.secondary,
    lineHeight: 18,
  },
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
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  addBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
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
  countryCardResidence: {
    borderWidth: 2,
    borderColor: Colors.success + '50',
    backgroundColor: Colors.success + '05',
  },
  residenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: Colors.success + '15',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  residenceBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.success,
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
  daysCountResidence: {
    color: Colors.success,
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
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
  },
  editHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
  },
  editHintText: {
    fontSize: 11,
    color: Colors.text.muted,
  },
  noteCard: {
    flexDirection: 'row',
    backgroundColor: Colors.background.primary,
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  noteContent: {
    flex: 1,
  },
  noteTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  noteText: {
    fontSize: 13,
    color: Colors.text.secondary,
    lineHeight: 18,
  },
  enableLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    backgroundColor: Colors.primary + '15',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  enableLocationBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  // Modal styles
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
    maxHeight: '80%',
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
  editCountryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
    padding: 16,
    backgroundColor: Colors.background.secondary,
    borderRadius: 12,
  },
  editCountryFlag: {
    fontSize: 40,
  },
  editCountryName: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
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
  quickButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  quickBtn: {
    flex: 1,
    backgroundColor: Colors.background.secondary,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  quickBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  flagSelector: {
    marginBottom: 8,
  },
  flagOption: {
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    backgroundColor: Colors.background.secondary,
    marginRight: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  flagOptionSelected: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(29, 161, 242, 0.1)',
  },
  flagEmoji: {
    fontSize: 28,
  },
  flagCode: {
    fontSize: 11,
    color: Colors.text.secondary,
    marginTop: 2,
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
});
