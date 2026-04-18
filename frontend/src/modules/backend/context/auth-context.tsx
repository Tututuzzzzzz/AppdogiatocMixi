import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  fetchBackendHealth,
  fetchBackendRoot,
  fetchCurrentUser,
  loginUser,
  registerUser,
} from '@/src/modules/backend/api/mobile-backend-api';
import {
  clearStoredAuthSession,
  readStoredAuthSession,
  saveAuthSession,
} from '@/src/modules/backend/storage/auth-session';
import type { AuthSession, LoginPayload, RegisterPayload } from '@/src/modules/backend/types';

type AuthContextStore = {
  session: AuthSession | null;
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
  backendHealth: string | null;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshCurrentUser: () => Promise<void>;
  checkBackendHealth: () => Promise<void>;
  clearError: () => void;
};

const AuthContext = createContext<AuthContextStore | null>(null);

export function AuthProvider({ children }: Readonly<PropsWithChildren>) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backendHealth, setBackendHealth] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const hydrateSession = useCallback(async () => {
    setIsLoading(true);

    try {
      const storedSession = await readStoredAuthSession();
      if (!storedSession) {
        setSession(null);
        return;
      }

      try {
        const user = await fetchCurrentUser(storedSession.accessToken);
        const refreshedSession: AuthSession = {
          ...storedSession,
          user,
        };

        setSession(refreshedSession);
        await saveAuthSession(refreshedSession);
      } catch {
        setSession(null);
        await clearStoredAuthSession();
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    hydrateSession().catch(() => {
      setSession(null);
      setIsLoading(false);
    });
  }, [hydrateSession]);

  const login = useCallback(async (payload: LoginPayload) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const nextSession = await loginUser(payload);
      setSession(nextSession);
      await saveAuthSession(nextSession);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'Đăng nhập thất bại.';
      setError(message);
      throw requestError;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const nextSession = await registerUser(payload);
      setSession(nextSession);
      await saveAuthSession(nextSession);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'Đăng ký thất bại.';
      setError(message);
      throw requestError;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setSession(null);
    setError(null);
    await clearStoredAuthSession();
  }, []);

  const refreshCurrentUser = useCallback(async () => {
    if (!session) {
      return;
    }

    try {
      const user = await fetchCurrentUser(session.accessToken);
      const nextSession: AuthSession = {
        ...session,
        user,
      };

      setSession(nextSession);
      await saveAuthSession(nextSession);
      setError(null);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'Không thể tải hồ sơ người dùng.';
      setError(message);
      throw requestError;
    }
  }, [session]);

  const checkBackendHealth = useCallback(async () => {
    try {
      const [healthMessage, rootMessage] = await Promise.all([
        fetchBackendHealth(),
        fetchBackendRoot(),
      ]);
      setBackendHealth(`${healthMessage} | ${rootMessage}`);
      setError(null);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'Không thể kiểm tra backend.';
      setBackendHealth(null);
      setError(message);
      throw requestError;
    }
  }, []);

  const value = useMemo<AuthContextStore>(
    () => ({
      session,
      isLoading,
      isSubmitting,
      error,
      backendHealth,
      login,
      register,
      logout,
      refreshCurrentUser,
      checkBackendHealth,
      clearError,
    }),
    [
      session,
      isLoading,
      isSubmitting,
      error,
      backendHealth,
      login,
      register,
      logout,
      refreshCurrentUser,
      checkBackendHealth,
      clearError,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextStore {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuthContext must be used within AuthProvider');
  }

  return context;
}
