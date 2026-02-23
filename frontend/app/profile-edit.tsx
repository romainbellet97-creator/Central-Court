import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  Image,
  Alert,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import Colors from '../src/constants/colors';

const STORAGE_KEY = '@central_court_player_profile';
const ACCOUNTANT_KEY = '@central_court_accountant_email';

export type Circuit = 'ATP' | 'WTA' | 'ITF' | 'ITF_WHEELCHAIR';
export type TournamentLevel = 'ATP_250' | 'ATP_500' | 'ATP_1000' | 'CHALLENGER' | 'WTA_250' | 'WTA_500' | 'WTA_1000' | 'ITF_W' | 'ITF_M' | 'ITF_WHEELCHAIR';

export interface PlayerProfile {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  email: string;
  phone: string;
  photoUri: string;
  circuit: Circuit | null;
  tournamentLevels: TournamentLevel[];
  currentRanking: string;
  residenceCountry: string;
  accountantEmail: string;
  onboardingCompleted: boolean;
  createdAt: string;
}

const initialProfile: PlayerProfile = {
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  email: '',
  phone: '',
  photoUri: '',
  circuit: null,
  tournamentLevels: [],
  currentRanking: '',
  residenceCountry: 'France',
  accountantEmail: '',
  onboardingCompleted: false,
  createdAt: new Date().toISOString(),
};

const circuits = [
  { id: 'ATP' as Circuit, label: 'ATP', icon: '🎾', description: 'Circuit masculin professionnel' },
  { id: 'WTA' as Circuit, label: 'WTA', icon: '🎾', description: 'Circuit féminin professionnel' },
  { id: 'ITF' as Circuit, label: 'ITF', icon: '🌍', description: 'Circuit ITF Pro' },
  { id: 'ITF_WHEELCHAIR' as Circuit, label: 'ITF Wheelchair', icon: '♿', description: 'Circuit Handisport' },
];

const atpLevels = [
  { id: 'ATP_1000' as TournamentLevel, label: 'ATP Masters 1000', points: '1000 pts' },
  { id: 'ATP_500' as TournamentLevel, label: 'ATP 500', points: '500 pts' },
  { id: 'ATP_250' as TournamentLevel, label: 'ATP 250', points: '250 pts' },
  { id: 'CHALLENGER' as TournamentLevel, label: 'ATP Challenger', points: '50-175 pts' },
];

const wtaLevels = [
  { id: 'WTA_1000' as TournamentLevel, label: 'WTA 1000', points: '1000 pts' },
  { id: 'WTA_500' as TournamentLevel, label: 'WTA 500', points: '500 pts' },
  { id: 'WTA_250' as TournamentLevel, label: 'WTA 250', points: '250 pts' },
];

const itfLevels = [
  { id: 'ITF_M' as TournamentLevel, label: 'ITF M15-M25', points: 'Points ITF' },
  { id: 'ITF_W' as TournamentLevel, label: 'ITF W15-W100', points: 'Points ITF' },
];

