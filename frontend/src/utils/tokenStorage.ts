/**
 * Unified token storage.
 * Mobile: expo-secure-store (iOS Keychain / Android Keystore — encrypted at hardware level)
 * Web:    localStorage (no SecureStore support in browsers)
 */
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const SESSION_TOKEN_KEY = 'session_token';

export const getSessionToken = async (): Promise<string | null> => {
  if (Platform.OS === 'web') return localStorage.getItem(SESSION_TOKEN_KEY);
  return SecureStore.getItemAsync(SESSION_TOKEN_KEY);
};

export const setSessionToken = async (token: string): Promise<void> => {
  if (Platform.OS === 'web') {
    localStorage.setItem(SESSION_TOKEN_KEY, token);
    return;
  }
  await SecureStore.setItemAsync(SESSION_TOKEN_KEY, token);
};

export const removeSessionToken = async (): Promise<void> => {
  if (Platform.OS === 'web') {
    localStorage.removeItem(SESSION_TOKEN_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
};
