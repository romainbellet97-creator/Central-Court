import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000';
const ADMIN_TOKEN_KEY = 'admin_token';

export async function adminFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await AsyncStorage.getItem(ADMIN_TOKEN_KEY);
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (res.status === 401) {
    await AsyncStorage.removeItem(ADMIN_TOKEN_KEY);
    throw new Error('401');
  }
  if (!res.ok) {
    const text = await res.text().catch(() => 'Erreur inconnue');
    throw new Error(text);
  }
  return res.json();
}
