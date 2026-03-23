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

export default function Step5Classement() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  
  const [classement, setClassement] = useState('');
  const [isValid, setIsValid] = useState(false);
  const [hasAutoProgressed, setHasAutoProgressed] = useState(false);
  
  // Auto-focus on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 300);
  }, []);
  
  // Validation
  useEffect(() => {
    const num = parseInt(classement);
    const valid = !isNaN(num) && num > 0;
    setIsValid(valid);
    
    // Auto-progression
    if (valid && !hasAutoProgressed && classement.length >= 1) {
      const timer = setTimeout(() => {
        setHasAutoProgressed(true);
        saveAndContinue(num);
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [classement, hasAutoProgressed]);
  
  const saveAndContinue = async (value: number | null) => {
    await saveOnboardingStep(5, { classement: value });
    router.push('/onboarding/step6-email');
  };
  
  const skipClassement = () => {
    saveAndContinue(null);
  };
  
  const handleChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    setClassement(cleaned);
  };
  
  return (
    <KeyboardAvoidingView 
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={28} color={COLORS.text} />
      </TouchableOpacity>
      
      <OnboardingProgressBar currentStep={5} totalSteps={7} />
      
      <View style={styles.content}>
        <Text style={styles.question}>Quel est votre classement actuel ?</Text>
        <Text style={styles.hint}>Position au classement ATP/WTA/ITF</Text>
        
        <View style={styles.inputContainer}>
          <TextInput
            ref={inputRef}
            style={[
              styles.input,
              isValid && styles.inputValid,
            ]}
            value={classement}
            onChangeText={handleChange}
            placeholder="Ex: 125"
            placeholderTextColor="#bdbdbd"
            keyboardType="number-pad"
          />
          {isValid && (
            <View style={styles.validIcon}>
              <Ionicons name="checkmark-circle" size={24} color={COLORS.success} />
            </View>
          )}
        </View>
        
        <TouchableOpacity style={styles.skipButton} onPress={skipClassement}>
          <Text style={styles.skipButtonText}>Je n'ai pas encore de classement</Text>
          <Ionicons name="arrow-forward" size={18} color={COLORS.textSecondary} />
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
    marginBottom: 8,
  },
  hint: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 32,
  },
  inputContainer: {
    position: 'relative',
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 18,
    fontSize: 24,
    fontWeight: '600',
    color: COLORS.text,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    textAlign: 'center',
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
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 32,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
  },
  skipButtonText: {
    fontSize: 15,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
});
