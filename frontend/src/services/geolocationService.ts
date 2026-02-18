/**
 * Service de géolocalisation pour le tracking automatique de résidence fiscale
 * Phase 3 - Background tracking quotidien
 */

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

// Task names
const DAILY_LOCATION_TASK = 'daily-location-check';
const BACKGROUND_LOCATION_TASK = 'background-location-task';

// Storage keys
const STORAGE_KEYS = {
  TRACKING_ENABLED: '@tax_tracking_enabled',
  LAST_RECORDED_DATE: '@tax_last_recorded_date',
  LAST_COUNTRY: '@tax_last_country',
  AUTO_RECORD: '@tax_auto_record',
};

// Country name to code mapping
const countryNameToCode: Record<string, string> = {
  'France': 'FR', 'Monaco': 'MC', 'Switzerland': 'CH', 'Suisse': 'CH',
  'Spain': 'ES', 'Espagne': 'ES', 'United States': 'US', 'États-Unis': 'US',
  'United Kingdom': 'GB', 'Royaume-Uni': 'GB', 'Germany': 'DE', 'Allemagne': 'DE',
  'Italy': 'IT', 'Italie': 'IT', 'United Arab Emirates': 'AE', 'Émirats arabes unis': 'AE',
  'Australia': 'AU', 'Australie': 'AU', 'Austria': 'AT', 'Autriche': 'AT',
  'Belgium': 'BE', 'Belgique': 'BE', 'Brazil': 'BR', 'Brésil': 'BR',
  'Canada': 'CA', 'China': 'CN', 'Chine': 'CN', 'Croatia': 'HR', 'Croatie': 'HR',
  'Czech Republic': 'CZ', 'Tchéquie': 'CZ', 'Denmark': 'DK', 'Danemark': 'DK',
  'Finland': 'FI', 'Finlande': 'FI', 'Greece': 'GR', 'Grèce': 'GR',
  'Hungary': 'HU', 'Hongrie': 'HU', 'India': 'IN', 'Inde': 'IN',
  'Japan': 'JP', 'Japon': 'JP', 'South Korea': 'KR', 'Corée du Sud': 'KR',
  'Mexico': 'MX', 'Mexique': 'MX', 'Netherlands': 'NL', 'Pays-Bas': 'NL',
  'Norway': 'NO', 'Norvège': 'NO', 'Poland': 'PL', 'Pologne': 'PL',
  'Portugal': 'PT', 'Qatar': 'QA', 'Romania': 'RO', 'Roumanie': 'RO',
  'Saudi Arabia': 'SA', 'Arabie Saoudite': 'SA', 'Serbia': 'RS', 'Serbie': 'RS',
  'Sweden': 'SE', 'Suède': 'SE', 'Turkey': 'TR', 'Turquie': 'TR',
  'Argentina': 'AR', 'Argentine': 'AR', 'Chile': 'CL', 'Chili': 'CL',
  'Colombia': 'CO', 'Colombie': 'CO', 'Morocco': 'MA', 'Maroc': 'MA',
  'Tunisia': 'TN', 'Tunisie': 'TN',
};

// Country code to name mapping
const COUNTRY_NAMES: Record<string, string> = {
  FR: 'France', MC: 'Monaco', CH: 'Suisse', ES: 'Espagne',
  US: 'États-Unis', GB: 'Royaume-Uni', DE: 'Allemagne', IT: 'Italie',
  AE: 'Émirats arabes unis', AU: 'Australie', AT: 'Autriche', BE: 'Belgique',
  BR: 'Brésil', CA: 'Canada', CN: 'Chine', HR: 'Croatie',
  CZ: 'Tchéquie', DK: 'Danemark', FI: 'Finlande', GR: 'Grèce',
  HU: 'Hongrie', IN: 'Inde', JP: 'Japon', KR: 'Corée du Sud',
  MX: 'Mexique', NL: 'Pays-Bas', NO: 'Norvège', PL: 'Pologne',
  PT: 'Portugal', QA: 'Qatar', RO: 'Roumanie', SA: 'Arabie Saoudite',
  RS: 'Serbie', SE: 'Suède', TR: 'Turquie', AR: 'Argentine',
  CL: 'Chili', CO: 'Colombie', MA: 'Maroc', TN: 'Tunisie',
};

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Process daily location and record if needed
 */
