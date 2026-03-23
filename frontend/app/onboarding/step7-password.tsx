import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import OnboardingProgressBar from '../../src/components/OnboardingProgressBar';
import { saveOnboardingStep, getOnboardingData } from '../../src/utils/onboardingStorage';
import { setSessionToken } from '../../src/utils/tokenStorage';
import { useAuth } from '../../src/context/AuthContext';
import api from '../../src/services/api';

const USER_EMAIL_KEY = '@central_court_user_email';

const COLORS = {
  primary: '#2D5016',
  secondary: '#E8B923',
  background: '#F8F9FA',
  success: '#43A047',
  error: '#E53935',
  text: '#1a1a1a',
  textSecondary: '#6b7280',
};

export default function Step7Password() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setUserSession } = useAuth();
  const inputRef = useRef<TextInput>(null);
  const successAnim = useRef(new Animated.Value(0)).current;
  
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  
  // Criteria
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const allCriteriaValid = hasMinLength && hasUppercase && hasNumber;
  
  // Strength
  const criteriaCount = [hasMinLength, hasUppercase, hasNumber].filter(Boolean).length;
  const strengthPercent = (criteriaCount / 3) * 100;
  const strengthColor = criteriaCount === 0 ? '#e5e7eb' : 
                        criteriaCount === 1 ? COLORS.error :
                        criteriaCount === 2 ? '#f59e0b' : COLORS.success;
  
  // Auto-focus on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 300);
  }, []);
  
  const createAccount = async () => {
    if (!allCriteriaValid || isCreating) return;
    
    setIsCreating(true);
    let success = false;
    
    try {
      // Save password locally
      await saveOnboardingStep(7, { password: password });
      
      // Get all onboarding data
      const userData = await getOnboardingData();
      console.log('Saving user to backend:', userData);
      
      if (!userData || !userData.email || !userData.prenom) {
        Alert.alert('Erreur', 'Données d\'inscription incomplètes. Veuillez recommencer l\'onboarding.');
        return;
      }
      
      // Send to backend API — public endpoint, no auth token needed
      const response = await api.post('/api/users/onboarding', {
        prenom: userData.prenom,
        email: userData.email,
        password: password,  // hashed server-side
        dateNaissance: userData.dateNaissance || null,
        circuits: userData.circuits || [],
        // step4 saves as niveauxTournois, backend field is niveaux
        niveaux: userData.niveauxTournois || userData.niveaux || [],
        classement: userData.classement != null ? String(userData.classement) : null,
        residenceFiscale: userData.residenceFiscale || null,
        onboardingCompleted: true,
        onboardingStep: 7,
      }, { timeout: 15000 });

      console.log('User saved to backend:', response.data);

      // Store session token and update AuthContext so the user is authenticated immediately
      if (response.data.session_token) {
        await setUserSession(response.data.session_token, {
          user_id: response.data.user_id || response.data.id,
          email: response.data.email,
          name: response.data.prenom,
          role: 'player',
        });
      }

      // Store email for future session lookups
      await AsyncStorage.setItem(USER_EMAIL_KEY, userData.email);
      
      // Mark success to prevent resetting isCreating
      success = true;
      
      // Show success animation
      setShowSuccess(true);
      Animated.spring(successAnim, {
        toValue: 1,
        friction: 4,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
      
      // Navigate to main app after delay
      setTimeout(async () => {
        await AsyncStorage.setItem('onboarding_completed', 'true');
        router.replace('/(tabs)');
      }, 2000);
      
    } catch (error: any) {
      console.error('Error creating account:', error);
      const message = error.response?.data?.detail 
        || error.message 
        || 'Impossible de créer le compte. Veuillez réessayer.';
      Alert.alert('Erreur', message);
    } finally {
      if (!success) {
        setIsCreating(false);
      }
    }
  };
  
  if (showSuccess) {
    return (
      <View style={[styles.container, styles.successContainer, { paddingTop: insets.top }]}>
        <Animated.View 
          style={[
            styles.successContent,
            {
              transform: [
                { scale: successAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) },
              ],
              opacity: successAnim,
            }
          ]}
        >
          <View style={styles.successIconContainer}>
            <Ionicons name="checkmark-circle" size={80} color={COLORS.success} />
          </View>
          <Text style={styles.successTitle}>Compte créé !</Text>
          <Text style={styles.successSubtitle}>Bienvenue sur Tennis Pro</Text>
        </Animated.View>
      </View>
    );
  }
  
  return (
    <KeyboardAvoidingView 
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={28} color={COLORS.text} />
      </TouchableOpacity>
      
      <OnboardingProgressBar currentStep={7} totalSteps={7} />
      
      <View style={styles.content}>
        <Text style={styles.question}>Choisissez un mot de passe</Text>
        
        <View style={styles.inputContainer}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Mot de passe"
            placeholderTextColor="#bdbdbd"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity 
            style={styles.toggleButton}
            onPress={() => setShowPassword(!showPassword)}
          >
            <Ionicons 
              name={showPassword ? 'eye-off-outline' : 'eye-outline'} 
              size={22} 
              color={COLORS.textSecondary} 
            />
          </TouchableOpacity>
        </View>
        
        {/* Strength bar */}
        <View style={styles.strengthContainer}>
          <View style={styles.strengthBar}>
            <View style={[styles.strengthFill, { width: `${strengthPercent}%`, backgroundColor: strengthColor }]} />
          </View>
          <Text style={[styles.strengthText, { color: strengthColor }]}>
            {criteriaCount === 0 ? '' : criteriaCount === 1 ? 'Faible' : criteriaCount === 2 ? 'Moyen' : 'Fort'}
          </Text>
        </View>
        
        {/* Criteria checklist */}
        <View style={styles.criteriaContainer}>
          <View style={styles.criteriaRow}>
            <Ionicons 
              name={hasMinLength ? 'checkmark-circle' : 'ellipse-outline'} 
              size={20} 
              color={hasMinLength ? COLORS.success : '#bdbdbd'} 
            />
            <Text style={[styles.criteriaText, hasMinLength && styles.criteriaTextValid]}>
              Minimum 8 caractères
            </Text>
          </View>
          
          <View style={styles.criteriaRow}>
            <Ionicons 
              name={hasUppercase ? 'checkmark-circle' : 'ellipse-outline'} 
              size={20} 
              color={hasUppercase ? COLORS.success : '#bdbdbd'} 
            />
            <Text style={[styles.criteriaText, hasUppercase && styles.criteriaTextValid]}>
              1 lettre majuscule
            </Text>
          </View>
          
          <View style={styles.criteriaRow}>
            <Ionicons 
              name={hasNumber ? 'checkmark-circle' : 'ellipse-outline'} 
              size={20} 
              color={hasNumber ? COLORS.success : '#bdbdbd'} 
            />
            <Text style={[styles.criteriaText, hasNumber && styles.criteriaTextValid]}>
              1 chiffre
            </Text>
          </View>
        </View>
        
        {/* Create account button */}
        <TouchableOpacity
          style={[styles.createBtn, !allCriteriaValid && styles.createBtnDisabled]}
          onPress={createAccount}
          disabled={!allCriteriaValid || isCreating}
        >
          {isCreating ? (
            <Text style={styles.createBtnText}>Création...</Text>
          ) : (
            <>
              <Text style={[styles.createBtnText, !allCriteriaValid && styles.createBtnTextDisabled]}>
                Créer mon compte
              </Text>
              <Ionicons 
                name="arrow-forward" 
                size={20} 
                color={allCriteriaValid ? '#fff' : '#bdbdbd'} 
              />
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  successContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  successContent: {
    alignItems: 'center',
  },
  successIconContainer: {
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 16,
    zIndex: 10,
    padding: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  question: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 32,
  },
  inputContainer: {
    position: 'relative',
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 18,
    paddingRight: 50,
    fontSize: 18,
    color: COLORS.text,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  toggleButton: {
    position: 'absolute',
    right: 16,
    top: '50%',
    transform: [{ translateY: -11 }],
    padding: 4,
  },
  strengthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 12,
  },
  strengthBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#e5e7eb',
    borderRadius: 3,
    overflow: 'hidden',
  },
  strengthFill: {
    height: '100%',
    borderRadius: 3,
  },
  strengthText: {
    fontSize: 13,
    fontWeight: '600',
    minWidth: 50,
  },
  criteriaContainer: {
    marginTop: 24,
    gap: 12,
  },
  criteriaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  criteriaText: {
    fontSize: 15,
    color: '#bdbdbd',
  },
  criteriaTextValid: {
    color: COLORS.text,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: COLORS.primary,
    paddingVertical: 18,
    borderRadius: 12,
    marginTop: 32,
  },
  createBtnDisabled: {
    backgroundColor: '#e5e7eb',
  },
  createBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
  createBtnTextDisabled: {
    color: '#bdbdbd',
  },
});
