import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function AdminLayout() {
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    (async () => {
      const token = await AsyncStorage.getItem('admin_token');
      const isLogin = segments[segments.length - 1] === 'login';
      if (!token && !isLogin) router.replace('/admin/login');
    })();
  }, [segments]);

  return <Stack screenOptions={{ headerShown: false }} />;
}