const processDailyLocation = async (coords: { latitude: number; longitude: number }) => {
  try {
    console.log('📍 Processing location:', coords.latitude, coords.longitude);

    // Reverse geocoding to get country
    const [geocode] = await Location.reverseGeocodeAsync({
      latitude: coords.latitude,
      longitude: coords.longitude,
    });

    if (!geocode) {
      console.error('❌ No geocode result');
      return null;
    }

    // Get country code
    let countryCode = geocode.isoCountryCode || '';
    if (!countryCode && geocode.country) {
      countryCode = countryNameToCode[geocode.country] || '';
    }

    if (!countryCode) {
      console.error('❌ Could not determine country code');
      return null;
    }

    const today = new Date().toISOString().split('T')[0];
    const countryName = COUNTRY_NAMES[countryCode] || geocode.country || countryCode;

    console.log('🌍 Detected:', countryCode, countryName, 'on', today);

    // Check if already recorded today
    const lastRecorded = await AsyncStorage.getItem(STORAGE_KEYS.LAST_RECORDED_DATE);
    if (lastRecorded === today) {
      console.log('⚠️ Already recorded today');
      return { alreadyRecorded: true, country: countryCode, countryName };
    }

    // Check if auto-record is enabled
    const autoRecord = await AsyncStorage.getItem(STORAGE_KEYS.AUTO_RECORD);
    if (autoRecord !== 'true') {
      console.log('⚠️ Auto-record disabled');
      return { autoRecordDisabled: true, country: countryCode, countryName };
    }

    // Record the day via API
    try {
      const response = await api.post('/api/residence/days', {
        date: today,
        country: countryCode,
        countryName: countryName,
        status: 'confirmed',
        notes: `Auto GPS - ${geocode.city || geocode.subregion || ''}`.trim(),
      });

      console.log('✅ Day recorded:', response.data);

      // Save last recorded date
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_RECORDED_DATE, today);
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_COUNTRY, countryCode);

      // Check for tax alerts
      await checkAndSendTaxAlerts(countryCode, countryName);

      return {
        success: true,
        country: countryCode,
        countryName,
        date: today,
      };
    } catch (apiError) {
      console.error('❌ API error:', apiError);
      return { apiError: true, country: countryCode, countryName };
    }
  } catch (error) {
    console.error('❌ Process location error:', error);
    return null;
  }
};

/**
 * Check tax thresholds and send alerts if needed
 */
const checkAndSendTaxAlerts = async (countryCode: string, countryName: string) => {
  try {
    const response = await api.get('/api/residence/alerts');
    const alerts = response.data?.alerts || [];

    for (const alert of alerts) {
      if (alert.type === 'approaching_threshold' && alert.country === countryCode) {
        await sendNotification(
          '⚠️ Alerte Résidence Fiscale',
          `Vous approchez du seuil de 183 jours en ${countryName} (${alert.days}/183)`,
          { type: 'tax_warning', country: countryCode }
        );
      } else if (alert.type === 'threshold_exceeded' && alert.country === countryCode) {
        await sendNotification(
          '🚨 Seuil Fiscal Atteint',
          `Vous avez dépassé 183 jours en ${countryName}. Vous êtes considéré comme résident fiscal.`,
          { type: 'tax_critical', country: countryCode }
        );
      }
    }
  } catch (error) {
    console.error('❌ Check alerts error:', error);
  }
};

/**
 * Send a local notification
 */
const sendNotification = async (title: string, body: string, data?: any) => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
      },
      trigger: null, // Send immediately
    });
    console.log('🔔 Notification sent:', title);
  } catch (error) {
    console.error('❌ Notification error:', error);
  }
};

/**
 * Define the daily background task
 */
