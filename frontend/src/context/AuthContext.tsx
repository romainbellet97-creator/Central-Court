import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { getSessionToken, setSessionToken, removeSessionToken } from '../utils/tokenStorage';
import { API_BASE_URL } from '../utils/apiUrl';

export interface User {
  user_id: string;
  email: string;
  name: string;
  picture?: string;
  role: 'player' | 'agent' | 'medical' | 'technical' | 'logistics';
  player_id?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => Promise<void>;
  loginWithInvitation: (invitationCode: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = API_BASE_URL;

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
