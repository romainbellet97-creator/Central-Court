import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import OnboardingProgressBar from '../../src/components/OnboardingProgressBar';
import { saveOnboardingStep } from '../../src/utils/onboardingStorage';

const COLORS = {
  primary: '#2D5016',
  secondary: '#E8B923',
  background: '#F8F9FA',
  success: '#43A047',
  error: '#E53935',
  text: '#1a1a1a',
  textSecondary: '#6b7280',
};

export default function Step1Prenom() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  
  const [prenom, setPrenom] = useState('');
  const [isValid, setIsValid] = useState(false);
  const [hasAutoProgressed, setHasAutoProgressed] = useState(false);
  
  // Auto-focus on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 300);
  }, []);
  
  // Validation
  useEffect(() => {
    const valid = prenom.trim().length >= 2;
    setIsValid(valid);
    
    // Auto-progression
    if (valid && !hasAutoProgressed) {
      const timer = setTimeout(() => {
        setHasAutoProgressed(true);
        saveAndContinue();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [prenom, hasAutoProgressed]);
  
  const saveAndContinue = async () => {
    await saveOnboardingStep(1, { prenom: prenom.trim() });
    router.push('/onboarding/step2-naissance');
  };
  
  return (
    <KeyboardAvoidingView 
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Back button */}
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={28} color={COLORS.text} />
      </TouchableOpacity>
      
      {/* Progress bar */}
      <OnboardingProgressBar currentStep={1} totalSteps={7} />
      
      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.question}>Comment vous appelez-vous ?</Text>
        
        <View style={styles.inputContainer}>
          <TextInput
            ref={inputRef}
            style={[
              styles.input,
              isValid && styles.inputValid,
            ]}
            value={prenom}
            onChangeText={setPrenom}
            placeholder="Votre prénom"
            placeholderTextColor="#bdbdbd"
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="done"
          />
          {isValid && (
            <View style={styles.validIcon}>
              <Ionicons name="checkmark-circle" size={24} color={COLORS.success} />
            </View>
          )}
        </View>
        
        {prenom.length > 0 && prenom.length < 2 && (
          <Text style={styles.errorText}>⚠️ Minimum 2 caractères</Text>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
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
    fontSize: 18,
    color: COLORS.text,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  inputValid: {
    borderColor: COLORS.success,
  },
  validIcon: {
    position: 'absolute',
    right: 16,
    top: '50%',
    transform: [{ translateY: -12 }],
  },
  errorText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.error,
  },
});
