/**
 * API service for Le Court Central.
 * Centralizes all backend calls.
 */

import axios from 'axios';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

function getApiBase(): string {
  if (process.env.EXPO_PUBLIC_BACKEND_URL) {
    return process.env.EXPO_PUBLIC_BACKEND_URL;
  }
  if (__DEV__) {
    const debuggerHost =
      Constants.expoGoConfig?.debuggerHost ??
      (Constants as any).manifest2?.extra?.expoClient?.hostUri ??
      (Constants as any).manifest?.debuggerHost;
    if (debuggerHost) {
      const host = debuggerHost.split(':')[0];
      if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) {
        return `http://${host}:8001`;
      }
    }
  }
  return 'http://127.0.0.1:8001';
}

const API_BASE = getApiBase();
if (__DEV__) console.log('[API] Base URL:', API_BASE);

// Retrieve stored session token (works on web + native)
async function getStoredToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      return typeof localStorage !== 'undefined' ? localStorage.getItem('session_token') : null;
    }
    return await SecureStore.getItemAsync('session_token');
  } catch {
    return null;
  }
}

// Axios instance — with auth interceptor
const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

api.interceptors.request.use(async (config) => {
  const token = await getStoredToken();
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

export default api;

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = await getStoredToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(options?.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.text().catch(() => 'Unknown error');
    throw new Error(`API ${res.status}: ${err}`);
  }
  return res.json();
}

// ── Staff ──
export const fetchStaff = () => apiFetch<any[]>('/api/staff');
export const fetchStaffById = (id: string) => apiFetch<any>(`/api/staff/${id}`);

// ── Events ──
export const fetchEvents = (month?: string) =>
  apiFetch<any[]>(month ? `/api/events?month=${month}` : '/api/events');

export const fetchEventsByDate = (date: string) =>
  apiFetch<any[]>(`/api/events?date=${date}`);

export const createEvent = (data: any) =>
  apiFetch<any>('/api/events', { method: 'POST', body: JSON.stringify(data) });

export const updateEvent = (id: string, data: any) =>
  apiFetch<any>(`/api/events/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteEvent = (id: string) =>
  apiFetch<any>(`/api/events/${id}`, { method: 'DELETE' });

export const addObservation = (eventId: string, data: { author: string; role: string; text: string; parentId?: string | null }) =>
  apiFetch<any>(`/api/events/${eventId}/observations`, { method: 'POST', body: JSON.stringify(data) });

// ── Tournaments ──
export const fetchTournaments = (circuits?: string) =>
  apiFetch<any[]>(circuits ? `/api/tournaments?circuits=${circuits}` : '/api/tournaments');

export const fetchTournamentsByUser = (userId: string) =>
  apiFetch<any[]>(`/api/tournaments/user/${userId}`);

export const fetchTournamentWeeks = (circuits?: string, categories?: string) => {
  const params = new URLSearchParams();
  if (circuits) params.set('circuits', circuits);
  if (categories) params.set('categories', categories);
  const qs = params.toString();
  return apiFetch<any>(qs ? `/api/tournaments/weeks?${qs}` : '/api/tournaments/weeks');
};

export const fetchTournamentStats = () =>
  apiFetch<{ total: number; byCircuit: Record<string, number> }>('/api/tournaments/stats');

export const registerTournament = (tournamentId: string, status: string) =>
  apiFetch<any>('/api/tournaments/register', {
    method: 'POST',
    body: JSON.stringify({ tournamentId, status }),
  });

export const hideTournament = (tournamentId: string) =>
  apiFetch<any>('/api/tournaments/hide', {
    method: 'POST',
    body: JSON.stringify({ tournamentId }),
  });

export const unhideTournament = (tournamentId: string) =>
  apiFetch<any>(`/api/tournaments/hide/${tournamentId}`, {
    method: 'DELETE',
  });

// ── Alerts / Notifications ──
export const fetchAlerts = (unreadOnly = false) =>
  apiFetch<any[]>(unreadOnly ? '/api/alerts?unread_only=true' : '/api/alerts');

export const createAlert = (data: any) =>
  apiFetch<any>('/api/alerts', { method: 'POST', body: JSON.stringify(data) });

export const markAlertRead = (alertId: string) =>
  apiFetch<any>(`/api/alerts/${alertId}/read`, { method: 'PUT' });

export const dismissAlert = (alertId: string) =>
  apiFetch<any>(`/api/alerts/${alertId}/dismiss`, { method: 'PUT' });

export const markAllAlertsRead = () =>
  apiFetch<any>('/api/alerts/read-all', { method: 'PUT' });

export const generateAlerts = () =>
  apiFetch<any>('/api/alerts/generate', { method: 'POST' });

// ── Conflicts ──
export const checkTournamentConflicts = (tournamentId: string) =>
  apiFetch<any>(`/api/tournaments/conflicts/${tournamentId}`);

// ── Preferences ──
export const fetchPreferences = () => apiFetch<any>('/api/preferences');

export const updatePreferences = (data: any) =>
  apiFetch<any>('/api/preferences', { method: 'PUT', body: JSON.stringify(data) });

// ── Email ──
export const sendTournamentAlertEmail = (data: {
  recipient_email: string;
  player_name: string;
  tournament_name: string;
  tournament_city: string;
  tournament_country: string;
  start_date: string;
}) => apiFetch<any>('/api/email/tournament-alert', { method: 'POST', body: JSON.stringify(data) });

// ── Residence / Tax Tracking ──
export interface DayPresence {
  id: string;
  date: string;
  country: string;
  countryName: string;
  status: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CountryStats {
  country: string;
  countryName: string;
  totalDays: number;
  confirmedDays: number;
  manualDays: number;
  daysByMonth: Record<string, number>;
  firstDay: string | null;
  lastDay: string | null;
  longestStreak: number;
  threshold: number;
  percentOfThreshold: number;
}

export interface ResidenceStats {
  year: number;
  totalDaysTracked: number;
  countries: CountryStats[];
  primaryCountry: CountryStats | null;
  warnings: Array<{
    type: string;
    country: string;
    countryName: string;
    message: string;
    severity: string;
  }>;
}

export const fetchResidenceStats = (year: number = new Date().getFullYear()) =>
  apiFetch<ResidenceStats>(`/api/residence/stats?year=${year}`);

export const fetchDayPresences = (year: number, month?: number) =>
  apiFetch<DayPresence[]>(
    month
      ? `/api/residence/days?year=${year}&month=${month}`
      : `/api/residence/days?year=${year}`
  );

export const fetchCountries = () =>
  apiFetch<Array<{ code: string; name: string }>>('/api/residence/countries');

export const addDayPresence = (data: {
  date: string;
  country: string;
  countryName: string;
  status?: string;
  notes?: string;
}) =>
  apiFetch<DayPresence>('/api/residence/days', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const deleteDayPresence = (date: string) =>
  apiFetch<{ success: boolean }>(`/api/residence/days/${date}`, {
    method: 'DELETE',
  });

export const updateDayPresence = (date: string, data: {
  country?: string;
  countryName?: string;
  status?: string;
  notes?: string;
}) =>
  apiFetch<DayPresence>(`/api/residence/days/${date}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

export const addBulkDays = (data: {
  startDate: string;
  endDate: string;
  country: string;
  countryName: string;
  notes?: string;
}) =>
  apiFetch<{ success: boolean; added: number }>('/api/residence/days/bulk', {
    method: 'POST',
    body: JSON.stringify(data),
  });
