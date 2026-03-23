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

const EMAIL_DOMAINS = ['@gmail.com', '@outlook.com', '@yahoo.com', '@icloud.com'];

export default function Step6Email() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  
  const [email, setEmail] = useState('');
  const [isValid, setIsValid] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [hasAutoProgressed, setHasAutoProgressed] = useState(false);
  
  // Auto-focus on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 300);
  }, []);
  
  // Validation
  useEffect(() => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const valid = emailRegex.test(email);
    setIsValid(valid);
    
    // Show suggestions if @ is typed but no domain yet
    setShowSuggestions(email.includes('@') && !email.includes('.'));
    
    // Auto-progression
    if (valid && !hasAutoProgressed) {
      const timer = setTimeout(() => {
        setHasAutoProgressed(true);
        saveAndContinue();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [email, hasAutoProgressed]);
  
  const saveAndContinue = async () => {
    await saveOnboardingStep(6, { email: email.trim().toLowerCase() });
    router.push('/onboarding/step7-password');
  };
  
  const selectDomain = (domain: string) => {
    const localPart = email.split('@')[0];
    setEmail(localPart + domain);
  };
  
  return (
    <KeyboardAvoidingView 
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={28} color={COLORS.text} />
      </TouchableOpacity>
      
      <OnboardingProgressBar currentStep={6} totalSteps={7} />
      
      <View style={styles.content}>
        <Text style={styles.question}>Quelle est votre adresse email ?</Text>
        
        <View style={styles.inputContainer}>
          <TextInput
            ref={inputRef}
            style={[
              styles.input,
              isValid && styles.inputValid,
              email.length > 0 && !isValid && styles.inputInvalid,
            ]}
            value={email}
            onChangeText={setEmail}
            placeholder="votre@email.com"
            placeholderTextColor="#bdbdbd"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={styles.statusIcon}>
            {email.length > 0 && (
              isValid ? (
                <Ionicons name="checkmark-circle" size={24} color={COLORS.success} />
              ) : (
                <Ionicons name="close-circle" size={24} color={COLORS.error} />
              )
            )}
          </View>
        </View>
        
        {email.length > 0 && !isValid && email.includes('@') && (
          <Text style={styles.errorText}>⚠️ Format d'email incorrect</Text>
        )}
        
        {/* Domain suggestions */}
        {showSuggestions && (
          <View style={styles.suggestionsContainer}>
            {EMAIL_DOMAINS.map(domain => (
              <TouchableOpacity
                key={domain}
                style={styles.suggestionChip}
                onPress={() => selectDomain(domain)}
              >
                <Text style={styles.suggestionText}>{email.split('@')[0]}{domain}</Text>
              </TouchableOpacity>
            ))}
          </View>
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
    paddingRight: 50,
    fontSize: 18,
    color: COLORS.text,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  inputValid: {
    borderColor: COLORS.success,
  },
  inputInvalid: {
    borderColor: COLORS.error,
  },
  statusIcon: {
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
  suggestionsContainer: {
    marginTop: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestionChip: {
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  suggestionText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '500',
  },
});
