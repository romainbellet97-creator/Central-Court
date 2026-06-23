import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import OnboardingProgressBar from '../../src/components/OnboardingProgressBar';
import { useCalendarSync } from '../../src/hooks/useCalendarSync';

const COLORS = {
  primary: '#2D5016',
  secondary: '#E8B923',
  background: '#F8F9FA',
  text: '#1a1a1a',
  textLight: '#666',
  border: '#E0E0E0',
  white: '#fff',
};

export default function Step8Calendar() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { enable } = useCalendarSync();
  const [isConnecting, setIsConnecting] = useState(false);
  const [connected, setConnected] = useState(false);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const ok = await enable();
      if (ok) {
        setConnected(true);
        // Courte pause pour que l'user voie la confirmation, puis on continue
        setTimeout(() => navigateToApp(), 1200);
      } else {
        Alert.alert(
          'Permission refusée',
          'Vous pourrez connecter votre calendrier plus tard depuis votre profil.',
          [{ text: 'OK', onPress: () => navigateToApp() }]
        );
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const navigateToApp = async () => {
    await AsyncStorage.setItem('onboarding_completed', 'true');
    router.replace('/(tabs)');
  };

  const BENEFITS = [
    { icon: 'search-outline', text: 'Détection automatique des conflits avec vos tournois' },
    { icon: 'sync-outline', text: 'Synchronisation en temps réel (Apple / Google / Outlook)' },
    { icon: 'shield-checkmark-outline', text: 'Vos données restent privées — jamais partagées avec votre staff' },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <OnboardingProgressBar currentStep={8} totalSteps={8} />

      <View style={styles.content}>
        {/* Illustration */}
        <LinearGradient
          colors={['#EEF2FF', '#DBEAFE']}
          style={styles.illustrationWrap}
        >
          {connected ? (
            <Ionicons name="checkmark-circle" size={64} color="#16A34A" />
          ) : (
            <Ionicons name="calendar" size={64} color="#1e3c72" />
          )}
        </LinearGradient>

        {connected ? (
          <>
            <Text style={styles.title}>Calendrier connecté ✅</Text>
            <Text style={styles.subtitle}>
              Vos événements sont en cours d'importation…
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.title}>Connecter votre calendrier</Text>
            <Text style={styles.subtitle}>
              Importez vos événements existants et gardez tout synchronisé automatiquement.
            </Text>
          </>
        )}

        {/* Bénéfices */}
        {!connected && (
          <View style={styles.benefits}>
            {BENEFITS.map((b, i) => (
              <View key={i} style={styles.benefitRow}>
                <View style={styles.benefitIcon}>
                  <Ionicons name={b.icon as any} size={18} color="#1e3c72" />
                </View>
                <Text style={styles.benefitText}>{b.text}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Actions */}
      {!connected && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 24 }]}>
          <TouchableOpacity
            style={[styles.connectBtn, isConnecting && styles.connectBtnDisabled]}
            onPress={handleConnect}
            disabled={isConnecting}
          >
            {isConnecting ? (
              <ActivityIndicator color={COLORS.white} size="small" />
            ) : (
              <>
                <Ionicons name="calendar-outline" size={20} color={COLORS.white} />
                <Text style={styles.connectBtnText}>Connecter mon calendrier</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.skipBtn}
            onPress={navigateToApp}
            disabled={isConnecting}
          >
            <Text style={styles.skipText}>Passer cette étape</Text>
          </TouchableOpacity>

          <Text style={styles.hint}>
            Vous pourrez activer cette option à tout moment dans votre profil.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    alignItems: 'center',
  },
  illustrationWrap: {
    width: 120,
    height: 120,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textLight,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 8,
  },
  benefits: {
    width: '100%',
    gap: 14,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  benefitIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
    paddingTop: 7,
  },
  footer: {
    paddingHorizontal: 24,
    gap: 12,
  },
  connectBtn: {
    backgroundColor: '#1e3c72',
    borderRadius: 14,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  connectBtnDisabled: {
    opacity: 0.6,
  },
  connectBtnText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
  skipBtn: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipText: {
    fontSize: 15,
    color: COLORS.textLight,
    fontWeight: '500',
  },
  hint: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    lineHeight: 17,
  },
});
