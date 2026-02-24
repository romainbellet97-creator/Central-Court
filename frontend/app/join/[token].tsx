import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useAuth } from '../../src/context/AuthContext';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const api = axios.create({ baseURL: API_URL });

// Color palette
const Colors = {
  background: {
    primary: '#0D0D0D',
    secondary: '#1A1A1A',
    tertiary: '#242424',
    card: '#1E1E1E',
  },
  accent: {
    primary: '#00D09E',
    secondary: '#00A67E',
    tertiary: '#008F6B',
    muted: 'rgba(0, 208, 158, 0.15)',
  },
  text: {
    primary: '#FFFFFF',
    secondary: '#A0A0A0',
    muted: '#666666',
    inverse: '#0D0D0D',
  },
  status: {
    success: '#00D09E',
    error: '#FF6B6B',
    warning: '#FFB347',
  },
  border: '#2D2D2D',
};

const ROLE_LABELS: Record<string, string> = {
  tennis_coach: 'Entraîneur Tennis',
  physical_coach: 'Préparateur Physique',
  physio: 'Kinésithérapeute',
  agent: 'Agent',
  family: 'Famille',
  other: 'Membre de l\'équipe',
};

interface Invitation {
  id: string;
  token: string;
  playerName: string;
  inviteeEmail: string;
  inviteeName?: string;
  role: string;
  status: string;
  expiresAt: string;
}

