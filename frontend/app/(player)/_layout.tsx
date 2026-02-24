import React, { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Platform } from 'react-native';
import Colors from '../../src/constants/colors';
import { useAuth } from '../../src/context/AuthContext';

export default function PlayerTabLayout() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  // Guard: redirect staff to their dashboard
  useEffect(() => {
    if (isLoading) return;
    if (user && user.role !== 'player') {
      router.replace('/(staff)/dashboard');
    }
  }, [user, isLoading]);

  // Don't render tabs if not a player
  if (!user || user.role !== 'player') {
    return null;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.text.secondary,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Calendrier',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="vault"
        options={{
          title: 'Documents',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="folder-open" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="residence"
        options={{
          title: 'Résidence',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="globe" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
      {/* Hidden screens - accessible but not in tab bar */}
      <Tabs.Screen
        name="messages"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="fiscality"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="settings"
        options={{ href: null }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.background.primary,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    height: Platform.OS === 'ios' ? 88 : 64,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
});
