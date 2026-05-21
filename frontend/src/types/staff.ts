/**
 * Staff Types & Permissions
 * Définit les rôles staff et leurs permissions associées
 */

export type StaffRole = 'tennis_coach' | 'physical_coach' | 'physio' | 'agent' | 'family';

// Mapping des rôles backend vers les rôles UI
export const BACKEND_ROLE_MAP: Record<string, StaffRole> = {
  'technical': 'tennis_coach',
  'medical': 'physio',
  'logistics': 'physical_coach',
  'agent': 'agent',
  'family': 'family',
};

export const ROLE_LABELS: Record<StaffRole, string> = {
  tennis_coach: 'Coach Tennis',
  physical_coach: 'Préparateur Physique',
  physio: 'Kinésithérapeute',
  agent: 'Agent',
  family: 'Famille',
};

export const ROLE_EMOJI: Record<StaffRole, string> = {
  tennis_coach: '🎾',
  physical_coach: '💪',
  physio: '🏥',
  agent: '📋',
  family: '👨‍👩‍👧',
};

export interface StaffPermissions {
  canViewCalendar: boolean;
  canEditCalendar: boolean;
  canViewDocuments: boolean;
  canUploadDocuments: boolean;
  canViewFinances: boolean;
  canManageInvoices: boolean;
  canCreateBrandActivation: boolean;
  // null = all standard event types; string[] = restricted list
  proposableTypes: string[] | null;
}

export const ROLE_PERMISSIONS: Record<StaffRole, StaffPermissions> = {
  tennis_coach: {
    canViewCalendar: true,
    canEditCalendar: true,
    canViewDocuments: true,
    canUploadDocuments: true,
    canViewFinances: false,
    canManageInvoices: false,
    canCreateBrandActivation: false,
    // Alex col J: coach proposes tournament, training, kine, media, sponsor, travel, hotel
    proposableTypes: ['tournament', 'training', 'medical', 'media', 'sponsor', 'travel', 'hotel'],
  },
  physical_coach: {
    canViewCalendar: true,
    canEditCalendar: true,
    canViewDocuments: true,
    canUploadDocuments: true,
    canViewFinances: false,
    canManageInvoices: false,
    canCreateBrandActivation: false,
    // Alex col J: prépa proposes only physicalPrep, travel, hotel
    proposableTypes: ['physicalPrep', 'travel', 'hotel'],
  },
  physio: {
    canViewCalendar: true,
    canEditCalendar: true,
    canViewDocuments: true,
    canUploadDocuments: true,
    canViewFinances: false,
    canManageInvoices: false,
    canCreateBrandActivation: false,
    // Alex col J: kiné proposes only Kiné-Récup
    proposableTypes: ['medical'],
  },
  agent: {
    canViewCalendar: true,
    canEditCalendar: true,
    canViewDocuments: true,
    canUploadDocuments: true,
    canViewFinances: true,
    canManageInvoices: true,
    canCreateBrandActivation: true,
    // Alex col J: agent proposes media, sponsor, travel, hotel + activation_marque
    // null = all standard types + activation_marque via canCreateBrandActivation
    proposableTypes: null,
  },
  family: {
    canViewCalendar: true,
    canEditCalendar: false,  // all event types are read-only for family per data columns
    canViewDocuments: true,
    canUploadDocuments: false,
    canViewFinances: false,
    canManageInvoices: false,
    canCreateBrandActivation: false,
    proposableTypes: [],  // cannot propose any type
  },
};

// Helper to get permissions for a user
export function getStaffPermissions(role?: string): StaffPermissions | null {
  if (!role) return null;
  const staffRole = BACKEND_ROLE_MAP[role] || role as StaffRole;
  return ROLE_PERMISSIONS[staffRole] || null;
}

// Helper to get role label
export function getStaffRoleLabel(role?: string): string {
  if (!role) return 'Staff';
  const staffRole = BACKEND_ROLE_MAP[role] || role as StaffRole;
  return ROLE_LABELS[staffRole] || role;
}

// Helper to get role emoji
export function getStaffRoleEmoji(role?: string): string {
  if (!role) return '👤';
  const staffRole = BACKEND_ROLE_MAP[role] || role as StaffRole;
  return ROLE_EMOJI[staffRole] || '👤';
}
