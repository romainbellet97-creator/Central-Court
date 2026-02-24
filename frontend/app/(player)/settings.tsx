import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Colors from '../../src/constants/colors';

interface NotificationSettings {
  // Global
  enabled: boolean;
  sound: boolean;
  vibration: boolean;
  // Categories
  tournaments: boolean;
  deadlines: boolean;
  medical: boolean;
  training: boolean;
  documents: boolean;
  messages: boolean;
  fiscal: boolean;
  // Timing
  reminderHours: number;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
}

const defaultSettings: NotificationSettings = {
  enabled: true,
  sound: true,
  vibration: true,
  tournaments: true,
  deadlines: true,
  medical: true,
  training: true,
  documents: true,
  messages: true,
  fiscal: true,
  reminderHours: 24,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
};

const STORAGE_KEY = '@central_court_notification_settings';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [settings, setSettings] = useState<NotificationSettings>(defaultSettings);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    saveSettings();
  }, [settings]);

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        setSettings(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const saveSettings = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  const updateSetting = (key: keyof NotificationSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const renderToggle = (
    label: string,
    key: keyof NotificationSettings,
    icon: string,
    color: string,
    disabled: boolean = false
  ) => (
    <View style={[styles.settingItem, disabled && styles.settingItemDisabled]}>
      <View style={[styles.settingIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon as any} size={20} color={disabled ? Colors.text.muted : color} />
      </View>
      <Text style={[styles.settingLabel, disabled && styles.settingLabelDisabled]}>
        {label}
      </Text>
      <Switch
        value={settings[key] as boolean}
        onValueChange={(value) => updateSetting(key, value)}
        trackColor={{ false: Colors.border.medium, true: Colors.primary + '60' }}
        thumbColor={settings[key] ? Colors.primary : Colors.text.muted}
        disabled={disabled || !settings.enabled}
      />
    </View>
  );

  const reminderOptions = [
    { value: 1, label: '1 heure' },
    { value: 2, label: '2 heures' },
    { value: 6, label: '6 heures' },
    { value: 12, label: '12 heures' },
    { value: 24, label: '1 jour' },
    { value: 48, label: '2 jours' },
    { value: 72, label: '3 jours' },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Master Toggle */}
        <View style={styles.section}>
          <View style={styles.masterToggle}>
            <View style={styles.masterToggleLeft}>
              <View style={[styles.masterIcon, { backgroundColor: settings.enabled ? Colors.primary + '20' : Colors.text.muted + '20' }]}>
                <Ionicons
                  name={settings.enabled ? 'notifications' : 'notifications-off'}
                  size={28}
                  color={settings.enabled ? Colors.primary : Colors.text.muted}
                />
              </View>
              <View>
                <Text style={styles.masterTitle}>
                  {settings.enabled ? 'Notifications activées' : 'Notifications désactivées'}
                </Text>
                <Text style={styles.masterSubtitle}>
                  {settings.enabled ? 'Recevez vos alertes importantes' : 'Aucune notification ne sera envoyée'}
                </Text>
              </View>
            </View>
            <Switch
              value={settings.enabled}
              onValueChange={(value) => updateSetting('enabled', value)}
              trackColor={{ false: Colors.border.medium, true: Colors.primary + '60' }}
              thumbColor={settings.enabled ? Colors.primary : Colors.text.muted}
            />
          </View>
        </View>

        {/* Sound & Vibration */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Préférences</Text>
          <View style={styles.card}>
            {renderToggle('Son', 'sound', 'volume-high', Colors.primary)}
            <View style={styles.divider} />
            {renderToggle('Vibration', 'vibration', 'phone-portrait-outline', Colors.primary)}
          </View>
        </View>

        {/* Categories */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Catégories de notifications</Text>
          <View style={styles.card}>
            {renderToggle('Tournois & Deadlines', 'tournaments', 'trophy', '#1da1f2')}
            <View style={styles.divider} />
            {renderToggle('Alertes urgentes', 'deadlines', 'alert-circle', Colors.danger)}
            <View style={styles.divider} />
            {renderToggle('Rendez-vous médicaux', 'medical', 'medkit', '#e0245e')}
            <View style={styles.divider} />
            {renderToggle('Entraînements', 'training', 'fitness', '#4CAF50')}
            <View style={styles.divider} />
            {renderToggle('Documents expirés', 'documents', 'document-text', '#9c27b0')}
            <View style={styles.divider} />
            {renderToggle('Messages équipe', 'messages', 'chatbubbles', '#00bcd4')}
            <View style={styles.divider} />
            {renderToggle('Alertes fiscales', 'fiscal', 'globe', '#ff9800')}
          </View>
        </View>

        {/* Reminder Time */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rappel avant événement</Text>
          <View style={styles.card}>
            <View style={styles.reminderSelector}>
              {reminderOptions.map(option => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.reminderOption,
                    settings.reminderHours === option.value && styles.reminderOptionSelected,
                    !settings.enabled && styles.reminderOptionDisabled
                  ]}
                  onPress={() => updateSetting('reminderHours', option.value)}
                  disabled={!settings.enabled}
                >
                  <Text style={[
                    styles.reminderOptionText,
                    settings.reminderHours === option.value && styles.reminderOptionTextSelected,
                    !settings.enabled && styles.reminderOptionTextDisabled
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Quiet Hours */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mode silencieux</Text>
          <View style={styles.card}>
            <View style={styles.settingItem}>
              <View style={[styles.settingIcon, { backgroundColor: '#9c27b0' + '20' }]}>
                <Ionicons name="moon" size={20} color={settings.quietHoursEnabled ? '#9c27b0' : Colors.text.muted} />
              </View>
              <View style={styles.quietHoursInfo}>
                <Text style={styles.settingLabel}>Heures de repos</Text>
                {settings.quietHoursEnabled && (
                  <Text style={styles.quietHoursTime}>
                    {settings.quietHoursStart} - {settings.quietHoursEnd}
                  </Text>
                )}
              </View>
              <Switch
                value={settings.quietHoursEnabled}
                onValueChange={(value) => updateSetting('quietHoursEnabled', value)}
                trackColor={{ false: Colors.border.medium, true: Colors.primary + '60' }}
                thumbColor={settings.quietHoursEnabled ? Colors.primary : Colors.text.muted}
                disabled={!settings.enabled}
              />
            </View>
            {settings.quietHoursEnabled && (
              <Text style={styles.quietHoursNote}>
                Aucune notification entre 22h et 8h sauf urgences
              </Text>
            )}
          </View>
        </View>

        {/* Info */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={20} color={Colors.primary} />
          <Text style={styles.infoText}>
            Les notifications push nécessitent l'autorisation système. Vérifiez vos paramètres si vous ne recevez pas d'alertes.
          </Text>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.secondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  content: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 16,
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.secondary,
    marginBottom: 10,
    marginLeft: 4,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  masterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  masterToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  masterIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  masterTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  masterSubtitle: {
    fontSize: 13,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  settingItemDisabled: {
    opacity: 0.5,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingLabel: {
    flex: 1,
    fontSize: 15,
    color: Colors.text.primary,
  },
  settingLabelDisabled: {
    color: Colors.text.muted,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border.light,
    marginLeft: 62,
  },
  reminderSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    gap: 8,
  },
  reminderOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.background.secondary,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  reminderOptionSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  reminderOptionDisabled: {
    opacity: 0.5,
  },
  reminderOptionText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text.secondary,
  },
  reminderOptionTextSelected: {
    color: '#fff',
  },
  reminderOptionTextDisabled: {
    color: Colors.text.muted,
  },
  quietHoursInfo: {
    flex: 1,
  },
  quietHoursTime: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  quietHoursNote: {
    fontSize: 12,
    color: Colors.text.secondary,
    paddingHorizontal: 14,
    paddingBottom: 14,
    marginTop: -4,
    marginLeft: 48,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.primary + '10',
    marginHorizontal: 16,
    marginTop: 20,
    padding: 14,
    borderRadius: 12,
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: Colors.text.secondary,
    lineHeight: 18,
  },
});