export default function JoinScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { setUserFromStaffSignup } = useAuth();
  
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  useEffect(() => {
    if (token) {
      loadInvitation();
    } else {
      setError('Lien d\'invitation invalide');
      setIsLoading(false);
    }
  }, [token]);
  
  const loadInvitation = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Get invitation details
      const response = await api.get(`/api/invitations/token/${token}`);
      const inv = response.data;
      
      setInvitation(inv);
      
      // Pre-fill name if available
      if (inv.inviteeName) {
        const parts = inv.inviteeName.split(' ');
        setFirstName(parts[0] || '');
        setLastName(parts.slice(1).join(' ') || '');
      }
      
      // Mark as viewed
      await api.post(`/api/invitations/token/${token}/view`);
      
      // Check status
      if (inv.status === 'expired') {
        setError('Cette invitation a expiré. Demandez au joueur de vous renvoyer une nouvelle invitation.');
      } else if (inv.status === 'accepted') {
        setError('Cette invitation a déjà été utilisée. Vous pouvez vous connecter à l\'app.');
      } else if (inv.status === 'cancelled') {
        setError('Cette invitation a été annulée.');
      }
      
    } catch (err: any) {
      console.error('Error loading invitation:', err);
      setError(err.response?.data?.detail || 'Invitation non trouvée');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSignup = async () => {
    // Validation
    if (!firstName.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer votre prénom');
      return;
    }
    
    if (!password) {
      Alert.alert('Erreur', 'Veuillez entrer un mot de passe');
      return;
    }
    
    if (password.length < 6) {
      Alert.alert('Erreur', 'Le mot de passe doit contenir au moins 6 caractères');
      return;
    }
    
    if (password !== confirmPassword) {
      Alert.alert('Erreur', 'Les mots de passe ne correspondent pas');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const response = await api.post('/api/invitations/signup', {
        invitationToken: token,
        firstName: firstName.trim(),
        lastName: lastName.trim() || null,
        phone: phone.trim() || null,
        password,
      });
      
      // Store auth token and staff data for staff authentication
      if (response.data.authToken) {
        await AsyncStorage.setItem('staff_token', response.data.authToken);
        await AsyncStorage.setItem('staff_data', JSON.stringify(response.data.staff));
        
        // Also store session token for AuthContext compatibility
        await AsyncStorage.setItem('session_token', response.data.authToken);
        
        // Store user data in the format expected by AuthContext
        const staffData = response.data.staff;
        const userData = {
          user_id: staffData.id,
          name: `${staffData.firstName} ${staffData.lastName || ''}`.trim(),
          firstName: staffData.firstName,
          lastName: staffData.lastName,
          email: staffData.email,
          role: staffData.role, // 'agent', 'medical', 'technical', etc.
          player_id: staffData.playerId, // ID du joueur associé
          isStaff: true,
        };
        await AsyncStorage.setItem('user_data', JSON.stringify(userData));
      }
      
      Alert.alert(
        'Bienvenue ! 🎾',
        `Vous avez rejoint l'équipe de ${invitation?.playerName}`,
        [
          {
            text: 'Continuer',
            onPress: () => {
              // Navigate to staff dashboard
              router.replace('/(staff)/dashboard');
            }
          }
        ]
      );
      
    } catch (err: any) {
      console.error('Signup error:', err);
      Alert.alert(
        'Erreur',
        err.response?.data?.detail || 'Impossible de créer votre compte'
      );
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={Colors.accent.primary} />
          <Text style={styles.loadingText}>Chargement de l'invitation...</Text>
        </View>
      </View>
    );
  }
  
  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          <View style={styles.errorIcon}>
            <Ionicons name="alert-circle" size={64} color={Colors.status.error} />
          </View>
          <Text style={styles.errorTitle}>Oops !</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => router.replace('/')}
          >
            <Text style={styles.retryButtonText}>Retour à l'accueil</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
  
  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Ionicons name="tennisball" size={48} color={Colors.accent.primary} />
          </View>
          <Text style={styles.title}>Rejoindre l'équipe</Text>
          <Text style={styles.subtitle}>
            {invitation?.playerName} vous invite à rejoindre son équipe
          </Text>
        </View>
        
        {/* Role Badge */}
        <View style={styles.roleBadge}>
          <Ionicons 
            name={getRoleIcon(invitation?.role || 'other')} 
            size={20} 
            color={Colors.accent.primary} 
          />
          <Text style={styles.roleText}>
            {ROLE_LABELS[invitation?.role || 'other']}
          </Text>
        </View>
        
        {/* Email Display */}
        <View style={styles.emailContainer}>
          <Text style={styles.emailLabel}>Email d'invitation</Text>
          <Text style={styles.emailValue}>{invitation?.inviteeEmail}</Text>
        </View>
        
        {/* Form */}
        <View style={styles.form}>
          <View style={styles.inputRow}>
            <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.inputLabel}>Prénom *</Text>
              <TextInput
                style={styles.input}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Votre prénom"
                placeholderTextColor={Colors.text.muted}
                autoCapitalize="words"
              />
            </View>
            <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.inputLabel}>Nom</Text>
              <TextInput
                style={styles.input}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Votre nom"
                placeholderTextColor={Colors.text.muted}
                autoCapitalize="words"
              />
            </View>
          </View>
          
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Téléphone</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="+33 6 12 34 56 78"
              placeholderTextColor={Colors.text.muted}
              keyboardType="phone-pad"
            />
          </View>
          
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Mot de passe *</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                value={password}
                onChangeText={setPassword}
                placeholder="Minimum 6 caractères"
                placeholderTextColor={Colors.text.muted}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons 
                  name={showPassword ? 'eye-off' : 'eye'} 
                  size={20} 
                  color={Colors.text.secondary} 
                />
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Confirmer le mot de passe *</Text>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Répétez le mot de passe"
              placeholderTextColor={Colors.text.muted}
              secureTextEntry={!showPassword}
            />
          </View>
        </View>
        
        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
          onPress={handleSignup}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color={Colors.text.inverse} />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color={Colors.text.inverse} />
              <Text style={styles.submitButtonText}>Rejoindre l'équipe</Text>
            </>
          )}
        </TouchableOpacity>
        
        {/* Footer */}
        <Text style={styles.footerText}>
          En vous inscrivant, vous acceptez de partager certaines informations avec {invitation?.playerName}.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function getRoleIcon(role: string): keyof typeof Ionicons.glyphMap {
  const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
    tennis_coach: 'tennisball',
    physical_coach: 'fitness',
    physio: 'medkit',
    agent: 'briefcase',
    family: 'people',
    other: 'person',
  };
  return icons[role] || 'person';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 60,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.text.secondary,
  },
  errorIcon: {
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: Colors.accent.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: Colors.text.inverse,
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.accent.muted,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent.muted,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'center',
    marginBottom: 24,
  },
  roleText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.accent.primary,
  },
  emailContainer: {
    backgroundColor: Colors.background.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  emailLabel: {
    fontSize: 12,
    color: Colors.text.muted,
    marginBottom: 4,
  },
  emailValue: {
    fontSize: 16,
    color: Colors.text.primary,
    fontWeight: '500',
  },
  form: {
    marginBottom: 24,
  },
  inputRow: {
    flexDirection: 'row',
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.secondary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.background.tertiary,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: Colors.text.primary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  passwordContainer: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 50,
  },
  eyeButton: {
    position: 'absolute',
    right: 16,
    top: 16,
  },
  submitButton: {
    backgroundColor: Colors.accent.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.inverse,
  },
  footerText: {
    fontSize: 12,
    color: Colors.text.muted,
    textAlign: 'center',
    lineHeight: 18,
  },
});
