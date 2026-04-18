import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AuthSession } from '@/src/modules/backend/types';

const AUTH_SESSION_STORAGE_KEY = 'har-auth-session-v1';

export async function readStoredAuthSession(): Promise<AuthSession | null> {
  const raw = await AsyncStorage.getItem(AUTH_SESSION_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    await AsyncStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
    return null;
  }
}

export async function saveAuthSession(session: AuthSession): Promise<void> {
  await AsyncStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
}

export async function clearStoredAuthSession(): Promise<void> {
  await AsyncStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
}
