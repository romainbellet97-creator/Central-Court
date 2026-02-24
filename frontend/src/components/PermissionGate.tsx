import React, { ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { ROLE_PERMISSIONS, StaffPermissions, StaffRole, BACKEND_ROLE_MAP } from '../types/staff';
import { Ionicons } from '@expo/vector-icons';

interface PermissionGateProps {
  permission: keyof StaffPermissions;
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * PermissionGate - Composant de contrôle d'accès basé sur les permissions
 * 
 * Usage:
 * <PermissionGate permission="canUploadDocuments" fallback={<RestrictedMessage />}>
 *   <UploadButton />
 * </PermissionGate>
 */
export const PermissionGate: React.FC<PermissionGateProps> = ({ 
  permission, 
  fallback = null, 
  children 
}) => {
  const { user } = useAuth();

  // Players have full access to their own app
  if (user?.role === 'player') {
    return <>{children}</>;
  }

  // Get staff role from user
  const backendRole = user?.role;
  const staffRole = backendRole ? (BACKEND_ROLE_MAP[backendRole] || backendRole as StaffRole) : null;
  
  if (!staffRole) {
    return <>{fallback}</>;
  }

  const permissions = ROLE_PERMISSIONS[staffRole];
  if (!permissions || !permissions[permission]) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

/**
 * RestrictedScreen - Écran affiché quand l'accès est refusé
 */
interface RestrictedScreenProps {
  message?: string;
  icon?: string;
}

export const RestrictedScreen: React.FC<RestrictedScreenProps> = ({ 
  message = "Votre rôle ne permet pas d'accéder à cette section",
  icon = "lock-closed"
}) => {
  return (
    <View style={styles.restrictedContainer}>
      <View style={styles.restrictedIconContainer}>
        <Ionicons name={icon as any} size={48} color="#9CA3AF" />
      </View>
      <Text style={styles.restrictedTitle}>Accès restreint</Text>
      <Text style={styles.restrictedMessage}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  restrictedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 32,
  },
  restrictedIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  restrictedTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  restrictedMessage: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
  },
});
