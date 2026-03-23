/**
 * Resolves the backend base URL at runtime.
 *
 * Priority:
 *  1. EXPO_PUBLIC_BACKEND_URL env var (.env or CI/CD)
 *  2. Dev + LAN mode: extract local IP from Metro debuggerHost (real device on same WiFi)
 *  3. Fallback: http://127.0.0.1:8001 (simulator, or tunnel mode where backend is local)
 *
 * Tunnel mode (exp.direct): the debuggerHost is a public domain, not a local IP.
 *   The backend is NOT tunneled so we cannot use that hostname — fallback to 127.0.0.1
 *   which works in the iOS simulator even in tunnel mode.
 *   To test on a real device with tunnel mode, set EXPO_PUBLIC_BACKEND_URL explicitly.
 */
import Constants from 'expo-constants';

const BACKEND_PORT = 8001;
const IS_LOCAL_IP = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;

export function getApiUrl(): string {
  // 1. Explicit env var (production / CI / real device with tunnel)
  if (process.env.EXPO_PUBLIC_BACKEND_URL) {
    console.log('[API] Using EXPO_PUBLIC_BACKEND_URL:', process.env.EXPO_PUBLIC_BACKEND_URL);
    return process.env.EXPO_PUBLIC_BACKEND_URL;
  }

  // 2. Dev LAN mode: derive from Metro bundler host
  if (__DEV__) {
    const debuggerHost =
      Constants.expoGoConfig?.debuggerHost ??
      (Constants as any).manifest2?.extra?.expoClient?.hostUri ??
      (Constants as any).manifest?.debuggerHost;

    if (debuggerHost) {
      const host = debuggerHost.split(':')[0];
      if (IS_LOCAL_IP.test(host)) {
        const url = `http://${host}:${BACKEND_PORT}`;
        console.log('[API] LAN mode — using Metro host IP:', url);
        return url;
      }
      // Tunnel mode: debuggerHost is a public domain (e.g. *.exp.direct), backend is not tunneled
      console.log('[API] Tunnel mode detected — falling back to 127.0.0.1 (simulator only)');
      console.log('[API] To use a real device with tunnel, set EXPO_PUBLIC_BACKEND_URL in .env');
    }
  }

  // 3. Simulator fallback
  const fallback = `http://127.0.0.1:${BACKEND_PORT}`;
  console.log('[API] Using fallback URL:', fallback);
  return fallback;
}

export const API_BASE_URL = getApiUrl();
