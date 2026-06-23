import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useAuth } from '../../src/context/AuthContext';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const api = axios.create({ baseURL: API_URL });

const Colors = {
  bg: '#F8F9FA',
  card: '#FFFFFF',
  primary: '#2D5016',
  primaryLight: 'rgba(45,80,22,0.08)',
  accent: '#4A9B8E',
  text: '#1a1a1a',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',
  border: '#e5e7eb',
  borderFocus: '#2D5016',
  error: '#EF4444',
  errorBg: '#FEF2F2',
  success: '#16A34A',
  successBg: '#F0FDF4',
};

const ROLE_LABELS: Record<string, string> = {
  tennis_coach: 'Entraîneur Tennis',
  physical_coach: 'Préparateur Physique',
  physio: 'Kinésithérapeute',
  agent: 'Agent',
  family: 'Famille',
  other: "Membre de l'équipe",
};

function getRoleIcon(role: string): keyof typeof Ionicons.glyphMap {
  const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
    tennis_coach: 'tennisball-outline',
    physical_coach: 'fitness-outline',
    physio: 'medkit-outline',
    agent: 'briefcase-outline',
    family: 'people-outline',
    other: 'person-outline',
  };
  return icons[role] || 'person-outline';
}

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
  const [pageError, setPageError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const successAnim = useRef(new Animated.Value(0)).current;

  // Form fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Inline field errors
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [focusedField, setFocusedField] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      loadInvitation();
    } else {
      setPageError("Lien d'invitation invalide");
      setIsLoading(false);
    }
  }, [token]);

  const loadInvitation = async () => {
    try {
      setIsLoading(true);
      setPageError(null);

      const response = await api.get(`/api/invitations/token/${token}`);
      const inv = response.data;
      setInvitation(inv);

      if (inv.inviteeName) {
        const parts = inv.inviteeName.split(' ');
        setFirstName(parts[0] || '');
        setLastName(parts.slice(1).join(' ') || '');
      }

      await api.post(`/api/invitations/token/${token}/view`).catch(() => {});

      if (inv.status === 'expired') {
        setPageError(
          "Cette invitation a expiré. Demandez au joueur de vous renvoyer une invitation."
        );
      } else if (inv.status === 'accepted') {
        setPageError(
          "Cette invitation a déjà été utilisée. Vous pouvez vous connecter directement."
        );
      } else if (inv.status === 'cancelled') {
        setPageError("Cette invitation a été annulée.");
      }
    } catch (err: any) {
      setPageError(err.response?.data?.detail || 'Invitation non trouvée ou lien invalide.');
    } finally {
      setIsLoading(false);
    }
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!firstName.trim()) errors.firstName = 'Le prénom est requis';
    if (!password) errors.password = 'Le mot de passe est requis';
    else if (password.length < 6) errors.password = 'Minimum 6 caractères';
    if (!confirmPassword) errors.confirmPassword = 'Confirmez votre mot de passe';
    else if (password !== confirmPassword) errors.confirmPassword = 'Les mots de passe ne correspondent pas';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSignup = async () => {
    setApiError(null);
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const response = await api.post('/api/invitations/signup', {
        invitationToken: token,
        firstName: firstName.trim(),
        lastName: lastName.trim() || null,
        phone: phone.trim() || null,
        password,
      });

      if (response.data.authToken && response.data.staff) {
        const staffData = response.data.staff;
        await setUserFromStaffSignup(
          {
            user_id: staffData.id,
            name: `${staffData.firstName} ${staffData.lastName || ''}`.trim(),
            firstName: staffData.firstName,
            lastName: staffData.lastName,
            email: staffData.email,
            role: staffData.role,
            player_id: staffData.playerId,
            playerIds: staffData.playerIds,
            isStaff: true,
          },
          response.data.authToken
        );
      }

      // Show success screen, then navigate (no Alert.alert — doesn't work on web)
      setShowSuccess(true);
      Animated.spring(successAnim, {
        toValue: 1,
        friction: 5,
        useNativeDriver: Platform.OS !== 'web',
      }).start();

      setTimeout(() => {
        router.replace('/(staff)/dashboard');
      }, 2200);
    } catch (err: any) {
      setApiError(
        err.response?.data?.detail || "Impossible de créer votre compte. Veuillez réessayer."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={styles.centeredScreen}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Chargement de l'invitation…</Text>
      </View>
    );
  }

  // ─── Page-level error (expired / already used / not found) ──────────────────
  if (pageError) {
    const isAccepted = invitation?.status === 'accepted';
    return (
      <View style={styles.centeredScreen}>
        <View style={[styles.errorIconWrap, isAccepted && styles.successIconWrap]}>
          <Ionicons
            name={isAccepted ? 'checkmark-circle-outline' : 'alert-circle-outline'}
            size={56}
            color={isAccepted ? Colors.success : Colors.error}
          />
        </View>
        <Text style={styles.errorTitle}>{isAccepted ? 'Déjà inscrit' : 'Invitation invalide'}</Text>
        <Text style={styles.errorMessage}>{pageError}</Text>
        {isAccepted && (
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/login')}>
            <Text style={styles.primaryBtnText}>Se connecter</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.ghostBtn, isAccepted && { marginTop: 10 }]}
          onPress={() => router.replace('/')}
        >
          <Text style={styles.ghostBtnText}>Retour à l'accueil</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── Success screen ─────────────────────────────────────────────────────────
  if (showSuccess) {
    return (
      <View style={[styles.centeredScreen, { backgroundColor: Colors.successBg }]}>
        <Animated.View
          style={{
            alignItems: 'center',
            transform: [
              {
                scale: successAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.6, 1],
                }),
              },
            ],
            opacity: successAnim,
          }}
        >
          <View style={styles.successCircle}>
            <Ionicons name="checkmark" size={52} color="#fff" />
          </View>
          <Text style={styles.successTitle}>Bienvenue dans l'équipe !</Text>
          <Text style={styles.successSubtitle}>
            Vous avez rejoint l'équipe de{'\n'}
            <Text style={{ fontWeight: '700', color: Colors.primary }}>
              {invitation?.playerName}
            </Text>
          </Text>
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 24 }} />
          <Text style={{ color: Colors.textMuted, marginTop: 8, fontSize: 13 }}>
            Redirection vers votre espace…
          </Text>
        </Animated.View>
      </View>
    );
  }

  // ─── Main form ──────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoWrap}>
            <Ionicons name="tennisball" size={36} color={Colors.primary} />
          </View>
          <Text style={styles.title}>Rejoindre l'équipe</Text>
          <Text style={styles.subtitle}>
            <Text style={{ fontWeight: '600', color: Colors.primary }}>
              {invitation?.playerName}
            </Text>{' '}
            vous invite à rejoindre son équipe
          </Text>
        </View>

        {/* Role badge */}
        <View style={styles.roleBadge}>
          <Ionicons
            name={getRoleIcon(invitation?.role || 'other')}
            size={16}
            color={Colors.primary}
          />
          <Text style={styles.roleText}>
            {ROLE_LABELS[invitation?.role || 'other']}
          </Text>
        </View>

        {/* Email */}
        <View style={styles.emailRow}>
          <Ionicons name="mail-outline" size={16} color={Colors.textSecondary} />
          <Text style={styles.emailText}>{invitation?.inviteeEmail}</Text>
        </View>

        {/* API error banner */}
        {apiError && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={18} color={Colors.error} />
            <Text style={styles.errorBannerText}>{apiError}</Text>
          </View>
        )}

        {/* Form */}
        <View style={styles.form}>
          {/* First name + Last name */}
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Prénom *</Text>
              <TextInput
                style={[
                  styles.input,
                  focusedField === 'firstName' && styles.inputFocused,
                  fieldErrors.firstName ? styles.inputError : null,
                ]}
                value={firstName}
                onChangeText={v => {
                  setFirstName(v);
                  if (fieldErrors.firstName) setFieldErrors(e => ({ ...e, firstName: '' }));
                }}
                placeholder="Prénom"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="words"
                onFocus={() => setFocusedField('firstName')}
                onBlur={() => setFocusedField(null)}
              />
              {fieldErrors.firstName ? (
                <Text style={styles.fieldError}>{fieldErrors.firstName}</Text>
              ) : null}
            </View>
            <View style={{ width: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Nom</Text>
              <TextInput
                style={[styles.input, focusedField === 'lastName' && styles.inputFocused]}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Nom"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="words"
                onFocus={() => setFocusedField('lastName')}
                onBlur={() => setFocusedField(null)}
              />
            </View>
          </View>

          {/* Phone */}
          <View>
            <Text style={styles.label}>Téléphone</Text>
            <TextInput
              style={[styles.input, focusedField === 'phone' && styles.inputFocused]}
              value={phone}
              onChangeText={setPhone}
              placeholder="+33 6 12 34 56 78"
              placeholderTextColor={Colors.textMuted}
              keyboardType="phone-pad"
              onFocus={() => setFocusedField('phone')}
              onBlur={() => setFocusedField(null)}
            />
          </View>

          {/* Password */}
          <View>
            <Text style={styles.label}>Mot de passe *</Text>
            <View style={styles.passwordWrap}>
              <TextInput
                style={[
                  styles.input,
                  styles.passwordInput,
                  focusedField === 'password' && styles.inputFocused,
                  fieldErrors.password ? styles.inputError : null,
                ]}
                value={password}
                onChangeText={v => {
                  setPassword(v);
                  if (fieldErrors.password) setFieldErrors(e => ({ ...e, password: '' }));
                }}
                placeholder="Minimum 6 caractères"
                placeholderTextColor={Colors.textMuted}
                secureTextEntry={!showPassword}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowPassword(v => !v)}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={Colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
            {fieldErrors.password ? (
              <Text style={styles.fieldError}>{fieldErrors.password}</Text>
            ) : null}
          </View>

          {/* Confirm password */}
          <View>
            <Text style={styles.label}>Confirmer le mot de passe *</Text>
            <TextInput
              style={[
                styles.input,
                focusedField === 'confirmPassword' && styles.inputFocused,
                fieldErrors.confirmPassword ? styles.inputError : null,
              ]}
              value={confirmPassword}
              onChangeText={v => {
                setConfirmPassword(v);
                if (fieldErrors.confirmPassword)
                  setFieldErrors(e => ({ ...e, confirmPassword: '' }));
              }}
              placeholder="Répétez le mot de passe"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry={!showPassword}
              onFocus={() => setFocusedField('confirmPassword')}
              onBlur={() => setFocusedField(null)}
            />
            {fieldErrors.confirmPassword ? (
              <Text style={styles.fieldError}>{fieldErrors.confirmPassword}</Text>
            ) : null}
          </View>
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
          onPress={handleSignup}
          disabled={isSubmitting}
          activeOpacity={0.85}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
              <Text style={styles.submitBtnText}>Rejoindre l'équipe</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Already have an account */}
        <TouchableOpacity style={styles.loginLink} onPress={() => router.replace('/login')}>
          <Text style={styles.loginLinkText}>
            Déjà un compte ?{' '}
            <Text style={{ color: Colors.primary, fontWeight: '600' }}>Se connecter</Text>
          </Text>
        </TouchableOpacity>

        <Text style={styles.footer}>
          En vous inscrivant, vous acceptez de partager vos informations avec{' '}
          {invitation?.playerName}.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 40,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  centeredScreen: {
    flex: 1,
    backgroundColor: Colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    color: Colors.textSecondary,
  },

  // Error / invalid invitation
  errorIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.errorBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  successIconWrap: {
    backgroundColor: Colors.successBg,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
    maxWidth: 320,
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 10,
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  ghostBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  ghostBtnText: {
    color: Colors.textSecondary,
    fontSize: 15,
  },

  // Success
  successCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: Colors.success,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 10,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },

  // Form header
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Role badge
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    gap: 6,
    marginBottom: 12,
  },
  roleText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },

  // Email display
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 20,
    backgroundColor: Colors.card,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emailText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },

  // API error banner
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: Colors.errorBg,
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorBannerText: {
    flex: 1,
    fontSize: 14,
    color: Colors.error,
    lineHeight: 20,
  },

  // Form fields
  form: {
    gap: 14,
    marginBottom: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.card,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    fontSize: 15,
    color: Colors.text,
  },
  inputFocused: {
    borderColor: Colors.borderFocus,
  },
  inputError: {
    borderColor: Colors.error,
  },
  fieldError: {
    marginTop: 4,
    fontSize: 12,
    color: Colors.error,
  },
  passwordWrap: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 48,
  },
  eyeBtn: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    padding: 4,
  },

  // Submit
  submitBtn: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 14,
  },
  submitBtnDisabled: {
    opacity: 0.65,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },

  // Login link
  loginLink: {
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 16,
  },
  loginLinkText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },

  footer: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
});
