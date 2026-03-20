import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_URL || '';

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) { setError('Veuillez remplir tous les champs'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(res.status === 401 ? '401' : 'error');
      await AsyncStorage.setItem('admin_token', data.token);
      await AsyncStorage.setItem('admin_user', JSON.stringify(data.user));
      router.replace('/admin');
    } catch (e: any) {
      setError(e.message === '401' ? 'Email ou mot de passe incorrect' : 'Erreur de connexion. Réessayez.');
    } finally { setLoading(false); }
  };

  return (
    <View style={s.container}>
      <View style={s.card}>
        <Text style={s.emoji}>🎾</Text>
        <Text style={s.title}>LE COURT CENTRAL</Text>
        <Text style={s.subtitle}>Tableau de bord administrateur</Text>
        {error ? <Text style={s.error}>{error}</Text> : null}
        <TextInput style={s.input} placeholder="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholderTextColor="#9CA3AF" />
        <TextInput style={s.input} placeholder="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry placeholderTextColor="#9CA3AF" />
        <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.btnText}>Se connecter</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F5EB', justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 32, width: '100%', maxWidth: 400, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  emoji: { fontSize: 48, marginBottom: 12 },
  title: { fontSize: 24, fontWeight: '800', color: '#2D5016', letterSpacing: 1 },
  subtitle: { fontSize: 14, color: '#6B7280', marginTop: 4, marginBottom: 24 },
  error: { color: '#EF4444', fontSize: 13, marginBottom: 12, textAlign: 'center' },
  input: { width: '100%', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, marginBottom: 12, color: '#111827', backgroundColor: '#F9FAFB' },
  btn: { width: '100%', backgroundColor: '#2D5016', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
