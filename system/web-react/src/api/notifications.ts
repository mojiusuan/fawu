import { api } from './client';
import type { Notification } from '../types';

export const notificationApi = {
  list(params?: { unread_only?: boolean; limit?: number; offset?: number }) {
    const qs = new URLSearchParams();
    if (params?.unread_only) qs.set('unread_only', 'true');
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.offset) qs.set('offset', String(params.offset));
    const q = qs.toString();
    return api.get<Notification[]>(`/api/notifications${q ? `?${q}` : ''}`);
  },
  unreadCount() {
    return api.get<{ count: number }>('/api/notifications/unread-count');
  },
  markRead(notificationId: string) {
    return api.put<void>(`/api/notifications/${notificationId}/read`);
  },
  markAllRead() {
    return api.put<void>('/api/notifications/read-all');
  },
  delete(notificationId: string) {
    return api.delete<void>(`/api/notifications/${notificationId}`);
  },
};
