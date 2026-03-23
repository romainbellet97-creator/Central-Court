import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

// Design system colors
export const COLORS = {
  primary: '#2D5016',
  secondary: '#E8B923',
  background: '#F8F9FA',
  success: '#43A047',
  error: '#E53935',
  text: '#1a1a1a',
  textSecondary: '#6b7280',
  white: '#FFFFFF',
};

export default function OnboardingStart() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Check for saved progress on mount
  useEffect(() => {
    checkSavedProgress();
  }, []);

  const checkSavedProgress = async () => {
    try {
      const savedStep = await AsyncStorage.getItem('onboarding_current_step');
      if (savedStep && parseInt(savedStep) > 0 && parseInt(savedStep) < 7) {
        // Show resume option (handled in UI)
      }
    } catch (error) {
      console.log('Error checking saved progress:', error);
    }
  };

  const startOnboarding = async () => {
    // Clear any previous progress
    await AsyncStorage.removeItem('onboarding_current_step');
    await AsyncStorage.removeItem('onboarding_data');
    router.push('/onboarding/step1-prenom');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />
      
      <LinearGradient
        colors={[COLORS.primary, '#1a3a0a']}
        style={styles.gradient}
      >
        <View style={styles.content}>
          {/* Logo */}
          <View style={styles.logoContainer}>
            <Text style={styles.logoEmoji}>🎾</Text>
            <Text style={styles.logoText}>Le Court Central</Text>
          </View>
          
          {/* Welcome text */}
          <View style={styles.welcomeContainer}>
            <Text style={styles.welcomeTitle}>Bienvenue</Text>
            <Text style={styles.welcomeSubtitle}>
              Créez votre profil de joueur en quelques étapes simples
            </Text>
          </View>
          
          {/* Features */}
          <View style={styles.featuresContainer}>
            <View style={styles.featureRow}>
              <Ionicons name="trophy-outline" size={24} color={COLORS.secondary} />
              <Text style={styles.featureText}>Suivez vos tournois</Text>
            </View>
            <View style={styles.featureRow}>
              <Ionicons name="calendar-outline" size={24} color={COLORS.secondary} />
              <Text style={styles.featureText}>Gérez votre planning</Text>
            </View>
            <View style={styles.featureRow}>
              <Ionicons name="people-outline" size={24} color={COLORS.secondary} />
              <Text style={styles.featureText}>Collaborez avec votre staff</Text>
            </View>
          </View>
        </View>
        
        {/* CTA */}
        <View style={[styles.ctaContainer, { paddingBottom: insets.bottom + 24 }]}>
          <TouchableOpacity style={styles.ctaButton} onPress={startOnboarding}>
            <Text style={styles.ctaButtonText}>Créer un compte</Text>
            <Ionicons name="arrow-forward" size={20} color={COLORS.primary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.loginButton} onPress={() => router.push('/login')}>
            <Text style={styles.loginButtonText}>Déjà un compte ? Se connecter</Text>
          </TouchableOpacity>

          <Text style={styles.timeEstimate}>⏱️ Inscription en 2 minutes</Text>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  gradient: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoEmoji: {
    fontSize: 64,
    marginBottom: 12,
  },
  logoText: {
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.white,
    letterSpacing: -0.5,
  },
  welcomeContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.white,
    marginBottom: 12,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    lineHeight: 24,
  },
  featuresContainer: {
    gap: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
  },
  featureText: {
    fontSize: 16,
    color: COLORS.white,
    fontWeight: '500',
  },
  ctaContainer: {
    paddingHorizontal: 24,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: COLORS.secondary,
    paddingVertical: 18,
    borderRadius: 14,
    marginBottom: 16,
  },
  ctaButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary,
  },
  loginButton: {
    alignItems: 'center',
    paddingVertical: 14,
    marginBottom: 8,
  },
  loginButtonText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  timeEstimate: {
    textAlign: 'center',
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
  },
});
