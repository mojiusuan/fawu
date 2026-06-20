import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { notificationApi } from '../api/notifications';
import { useAuth } from './AuthContext';

interface NotificationContextValue {
  unreadCount: number;
  refreshCount: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshCount = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const { count } = await notificationApi.unreadCount();
      setUnreadCount(count);
    } catch { /* silently fail */ }
  }, [isAuthenticated]);

  // Poll every 30 seconds
  useEffect(() => {
    if (!isAuthenticated) return;
    refreshCount();
    const interval = setInterval(refreshCount, 30_000);
    return () => clearInterval(interval);
  }, [isAuthenticated, refreshCount]);

  return (
    <NotificationContext.Provider value={{ unreadCount, refreshCount }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}
