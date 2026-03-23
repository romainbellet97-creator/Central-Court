/**
 * Resolves the backend base URL at runtime.
 *
 * Priority:
 *  1. EXPO_PUBLIC_BACKEND_URL env var (set in .env or CI/CD)
 *  2. In dev mode: extract IP from Metro bundler host (works on real device AND simulator)
 *  3. Fallback: http://127.0.0.1:8001 (simulator only)
 *
 * Why: on a real iOS/Android device, 127.0.0.1 is the device's own loopback,
 * not the Mac running the backend. The Metro debuggerHost already contains
 * the correct LAN IP the device is connected to.
 */
import Constants from 'expo-constants';

const BACKEND_PORT = 8001;

export function getApiUrl(): string {
  // 1. Explicit env var (production / CI)
  if (process.env.EXPO_PUBLIC_BACKEND_URL) {
    return process.env.EXPO_PUBLIC_BACKEND_URL;
  }

  // 2. Dev mode: derive from Metro bundler host (real device + simulator)
  if (__DEV__) {
    const debuggerHost =
      Constants.expoGoConfig?.debuggerHost ??
      (Constants as any).manifest2?.extra?.expoClient?.hostUri ??
      (Constants as any).manifest?.debuggerHost;

    if (debuggerHost) {
      const ip = debuggerHost.split(':')[0];
      return `http://${ip}:${BACKEND_PORT}`;
    }
  }

  // 3. Simulator fallback
  return `http://127.0.0.1:${BACKEND_PORT}`;
}

export const API_BASE_URL = getApiUrl();