TaskManager.defineTask(DAILY_LOCATION_TASK, async () => {
  console.log('⏰ Daily location task triggered');

  try {
    // Get current position
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    const result = await processDailyLocation(location.coords);

    if (result?.success) {
      return BackgroundFetch.BackgroundFetchResult.NewData;
    }
    return BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (error) {
    console.error('❌ Daily task error:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

/**
 * Start automatic daily tracking
 */
export const startDailyTracking = async (): Promise<boolean> => {
  try {
    console.log('🚀 Starting daily tracking...');

    // Request foreground permission first
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    if (foregroundStatus !== 'granted') {
      console.error('❌ Foreground permission denied');
      return false;
    }

    // Request background permission
    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
    if (backgroundStatus !== 'granted') {
      console.warn('⚠️ Background permission not granted - will use foreground only');
    }

    // Request notification permission
    const { status: notifStatus } = await Notifications.requestPermissionsAsync();
    if (notifStatus !== 'granted') {
      console.warn('⚠️ Notification permission not granted');
    }

    // Register background fetch task
    await BackgroundFetch.registerTaskAsync(DAILY_LOCATION_TASK, {
      minimumInterval: 60 * 60 * 12, // Every 12 hours (iOS minimum)
      stopOnTerminate: false,
      startOnBoot: true,
    });

    // Save settings
    await AsyncStorage.setItem(STORAGE_KEYS.TRACKING_ENABLED, 'true');
    await AsyncStorage.setItem(STORAGE_KEYS.AUTO_RECORD, 'true');

    console.log('✅ Daily tracking started');
    return true;
  } catch (error) {
    console.error('❌ Start tracking error:', error);
    return false;
  }
};

/**
 * Stop automatic daily tracking
 */
export const stopDailyTracking = async (): Promise<void> => {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(DAILY_LOCATION_TASK);
    if (isRegistered) {
      await BackgroundFetch.unregisterTaskAsync(DAILY_LOCATION_TASK);
    }
    await AsyncStorage.setItem(STORAGE_KEYS.TRACKING_ENABLED, 'false');
    console.log('✅ Daily tracking stopped');
  } catch (error) {
    console.error('❌ Stop tracking error:', error);
  }
};

/**
 * Check if daily tracking is enabled
 */
export const isDailyTrackingEnabled = async (): Promise<boolean> => {
  try {
    const enabled = await AsyncStorage.getItem(STORAGE_KEYS.TRACKING_ENABLED);
    const isRegistered = await TaskManager.isTaskRegisteredAsync(DAILY_LOCATION_TASK);
    return enabled === 'true' && isRegistered;
  } catch {
    return false;
  }
};

/**
 * Toggle auto-record setting
 */
export const setAutoRecord = async (enabled: boolean): Promise<void> => {
  await AsyncStorage.setItem(STORAGE_KEYS.AUTO_RECORD, enabled ? 'true' : 'false');
};

/**
 * Check if auto-record is enabled
 */
export const isAutoRecordEnabled = async (): Promise<boolean> => {
  const value = await AsyncStorage.getItem(STORAGE_KEYS.AUTO_RECORD);
  return value === 'true';
};

/**
 * Manually trigger a location check (for testing or manual refresh)
 */
export const triggerManualLocationCheck = async (): Promise<{
  success: boolean;
  country?: string;
  countryName?: string;
  message?: string;
}> => {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') {
      return { success: false, message: 'Permission de localisation non accordée' };
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    const result = await processDailyLocation(location.coords);

    if (result?.success) {
      return {
        success: true,
        country: result.country,
        countryName: result.countryName,
        message: `Jour enregistré en ${result.countryName}`,
      };
    } else if (result?.alreadyRecorded) {
      return {
        success: false,
        country: result.country,
        countryName: result.countryName,
        message: 'Déjà enregistré aujourd\'hui',
      };
    } else if (result?.autoRecordDisabled) {
      return {
        success: false,
        country: result.country,
        countryName: result.countryName,
        message: 'Enregistrement automatique désactivé',
      };
    }

    return { success: false, message: 'Impossible de déterminer la position' };
  } catch (error: any) {
    return { success: false, message: error?.message || 'Erreur de localisation' };
  }
};

/**
 * Get the last recorded location info
 */
export const getLastRecordedInfo = async (): Promise<{
  date: string | null;
  country: string | null;
}> => {
  const date = await AsyncStorage.getItem(STORAGE_KEYS.LAST_RECORDED_DATE);
  const country = await AsyncStorage.getItem(STORAGE_KEYS.LAST_COUNTRY);
  return { date, country };
};

/**
 * Request all necessary permissions
 */
export const requestAllPermissions = async (): Promise<{
  foreground: boolean;
  background: boolean;
  notifications: boolean;
}> => {
  const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
  const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
  const { status: notifStatus } = await Notifications.requestPermissionsAsync();

  return {
    foreground: foregroundStatus === 'granted',
    background: backgroundStatus === 'granted',
    notifications: notifStatus === 'granted',
  };
};

export default {
  startDailyTracking,
  stopDailyTracking,
  isDailyTrackingEnabled,
  setAutoRecord,
  isAutoRecordEnabled,
  triggerManualLocationCheck,
  getLastRecordedInfo,
  requestAllPermissions,
  sendNotification,
};
