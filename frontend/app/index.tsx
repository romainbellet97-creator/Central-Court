import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Platform, Text, TouchableOpacity, Linking, ScrollView } from 'react-native';
import { Redirect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/context/AuthContext';

const ONBOARDING_COMPLETE_KEY = 'onboarding_completed';

// Expo Go URL
const EXPO_URL = 'exp://event-management-9.ngrok.io';

export default function Index() {
  const { user, isLoading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isNewUser, setIsNewUser] = useState(true);
  const [isWebBrowser, setIsWebBrowser] = useState(false);

  useEffect(() => {
    checkPlatformAndOnboarding();
  }, []);

  const checkPlatformAndOnboarding = async () => {
    // Check if we're on a web browser (not in Expo Go)
    if (Platform.OS === 'web') {
      // Check if it's a mobile browser or desktop
      const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
      const isMobileWeb = /iPhone|iPad|iPod|Android/i.test(userAgent);
      
      // On web, show landing page unless user explicitly navigated to app
      setIsWebBrowser(true);
      setIsLoading(false);
      return;
    }

    // On native (iOS/Android), check onboarding status
    try {
      const onboardingComplete = await AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY);
      setIsNewUser(onboardingComplete !== 'true');
    } catch (error) {
      console.log('Error checking onboarding status:', error);
      setIsNewUser(true);
    } finally {
      setIsLoading(false);
    }
  };

  const openExpoGo = () => {
    Linking.openURL(EXPO_URL);
  };

  const openAppStore = () => {
    Linking.openURL('https://apps.apple.com/app/expo-go/id982107779');
  };

  const openPlayStore = () => {
    Linking.openURL('https://play.google.com/store/apps/details?id=host.exp.exponent');
  };

  // Loading state
  if (isLoading || authLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#1e3c72" />
      </View>
    );
  }

  // Web browser - show landing page
  if (isWebBrowser) {
    return (
      <LinearGradient colors={['#1e3c72', '#2a5298']} style={styles.landingContainer}>
        <ScrollView contentContainerStyle={styles.landingScroll} showsVerticalScrollIndicator={false}>
          <View style={styles.landingCard}>
            {/* Logo */}
            <Text style={styles.landingLogo}>🎾</Text>
            <Text style={styles.landingTitle}>Le Court Central</Text>
            <Text style={styles.landingSubtitle}>
              L'application des joueurs de tennis professionnels
            </Text>

            {/* Features */}
            <View style={styles.featuresContainer}>
              <View style={styles.featureItem}>
                <Ionicons name="calendar" size={20} color="#1e3c72" />
                <Text style={styles.featureText}>Calendrier des tournois</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="globe" size={20} color="#1e3c72" />
                <Text style={styles.featureText}>Suivi résidence fiscale</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="receipt" size={20} color="#1e3c72" />
                <Text style={styles.featureText}>Gestion des dépenses</Text>
              </View>
            </View>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Instructions */}
            <Text style={styles.instructionsTitle}>Comment accéder à l'app ?</Text>
            
            <View style={styles.step}>
              <View style={styles.stepNumber}><Text style={styles.stepNumberText}>1</Text></View>
              <Text style={styles.stepText}>Téléchargez Expo Go sur votre téléphone</Text>
            </View>

            {/* Store buttons */}
            <View style={styles.storeButtons}>
              <TouchableOpacity style={styles.storeBtn} onPress={openAppStore}>
                <Ionicons name="logo-apple" size={20} color="#fff" />
                <Text style={styles.storeBtnText}>App Store</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.storeBtn, styles.playStoreBtn]} onPress={openPlayStore}>
                <Ionicons name="logo-google-playstore" size={20} color="#fff" />
                <Text style={styles.storeBtnText}>Play Store</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.step}>
              <View style={styles.stepNumber}><Text style={styles.stepNumberText}>2</Text></View>
              <Text style={styles.stepText}>Ouvrez Le Court Central dans Expo Go</Text>
            </View>

            {/* Open button */}
            <TouchableOpacity style={styles.openBtn} onPress={openExpoGo}>
              <Ionicons name="open" size={20} color="#fff" />
              <Text style={styles.openBtnText}>Ouvrir Le Court Central</Text>
            </TouchableOpacity>

            {/* Status */}
            <View style={styles.statusContainer}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>API en ligne — v1.0</Text>
            </View>

            {/* Note */}
            <Text style={styles.noteText}>
              Version de développement. Pour un accès sans Expo Go, utilisez EAS Build pour générer l'APK/IPA.
            </Text>
          </View>
        </ScrollView>
      </LinearGradient>
    );
  }

  // Native app - redirect based on role and onboarding status
  if (isNewUser) {
    return <Redirect href="/onboarding" />;
  }

  // If user is authenticated, redirect based on role
  if (user) {
    // Staff roles redirect to staff dashboard
    if (user.role !== 'player') {
      return <Redirect href="/(staff)/dashboard" />;
    }
    // Players redirect to player tabs
    return <Redirect href="/(player)/" />;
  }

  // Default: redirect to (tabs) for backward compatibility
  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  // Landing page styles
  landingContainer: {
    flex: 1,
    minHeight: '100%',
  },
  landingScroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    minHeight: '100%',
  },
  landingCard: {
    backgroundColor: '#fff',
    borderRadius: 28,
    padding: 32,
    maxWidth: 420,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.25,
    shadowRadius: 80,
    elevation: 24,
  },
  landingLogo: {
    fontSize: 64,
    marginBottom: 8,
  },
  landingTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  landingSubtitle: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  featuresContainer: {
    width: '100%',
    marginBottom: 24,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    marginBottom: 8,
  },
  featureText: {
    fontSize: 14,
    color: '#1a1a1a',
    fontWeight: '500',
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 20,
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 20,
    textAlign: 'center',
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    marginBottom: 16,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1e3c72',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  storeButtons: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
    width: '100%',
  },
  storeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#333',
    paddingVertical: 14,
    borderRadius: 12,
  },
  playStoreBtn: {
    backgroundColor: '#1e3c72',
  },
  storeBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  openBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#10B981',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 14,
    width: '100%',
    marginTop: 8,
  },
  openBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  statusText: {
    fontSize: 13,
    color: '#666',
  },
  noteText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
  },
});
