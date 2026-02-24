import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

export interface User {
  user_id: string;
  email: string;
  name: string;
  picture?: string;
  role: 'player' | 'agent' | 'medical' | 'technical' | 'logistics' | 'family';
  player_id?: string;
  isStaff?: boolean;
  firstName?: string;
  lastName?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => Promise<void>;
  loginWithInvitation: (invitationCode: string) => Promise<void>;
  loginStaff: (email: string, password: string) => Promise<boolean>;
  setUserFromStaffSignup: (userData: User, token: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || 
                process.env.EXPO_PUBLIC_BACKEND_URL || 
                '';

// Helper to get/set session token
const getSessionToken = async (): Promise<string | null> => {
  if (Platform.OS === 'web') {
    return localStorage.getItem('session_token');
  }
  return await SecureStore.getItemAsync('session_token');
};

const setSessionToken = async (token: string): Promise<void> => {
  if (Platform.OS === 'web') {
    localStorage.setItem('session_token', token);
  } else {
    await SecureStore.setItemAsync('session_token', token);
  }
};

const removeSessionToken = async (): Promise<void> => {
  if (Platform.OS === 'web') {
    localStorage.removeItem('session_token');
  } else {
    await SecureStore.deleteItemAsync('session_token');
  }
};

// Parse session_id from URL
const parseSessionIdFromUrl = (url: string): string | null => {
  try {
    // Check hash fragment first (#session_id=...)
    const hashMatch = url.match(/[#&]session_id=([^&]+)/);
    if (hashMatch) return hashMatch[1];
    
    // Check query string (?session_id=...)
    const queryMatch = url.match(/[?&]session_id=([^&#]+)/);
    if (queryMatch) return queryMatch[1];
    
    return null;
  } catch {
    return null;
  }
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingInvitation, setPendingInvitation] = useState<string | null>(null);

  // Check existing session on mount
  useEffect(() => {
    checkExistingSession();
    
    // Handle deep links on web
    if (Platform.OS === 'web') {
      const hash = window.location.hash;
      const sessionId = parseSessionIdFromUrl(window.location.href);
      if (sessionId) {
        handleSessionExchange(sessionId);
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  const checkExistingSession = async () => {
    try {
      const token = await getSessionToken();
      if (!token) {
        setIsLoading(false);
        return;
      }

      const response = await fetch(`${API_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        await removeSessionToken();
      }
    } catch (error) {
      console.error('Session check error:', error);
      await removeSessionToken();
    } finally {
      setIsLoading(false);
    }
  };

  const handleSessionExchange = async (sessionId: string, invitationCode?: string) => {
    setIsLoading(true);
    try {
      let endpoint = `${API_URL}/api/auth/exchange-session`;
      let body: any = { session_id: sessionId };

      if (invitationCode) {
        endpoint = `${API_URL}/api/auth/register-with-invitation`;
        body = { session_id: sessionId, invitation_code: invitationCode };
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        const data = await response.json();
        await setSessionToken(data.session_token);
        setUser(data.user);
        setPendingInvitation(null);
      } else {
        const error = await response.json();
        console.error('Session exchange error:', error);
        throw new Error(error.detail || 'Authentication failed');
      }
    } catch (error) {
      console.error('Session exchange error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const login = async () => {
    setIsLoading(true);
    try {
      // Build redirect URL based on platform
      const redirectUrl = Platform.OS === 'web'
        ? window.location.origin + '/'
        : Linking.createURL('/');

      const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;

      if (Platform.OS === 'web') {
        // On web, just redirect
        window.location.href = authUrl;
      } else {
        // On mobile, use WebBrowser
        const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
        
        if (result.type === 'success' && result.url) {
          const sessionId = parseSessionIdFromUrl(result.url);
          if (sessionId) {
            if (pendingInvitation) {
              await handleSessionExchange(sessionId, pendingInvitation);
            } else {
              await handleSessionExchange(sessionId);
            }
          }
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      setIsLoading(false);
    }
  };

  const loginWithInvitation = async (invitationCode: string) => {
    setPendingInvitation(invitationCode);
    await login();
  };

  // Login staff member with email/password
  const loginStaff = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/staff-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (response.ok) {
        const data = await response.json();
        await setSessionToken(data.session_token);
        setUser(data.user);
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.error('Staff login error:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Set user after staff signup (no API call needed, data already available)
  const setUserFromStaffSignup = async (userData: User, token: string): Promise<void> => {
    await setSessionToken(token);
    setUser(userData);
  };

  const logout = async () => {
    try {
      const token = await getSessionToken();
      if (token) {
        await fetch(`${API_URL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      await removeSessionToken();
      setUser(null);
    }
  };

  const refreshUser = async () => {
    await checkExistingSession();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        loginWithInvitation,
        loginStaff,
        setUserFromStaffSignup,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