const countries = [
  { code: 'FR', flag: '🇫🇷', name: 'France' },
  { code: 'MC', flag: '🇲🇨', name: 'Monaco' },
  { code: 'CH', flag: '🇨🇭', name: 'Suisse' },
  { code: 'ES', flag: '🇪🇸', name: 'Espagne' },
  { code: 'AE', flag: '🇦🇪', name: 'Émirats Arabes Unis' },
  { code: 'GB', flag: '🇬🇧', name: 'Royaume-Uni' },
  { code: 'US', flag: '🇺🇸', name: 'États-Unis' },
  { code: 'BE', flag: '🇧🇪', name: 'Belgique' },
  { code: 'IT', flag: '🇮🇹', name: 'Italie' },
  { code: 'PT', flag: '🇵🇹', name: 'Portugal' },
];

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  const isEditing = params.edit === 'true';
  
  const [step, setStep] = useState(1);
  const [profile, setProfile] = useState<PlayerProfile>(initialProfile);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Date picker state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date(2000, 0, 1));
  
  useEffect(() => {
    loadProfile();
  }, []);
  
  const loadProfile = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const existingProfile: PlayerProfile = JSON.parse(stored);
        setProfile(existingProfile);
        
        // Parse date of birth if exists
        if (existingProfile.dateOfBirth) {
          const parts = existingProfile.dateOfBirth.split('/');
          if (parts.length === 3) {
            setSelectedDate(new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])));
          }
        }
        
        // If onboarding completed and not editing, go to app
        if (existingProfile.onboardingCompleted && !isEditing) {
          router.replace('/(tabs)');
          return;
        }
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const saveProfile = async (updates: Partial<PlayerProfile>) => {
    const updatedProfile = { ...profile, ...updates };
    setProfile(updatedProfile);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedProfile));
    } catch (error) {
      console.error('Error saving profile:', error);
    }
  };
  
  const handleDateChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (date) {
      setSelectedDate(date);
      const formattedDate = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
      saveProfile({ dateOfBirth: formattedDate });
    }
  };
  
  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission requise',
        "L'accès à la galerie est nécessaire pour choisir une photo de profil.",
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Ouvrir Paramètres',
            onPress: () => Platform.OS === 'ios' ? Linking.openURL('app-settings:') : Linking.openSettings(),
          },
        ]
      );
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        saveProfile({ photoUri: result.assets[0].uri });
      }
    } catch (err) {
      console.error('Error picking photo from library:', err);
      Alert.alert('Erreur', 'Impossible d\'ouvrir la galerie. Veuillez réessayer.');
    }
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission requise',
        "L'accès à la caméra est nécessaire pour prendre une photo de profil.",
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Ouvrir Paramètres',
            onPress: () => Platform.OS === 'ios' ? Linking.openURL('app-settings:') : Linking.openSettings(),
          },
        ]
      );
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        saveProfile({ photoUri: result.assets[0].uri });
      }
    } catch (err) {
      console.error('Error taking photo with camera:', err);
      Alert.alert('Erreur', 'Impossible d\'ouvrir la caméra. Veuillez réessayer.');
    }
  };
  
  const showPhotoOptions = () => {
    Alert.alert(
      'Photo de profil',
      'Choisissez une option',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: '📷 Prendre une photo', onPress: handleTakePhoto },
        { text: '🖼️ Choisir dans la galerie', onPress: handlePickPhoto },
        ...(profile.photoUri ? [{ text: '🗑️ Supprimer', style: 'destructive' as const, onPress: () => saveProfile({ photoUri: '' }) }] : []),
      ]
    );
  };
  
  const handleNext = () => {
    if (step < 4) {
      setStep(step + 1);
    } else {
      completeOnboarding();
    }
  };
  
  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else if (isEditing) {
      router.back();
    }
  };
  
  const completeOnboarding = async () => {
    setIsSaving(true);
    await saveProfile({ onboardingCompleted: true });
    setIsSaving(false);
    
    if (isEditing) {
      Alert.alert('✅ Profil mis à jour', 'Vos modifications ont été enregistrées.');
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };
  
  const getTournamentLevels = () => {
    switch (profile.circuit) {
      case 'ATP': return atpLevels;
      case 'WTA': return wtaLevels;
      case 'ITF': return itfLevels;
      case 'ITF_WHEELCHAIR': return [{ id: 'ITF_WHEELCHAIR' as TournamentLevel, label: 'ITF Wheelchair Tour', points: 'Points ITF' }];
      default: return [];
    }
  };
  
  const toggleTournamentLevel = (levelId: TournamentLevel) => {
    const current = profile.tournamentLevels;
    if (current.includes(levelId)) {
      saveProfile({ tournamentLevels: current.filter(l => l !== levelId) });
    } else {
      saveProfile({ tournamentLevels: [...current, levelId] });
    }
  };
  
  const isStep1Valid = profile.firstName && profile.lastName && profile.email;
  const isStep2Valid = profile.circuit && profile.tournamentLevels.length > 0;
  const isStep3Valid = profile.residenceCountry;
  const isStep4Valid = true; // Optional step
  
  const canProceed = () => {
    switch (step) {
      case 1: return isStep1Valid;
      case 2: return isStep2Valid;
      case 3: return isStep3Valid;
      case 4: return isStep4Valid;
      default: return false;
    }
  };
  
  if (isLoading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={[Colors.primary, '#1565c0']}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <View style={styles.headerTop}>
          {(step > 1 || isEditing) && (
            <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
          )}
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>
              {isEditing ? '✏️ Modifier le profil' : '🎾 Tennis Assistant'}
            </Text>
            <Text style={styles.headerSubtitle}>
              {isEditing ? 'Mettez à jour vos informations' : 'Configuration de votre profil'}
            </Text>
          </View>
        </View>
        
        {/* Progress */}
        <View style={styles.progressContainer}>
          {[1, 2, 3, 4].map(s => (
            <TouchableOpacity 
              key={s} 
              style={styles.progressItem}
              onPress={() => isEditing && setStep(s)}
              disabled={!isEditing}
            >
              <View style={[
                styles.progressDot,
                s <= step && styles.progressDotActive,
                s < step && styles.progressDotCompleted
              ]}>
                {s < step ? (
                  <Ionicons name="checkmark" size={14} color="#fff" />
                ) : (
                  <Text style={[styles.progressNumber, s <= step && styles.progressNumberActive]}>{s}</Text>
                )}
              </View>
              <Text style={[styles.progressLabel, s <= step && styles.progressLabelActive]}>
                {s === 1 ? 'Identité' : s === 2 ? 'Tennis' : s === 3 ? 'Résidence' : 'Comptable'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </LinearGradient>
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <ScrollView 
          style={styles.scrollContent}
          contentContainerStyle={styles.scrollContentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Step 1: Personal Info */}
          {step === 1 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Informations personnelles</Text>
              <Text style={styles.stepSubtitle}>Ces informations restent privées</Text>
              
              {/* Profile Photo */}
              <View style={styles.photoSection}>
                <TouchableOpacity style={styles.photoContainer} onPress={showPhotoOptions}>
                  {profile.photoUri ? (
                    <Image source={{ uri: profile.photoUri }} style={styles.profilePhoto} />
                  ) : (
                    <View style={styles.photoPlaceholder}>
                      <Ionicons name="person" size={40} color={Colors.text.muted} />
                    </View>
                  )}
                  <View style={styles.photoEditBadge}>
                    <Ionicons name="camera" size={16} color="#fff" />
                  </View>
                </TouchableOpacity>
                <Text style={styles.photoHint}>Appuyez pour ajouter une photo</Text>
              </View>
              
              <View style={styles.inputRow}>
                <View style={styles.inputHalf}>
                  <Text style={styles.inputLabel}>Prénom *</Text>
                  <TextInput
                    style={styles.input}
                    value={profile.firstName}
                    onChangeText={firstName => saveProfile({ firstName })}
                    placeholder="Lucas"
                    placeholderTextColor={Colors.text.muted}
                  />
                </View>
                <View style={styles.inputHalf}>
                  <Text style={styles.inputLabel}>Nom *</Text>
                  <TextInput
                    style={styles.input}
                    value={profile.lastName}
                    onChangeText={lastName => saveProfile({ lastName })}
                    placeholder="Martin"
                    placeholderTextColor={Colors.text.muted}
                  />
                </View>
              </View>
              
              <Text style={styles.inputLabel}>Date de naissance</Text>
              <TouchableOpacity 
                style={styles.datePickerBtn}
                onPress={() => setShowDatePicker(true)}
              >
                <Ionicons name="calendar-outline" size={20} color={Colors.primary} />
                <Text style={[
                  styles.datePickerText,
                  !profile.dateOfBirth && styles.datePickerPlaceholder
                ]}>
                  {profile.dateOfBirth || 'Sélectionner une date'}
                </Text>
                <Ionicons name="chevron-down" size={18} color={Colors.text.muted} />
              </TouchableOpacity>
              
              {showDatePicker && (
                <View style={styles.datePickerContainer}>
                  <DateTimePicker
                    value={selectedDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={handleDateChange}
                    maximumDate={new Date()}
                    minimumDate={new Date(1970, 0, 1)}
                  />
                  {Platform.OS === 'ios' && (
                    <TouchableOpacity 
                      style={styles.datePickerDoneBtn}
                      onPress={() => setShowDatePicker(false)}
                    >
                      <Text style={styles.datePickerDoneBtnText}>Confirmer</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
              
              <Text style={styles.inputLabel}>Email *</Text>
              <TextInput
                style={styles.input}
                value={profile.email}
                onChangeText={email => saveProfile({ email })}
                placeholder="lucas.martin@email.com"
                placeholderTextColor={Colors.text.muted}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              
              <Text style={styles.inputLabel}>Téléphone</Text>
              <TextInput
                style={styles.input}
                value={profile.phone}
                onChangeText={phone => saveProfile({ phone })}
                placeholder="+33 6 12 34 56 78"
                placeholderTextColor={Colors.text.muted}
                keyboardType="phone-pad"
              />
            </View>
          )}
          
          {/* Step 2: Tennis Info */}
          {step === 2 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Informations tennis</Text>
              <Text style={styles.stepSubtitle}>Pour afficher les tournois adaptés</Text>
              
              <Text style={styles.inputLabel}>Circuit principal *</Text>
              <View style={styles.circuitGrid}>
                {circuits.map(circuit => (
                  <TouchableOpacity
                    key={circuit.id}
                    style={[
                      styles.circuitCard,
                      profile.circuit === circuit.id && styles.circuitCardSelected
                    ]}
                    onPress={() => saveProfile({ circuit: circuit.id, tournamentLevels: [] })}
                  >
                    <Text style={styles.circuitIcon}>{circuit.icon}</Text>
                    <Text style={[
                      styles.circuitLabel,
                      profile.circuit === circuit.id && styles.circuitLabelSelected
                    ]}>
                      {circuit.label}
                    </Text>
                    <Text style={styles.circuitDesc}>{circuit.description}</Text>
                    {profile.circuit === circuit.id && (
                      <View style={styles.circuitCheck}>
                        <Ionicons name="checkmark-circle" size={22} color={Colors.success} />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
              
              {profile.circuit && (
                <>
                  <Text style={styles.inputLabel}>Niveaux de tournois *</Text>
                  <Text style={styles.inputHint}>Sélectionnez tous les niveaux auxquels vous participez</Text>
                  <View style={styles.levelsContainer}>
                    {getTournamentLevels().map(level => (
                      <TouchableOpacity
                        key={level.id}
                        style={[
                          styles.levelChip,
                          profile.tournamentLevels.includes(level.id) && styles.levelChipSelected
                        ]}
                        onPress={() => toggleTournamentLevel(level.id)}
                      >
                        <Text style={[
                          styles.levelChipText,
                          profile.tournamentLevels.includes(level.id) && styles.levelChipTextSelected
                        ]}>
                          {level.label}
                        </Text>
                        <Text style={[
                          styles.levelChipPoints,
                          profile.tournamentLevels.includes(level.id) && styles.levelChipPointsSelected
                        ]}>
                          {level.points}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
              
              <Text style={styles.inputLabel}>Classement actuel</Text>
              <TextInput
                style={styles.input}
                value={profile.currentRanking}
                onChangeText={currentRanking => saveProfile({ currentRanking })}
                placeholder="Ex: 125"
                placeholderTextColor={Colors.text.muted}
                keyboardType="number-pad"
              />
            </View>
          )}
          
          {/* Step 3: Fiscal Residence */}
          {step === 3 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Résidence fiscale</Text>
              <Text style={styles.stepSubtitle}>Pour le suivi de vos jours de voyage</Text>
              
              <View style={styles.infoBox}>
                <Ionicons name="information-circle" size={20} color={Colors.primary} />
                <Text style={styles.infoBoxText}>
                  Cette information aide à suivre vos jours passés dans chaque pays. 
                  Vous pourrez la modifier à tout moment.
                </Text>
              </View>
              
              <Text style={styles.inputLabel}>Pays de résidence *</Text>
              <View style={styles.countriesGrid}>
                {countries.map(country => (
                  <TouchableOpacity
                    key={country.code}
                    style={[
                      styles.countryCard,
                      profile.residenceCountry === country.name && styles.countryCardSelected
                    ]}
                    onPress={() => saveProfile({ residenceCountry: country.name })}
                  >
                    <Text style={styles.countryFlag}>{country.flag}</Text>
                    <Text style={[
                      styles.countryName,
                      profile.residenceCountry === country.name && styles.countryNameSelected
                    ]}>
                      {country.name}
                    </Text>
                    {profile.residenceCountry === country.name && (
                      <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
          
          {/* Step 4: Accountant Email */}
          {step === 4 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Comptable</Text>
              <Text style={styles.stepSubtitle}>Pour l'envoi automatique des factures</Text>
              
              <View style={styles.accountantCard}>
                <View style={styles.accountantIcon}>
                  <Ionicons name="calculator" size={32} color={Colors.primary} />
                </View>
                <Text style={styles.accountantTitle}>Envoi en 1 clic</Text>
                <Text style={styles.accountantDesc}>
                  Renseignez l'email de votre comptable pour lui envoyer 
                  automatiquement vos factures du mois en un seul clic.
                </Text>
              </View>
              
              <Text style={styles.inputLabel}>Email du comptable</Text>
              <TextInput
                style={styles.input}
                value={profile.accountantEmail}
                onChangeText={accountantEmail => saveProfile({ accountantEmail })}
                placeholder="comptable@cabinet.fr"
                placeholderTextColor={Colors.text.muted}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              
              {profile.accountantEmail && (
                <View style={styles.accountantPreview}>
                  <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
                  <Text style={styles.accountantPreviewText}>
                    Les factures seront envoyées à : {profile.accountantEmail}
                  </Text>
                </View>
              )}
              
              <View style={styles.optionalNote}>
                <Ionicons name="information-circle-outline" size={16} color={Colors.text.muted} />
                <Text style={styles.optionalNoteText}>
                  Cette étape est optionnelle. Vous pourrez toujours l'ajouter plus tard.
                </Text>
              </View>
            </View>
          )}
        </ScrollView>
        
        {/* Navigation Buttons */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.footerButtons}>
            {step > 1 && (
              <TouchableOpacity style={styles.backBtnFooter} onPress={handleBack}>
                <Ionicons name="arrow-back" size={20} color={Colors.text.secondary} />
                <Text style={styles.backBtnFooterText}>Retour</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity
              style={[
                styles.nextBtn,
                !canProceed() && styles.nextBtnDisabled,
                step === 1 && { flex: 1 }
              ]}
              onPress={handleNext}
              disabled={!canProceed() || isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.nextBtnText}>
                    {step === 4 ? (isEditing ? 'Enregistrer' : 'Terminer') : 'Continuer'}
                  </Text>
                  <Ionicons name={step === 4 ? 'checkmark' : 'arrow-forward'} size={20} color="#fff" />
                </>
              )}
            </TouchableOpacity>
          </View>
          
          {step === 1 && !isEditing && (
            <TouchableOpacity 
              style={styles.skipBtn}
              onPress={() => router.replace('/(tabs)')}
            >
              <Text style={styles.skipBtnText}>Passer pour le moment</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
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
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backBtn: {
    marginRight: 12,
    padding: 4,
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
  },
  progressItem: {
    alignItems: 'center',
  },
  progressDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  progressDotActive: {
    backgroundColor: '#fff',
  },
  progressDotCompleted: {
    backgroundColor: Colors.success,
  },
  progressNumber: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  progressNumberActive: {
    color: Colors.primary,
  },
  progressLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
  },
  progressLabelActive: {
    color: '#fff',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    padding: 20,
  },
  stepContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  stepSubtitle: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 20,
  },
  // Photo section
  photoSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  photoContainer: {
    position: 'relative',
  },
  profilePhoto: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  photoPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.border.light,
    borderStyle: 'dashed',
  },
  photoEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  photoHint: {
    fontSize: 12,
    color: Colors.text.muted,
    marginTop: 8,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  inputHalf: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.secondary,
    marginBottom: 6,
    marginTop: 14,
  },
  inputHint: {
    fontSize: 12,
    color: Colors.text.muted,
    marginBottom: 10,
  },
  input: {
    backgroundColor: Colors.background.secondary,
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: Colors.text.primary,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  // Date picker
  datePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.secondary,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border.light,
    gap: 10,
  },
  datePickerText: {
    flex: 1,
    fontSize: 15,
    color: Colors.text.primary,
  },
  datePickerPlaceholder: {
    color: Colors.text.muted,
  },
  datePickerContainer: {
    backgroundColor: Colors.background.secondary,
    borderRadius: 12,
    marginTop: 8,
    overflow: 'hidden',
  },
  datePickerDoneBtn: {
    backgroundColor: Colors.primary,
    padding: 12,
    alignItems: 'center',
  },
  datePickerDoneBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  circuitGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
  },
  circuitCard: {
    width: '48%',
    backgroundColor: Colors.background.secondary,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  circuitCardSelected: {
    borderColor: Colors.success,
    backgroundColor: Colors.success + '08',
  },
  circuitIcon: {
    fontSize: 28,
    marginBottom: 6,
  },
  circuitLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  circuitLabelSelected: {
    color: Colors.success,
  },
  circuitDesc: {
    fontSize: 11,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginTop: 2,
  },
  circuitCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  levelsContainer: {
    gap: 8,
  },
  levelChip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.background.secondary,
    borderRadius: 10,
    padding: 14,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  levelChipSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '10',
  },
  levelChipText: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  levelChipTextSelected: {
    color: Colors.primary,
    fontWeight: '600',
  },
  levelChipPoints: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  levelChipPointsSelected: {
    color: Colors.primary,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: Colors.primary + '10',
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  infoBoxText: {
    flex: 1,
    fontSize: 13,
    color: Colors.text.secondary,
    lineHeight: 18,
  },
  countriesGrid: {
    gap: 8,
    marginTop: 8,
  },
  countryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.secondary,
    borderRadius: 10,
    padding: 14,
    gap: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  countryCardSelected: {
    borderColor: Colors.success,
    backgroundColor: Colors.success + '08',
  },
  countryFlag: {
    fontSize: 24,
  },
  countryName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  countryNameSelected: {
    color: Colors.success,
    fontWeight: '600',
  },
  // Accountant section
  accountantCard: {
    alignItems: 'center',
    backgroundColor: Colors.primary + '08',
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
  },
  accountantIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  accountantTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  accountantDesc: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  accountantPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    padding: 12,
    backgroundColor: Colors.success + '10',
    borderRadius: 10,
  },
  accountantPreviewText: {
    flex: 1,
    fontSize: 13,
    color: Colors.success,
  },
  optionalNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    padding: 12,
    backgroundColor: Colors.background.secondary,
    borderRadius: 10,
  },
  optionalNoteText: {
    flex: 1,
    fontSize: 12,
    color: Colors.text.muted,
  },
  footer: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
  },
  footerButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  backBtnFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  backBtnFooterText: {
    fontSize: 15,
    color: Colors.text.secondary,
  },
  nextBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
  },
  nextBtnDisabled: {
    opacity: 0.5,
  },
  nextBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 8,
  },
  skipBtnText: {
    fontSize: 14,
    color: Colors.text.muted,
  },
});
