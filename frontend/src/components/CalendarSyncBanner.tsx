import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CalendarSyncState } from '../hooks/useCalendarSync';

interface Props {
  sync: CalendarSyncState;
}

function formatLastSync(date: Date | null): string {
  if (!date) return 'Jamais synchronisé';
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'À l\'instant';
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `Il y a ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  return `Il y a ${diffD}j`;
}

export default function CalendarSyncBanner({ sync }: Props) {
  const { isEnabled, isSyncing, lastSync, permissionStatus, enable, disable, syncNow } = sync;
  const [isTogglingOff, setIsTogglingOff] = useState(false);

  const handleToggleOn = async () => {
    const ok = await enable();
    if (!ok) {
      Alert.alert(
        'Permission refusée',
        'Autorisez l\'accès au calendrier dans vos Réglages pour activer la synchronisation.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleToggleOff = () => {
    Alert.alert(
      'Désactiver la sync ?',
      'Les événements déjà importés restent dans votre agenda Central Court. La synchronisation automatique sera désactivée.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Désactiver',
          style: 'destructive',
          onPress: async () => {
            setIsTogglingOff(true);
            await disable();
            setIsTogglingOff(false);
          },
        },
      ]
    );
  };

  const handleSyncNow = async () => {
    const result = await syncNow();
    if (result) {
      const total = result.inserted + result.updated;
      Alert.alert(
        'Synchronisation terminée',
        total === 0
          ? 'Aucun nouvel événement à importer.'
          : `${result.inserted > 0 ? `${result.inserted} ajouté${result.inserted > 1 ? 's' : ''}` : ''}${result.inserted > 0 && result.updated > 0 ? ', ' : ''}${result.updated > 0 ? `${result.updated} mis à jour` : ''}.`,
        [{ text: 'OK' }]
      );
    }
  };

  // ── État désactivé ──
  if (!isEnabled) {
    return (
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={[styles.iconWrap, { backgroundColor: '#EEF2FF' }]}>
            <Ionicons name="calendar-outline" size={20} color="#1e3c72" />
          </View>
          <View style={styles.textBlock}>
            <Text style={styles.title}>Calendrier natif</Text>
            <Text style={styles.sub}>
              {permissionStatus === 'denied'
                ? 'Permission refusée — activez dans les Réglages'
                : 'Importez vos événements Apple / Google Calendar'}
            </Text>
          </View>
          <TouchableOpacity style={styles.enableBtn} onPress={handleToggleOn}>
            <Text style={styles.enableBtnText}>Activer</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── État activé ──
  return (
    <View style={[styles.card, styles.cardActive]}>
      <View style={styles.row}>
        <View style={[styles.iconWrap, { backgroundColor: '#DCFCE7' }]}>
          {isSyncing ? (
            <ActivityIndicator size="small" color="#16A34A" />
          ) : (
            <Ionicons name="calendar" size={20} color="#16A34A" />
          )}
        </View>
        <View style={styles.textBlock}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Calendrier synchronisé</Text>
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>Actif</Text>
            </View>
          </View>
          <Text style={styles.sub}>
            {isSyncing ? 'Synchronisation en cours…' : formatLastSync(lastSync)}
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionBtn, isSyncing && styles.actionBtnDisabled]}
          onPress={handleSyncNow}
          disabled={isSyncing}
        >
          <Ionicons name="refresh" size={14} color="#1e3c72" />
          <Text style={styles.actionBtnText}>Sync maintenant</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnDanger]}
          onPress={handleToggleOff}
          disabled={isTogglingOff}
        >
          <Ionicons name="close-circle-outline" size={14} color="#E53935" />
          <Text style={[styles.actionBtnText, { color: '#E53935' }]}>Désactiver</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#F8FAFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardActive: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  sub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  activeBadge: {
    backgroundColor: '#DCFCE7',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  activeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#16A34A',
  },
  enableBtn: {
    backgroundColor: '#1e3c72',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  enableBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  actionBtnDisabled: {
    opacity: 0.5,
  },
  actionBtnDanger: {
    backgroundColor: '#FEF2F2',
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e3c72',
  },
});
