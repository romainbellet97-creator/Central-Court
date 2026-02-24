import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import Colors from '../src/constants/colors';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, isLoading, isAuthenticated, login, loginStaff } = useAuth();
  
  // Staff login form
  const [showStaffLogin, setShowStaffLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user) {
      // Redirect based on role
      if (user.role !== 'player' && user.isStaff) {
        router.replace('/(staff)/dashboard');
      } else {
        router.replace('/(player)/');
      }
    }
  }, [isAuthenticated, user]);

  const handleStaffLogin = async () => {
    if (!email.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer votre email');
      return;
    }
    if (!password) {
      Alert.alert('Erreur', 'Veuillez entrer votre mot de passe');
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await loginStaff(email.trim(), password);
      if (success) {
        router.replace('/(staff)/dashboard');
      } else {
        Alert.alert('Erreur', 'Email ou mot de passe incorrect');
      }
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de se connecter');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <LinearGradient colors={['#1e3c72', '#2a5298']} style={styles.container}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Chargement...</Text>
      </LinearGradient>
    );
  }

  // Staff login form view
  if (showStaffLogin) {
    return (
      <LinearGradient colors={['#1e3c72', '#2a5298']} style={styles.container}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView 
            contentContainerStyle={[styles.staffLoginContent, { paddingTop: insets.top + 40 }]}
            keyboardShouldPersistTaps="handled"
          >
            {/* Back button */}
            <TouchableOpacity 
              style={styles.backButton} 
              onPress={() => setShowStaffLogin(false)}
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
              <Text style={styles.backButtonText}>Retour</Text>
            </TouchableOpacity>

            {/* Header */}
            <View style={styles.staffLoginHeader}>
              <View style={styles.staffLogoCircle}>
                <Ionicons name="people" size={40} color="#fff" />
              </View>
              <Text style={styles.staffLoginTitle}>Connexion Staff</Text>
              <Text style={styles.staffLoginSubtitle}>
                Connectez-vous avec vos identifiants d'équipe
              </Text>
            </View>

            {/* Form */}
            <View style={styles.formContainer}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Email</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="mail-outline" size={20} color="#6B7280" style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="votre@email.com"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Mot de passe</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="lock-closed-outline" size={20} color="#6B7280" style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="••••••••"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    placeholderTextColor="#9CA3AF"
                  />
                  <TouchableOpacity 
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.showPasswordBtn}
                  >
                    <Ionicons 
                      name={showPassword ? "eye-off-outline" : "eye-outline"} 
                      size={20} 
                      color="#6B7280" 
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.staffLoginButton, isSubmitting && styles.buttonDisabled]}
                onPress={handleStaffLogin}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="log-in-outline" size={22} color="#fff" />
                    <Text style={styles.staffLoginButtonText}>Se connecter</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <Text style={styles.staffLoginNote}>
              Vous avez reçu une invitation par email ?{'\n'}
              Utilisez le lien de l'invitation pour créer votre compte.
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    );
  }

  // Main login view
  return (
    <LinearGradient colors={['#1e3c72', '#2a5298']} style={styles.container}>
      <View style={[styles.content, { paddingTop: insets.top + 60 }]}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <Ionicons name="tennisball" size={60} color="#fff" />
          </View>
          <Text style={styles.appName}>Le Court Central</Text>
          <Text style={styles.tagline}>Gérez votre carrière de tennis professionnel</Text>
        </View>

        {/* Features */}
        <View style={styles.features}>
          <View style={styles.featureItem}>
            <Ionicons name="calendar" size={24} color="#fff" />
            <Text style={styles.featureText}>Calendrier unifié</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="people" size={24} color="#fff" />
            <Text style={styles.featureText}>Gestion d'équipe</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="globe" size={24} color="#fff" />
            <Text style={styles.featureText}>Suivi fiscal 183 jours</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="folder" size={24} color="#fff" />
            <Text style={styles.featureText}>Coffre-fort documents</Text>
          </View>
        </View>

        {/* Login Section */}
        <View style={styles.loginSection}>
          {/* Player login (Google) */}
          <TouchableOpacity style={styles.googleButton} onPress={login}>
            <Ionicons name="logo-google" size={22} color="#333" />
            <Text style={styles.googleButtonText}>Joueur — Connexion Google</Text>
          </TouchableOpacity>

          {/* Staff login */}
          <TouchableOpacity 
            style={styles.staffButton} 
            onPress={() => setShowStaffLogin(true)}
          >
            <Ionicons name="people-outline" size={22} color="#fff" />
            <Text style={styles.staffButtonText}>Staff — Connexion Email</Text>
          </TouchableOpacity>

          <Text style={styles.disclaimer}>
            En continuant, vous acceptez nos conditions d'utilisation
          </Text>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 24,
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  appName: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  tagline: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginTop: 8,
  },
  features: {
    marginBottom: 48,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  featureText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  loginSection: {
    marginTop: 'auto',
    marginBottom: 40,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#fff',
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  googleButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
  },
  staffButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  staffButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  disclaimer: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginTop: 16,
  },
  // Staff login form styles
  keyboardView: {
    flex: 1,
    width: '100%',
  },
  staffLoginContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 32,
  },
  backButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  staffLoginHeader: {
    alignItems: 'center',
    marginBottom: 40,
  },
  staffLogoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  staffLoginTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  staffLoginSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginTop: 8,
  },
  formContainer: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1F2937',
  },
  showPasswordBtn: {
    padding: 4,
  },
  staffLoginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#4A9B8E',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  staffLoginButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  staffLoginNote: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: 20,
  },
});
