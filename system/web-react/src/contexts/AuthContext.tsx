import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { UserInfo, Role } from '../types';
import { authApi } from '../api/auth';

interface AuthState {
  token: string | null;
  user: UserInfo | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (...roles: Role[]) => boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function loadAuthState(): AuthState {
  try {
    const token = localStorage.getItem('auth_token');
    const user = localStorage.getItem('current_user');
    if (token && user) {
      return {
        token: JSON.parse(token),
        user: JSON.parse(user),
        isLoading: false,
        isAuthenticated: true,
      };
    }
  } catch { /* corrupted data */ }
  return { token: null, user: null, isLoading: false, isAuthenticated: false };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(loadAuthState);

  // Validate token on mount (async, non-blocking)
  useEffect(() => {
    if (state.isAuthenticated) {
      authApi.getMe()
        .then(user => {
          setState(s => ({ ...s, user, isAuthenticated: true }));
          localStorage.setItem('current_user', JSON.stringify(user));
        })
        .catch(() => {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('current_user');
          setState({ token: null, user: null, isLoading: false, isAuthenticated: false });
        });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const login = useCallback(async (username: string, password: string) => {
    const res = await authApi.login({ username, password });
    localStorage.setItem('auth_token', JSON.stringify(res.access_token));
    localStorage.setItem('current_user', JSON.stringify(res.user));
    setState({
      token: res.access_token,
      user: res.user,
      isLoading: false,
      isAuthenticated: true,
    });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('current_user');
    localStorage.removeItem('legal_chat_history');
    setState({ token: null, user: null, isLoading: false, isAuthenticated: false });
  }, []);

  const hasRole = useCallback((...roles: Role[]) => {
    if (!state.user) return false;
    return roles.includes(state.user.role);
  }, [state.user]);

  const refreshUser = useCallback(async () => {
    if (!state.isAuthenticated) return;
    try {
      const user = await authApi.getMe();
      setState(s => ({ ...s, user }));
      localStorage.setItem('current_user', JSON.stringify(user));
    } catch { /* silently fail */ }
  }, [state.isAuthenticated]);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, hasRole, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
