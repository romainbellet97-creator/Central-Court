import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import * as Calendar from 'expo-calendar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { syncCalendarEvents, CalendarEventItem } from '../services/api';

const SYNC_ENABLED_KEY = '@calendar_sync_enabled';
const LAST_SYNC_KEY = '@calendar_last_sync';

// Fenêtre de sync : 30 jours passés + 180 jours futurs
const DAYS_PAST = 30;
const DAYS_FUTURE = 180;

// Pas de re-sync si le dernier date de moins de 5 minutes
const MIN_SYNC_INTERVAL_MS = 5 * 60 * 1000;

export interface CalendarSyncState {
  isEnabled: boolean;
  isSyncing: boolean;
  lastSync: Date | null;
  permissionStatus: 'undetermined' | 'granted' | 'denied';
  enable: () => Promise<boolean>;
  disable: () => Promise<void>;
  syncNow: () => Promise<{ inserted: number; updated: number } | null>;
}

export function useCalendarSync(): CalendarSyncState {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<'undetermined' | 'granted' | 'denied'>('undetermined');
  const isSyncingRef = useRef(false);

  // Charger l'état persisté au montage
  useEffect(() => {
    (async () => {
      const [enabled, lastSyncStr] = await Promise.all([
        AsyncStorage.getItem(SYNC_ENABLED_KEY),
        AsyncStorage.getItem(LAST_SYNC_KEY),
      ]);
      if (enabled === 'true') setIsEnabled(true);
      if (lastSyncStr) setLastSync(new Date(lastSyncStr));

      // Vérifier les permissions existantes sans les demander
      const { status } = await Calendar.getCalendarPermissionsAsync();
      setPermissionStatus(status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined');
    })();
  }, []);

  // Live sync : re-sync quand l'app revient au premier plan
  useEffect(() => {
    if (!isEnabled) return;

    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        performSync();
      }
    };

    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, [isEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

  const requestPermissions = async (): Promise<boolean> => {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    const granted = status === 'granted';
    setPermissionStatus(granted ? 'granted' : 'denied');
    return granted;
  };

  const performSync = useCallback(async (): Promise<{ inserted: number; updated: number } | null> => {
    // Garde contre les appels concurrents
    if (isSyncingRef.current) return null;

    // Ne pas re-syncer trop souvent
    const lastSyncStr = await AsyncStorage.getItem(LAST_SYNC_KEY);
    if (lastSyncStr) {
      const elapsed = Date.now() - new Date(lastSyncStr).getTime();
      if (elapsed < MIN_SYNC_INTERVAL_MS) return null;
    }

    isSyncingRef.current = true;
    setIsSyncing(true);

    try {
      const hasPermission = await requestPermissions();
      if (!hasPermission) return null;

      // Récupérer tous les calendriers disponibles
      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      if (calendars.length === 0) return null;

      const calendarIds = calendars.map(c => c.id);

      // Fenêtre de sync
      const start = new Date();
      start.setDate(start.getDate() - DAYS_PAST);
      const end = new Date();
      end.setDate(end.getDate() + DAYS_FUTURE);

      const rawEvents = await Calendar.getEventsAsync(calendarIds, start, end);

      // Construire un map calendarId → calendarName pour les métadonnées
      const calendarMap: Record<string, string> = {};
      calendars.forEach(c => { calendarMap[c.id] = c.title; });

      // Transformer en format API
      const mapped: CalendarEventItem[] = rawEvents
        .filter(e => e.id && e.startDate)
        .map(e => {
          const startStr = typeof e.startDate === 'string' ? e.startDate : (e.startDate as Date).toISOString();
          const endStr = e.endDate
            ? (typeof e.endDate === 'string' ? e.endDate : (e.endDate as Date).toISOString())
            : undefined;

          return {
            externalId: e.id,
            title: e.title || '(Sans titre)',
            date: startStr.slice(0, 10),
            endDate: endStr ? endStr.slice(0, 10) : undefined,
            time: e.allDay ? undefined : startStr.slice(11, 16),
            endTime: (e.allDay || !endStr) ? undefined : endStr.slice(11, 16),
            location: e.location || undefined,
            description: e.notes || undefined,
            allDay: e.allDay ?? false,
            calendarName: e.calendarId ? calendarMap[e.calendarId] : undefined,
          };
        });

      if (mapped.length === 0) {
        return { inserted: 0, updated: 0 };
      }

      const result = await syncCalendarEvents(mapped);

      const now = new Date();
      setLastSync(now);
      await AsyncStorage.setItem(LAST_SYNC_KEY, now.toISOString());

      return { inserted: result.inserted, updated: result.updated };
    } catch (err) {
      console.warn('[CalendarSync] Sync failed:', err);
      return null;
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  }, []);

  const enable = useCallback(async (): Promise<boolean> => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return false;

    await AsyncStorage.setItem(SYNC_ENABLED_KEY, 'true');
    setIsEnabled(true);

    // Sync initiale immédiate
    await performSync();
    return true;
  }, [performSync]);

  const disable = useCallback(async () => {
    await AsyncStorage.setItem(SYNC_ENABLED_KEY, 'false');
    setIsEnabled(false);
  }, []);

  const syncNow = useCallback(async () => {
    if (!isEnabled) return null;
    return performSync();
  }, [isEnabled, performSync]);

  return {
    isEnabled,
    isSyncing,
    lastSync,
    permissionStatus,
    enable,
    disable,
    syncNow,
  };
}
