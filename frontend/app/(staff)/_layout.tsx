import React, { useEffect, useState, useCallback } from 'react';
import { Tabs } from 'expo-router';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Platform, View, Text } from 'react-native';
import { useAuth } from '../../src/context/AuthContext';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL ||
                process.env.EXPO_PUBLIC_BACKEND_URL || '';

async function getStoredToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return typeof localStorage !== 'undefined' ? localStorage.getItem('session_token') : null;
    return await SecureStore.getItemAsync('session_token');
  } catch { return null; }
}

export default function StaffTabLayout() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnread = useCallback(async () => {
    try {
      const token = await getStoredToken();
      if (!token) return;
      const res = await fetch(`${API_URL}/api/alerts?unread_only=true`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(Array.isArray(data) ? data.length : 0);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (user && user.role !== 'player') {
      refreshUnread();
      const interval = setInterval(refreshUnread, 30000);
      return () => clearInterval(interval);
    }
  }, [user, refreshUnread]);

  // Guard: redirect players to their app
  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (user.role === 'player') {
      router.replace('/(player)/');
    }
  }, [user, isLoading]);

  // Don't render tabs if player or not authenticated
  if (!user || user.role === 'player') {
    return null;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: '#4A9B8E',
        tabBarInactiveTintColor: '#6b7a8d',
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Accueil',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendrier',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="documents"
        options={{
          title: 'Documents',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="folder-open" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="player-info"
        options={{
          title: 'Joueur',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Alertes',
          tabBarIcon: ({ color, size }) => (
            <View>
              <Ionicons name="notifications" size={size} color={color} />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#1a2744',
    borderTopWidth: 0,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    height: Platform.OS === 'ios' ? 88 : 64,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: '#EF4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
});
