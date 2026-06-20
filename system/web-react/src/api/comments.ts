import { api } from './client';
import type { Comment } from '../types';

export const commentApi = {
  create(data: { entity_type: string; entity_id: string; content: string; parent_id?: string }) {
    return api.post<Comment>('/api/comments', data);
  },
  list(entityType: string, entityId: string) {
    return api.get<Comment[]>(`/api/comments/${entityType}/${entityId}`);
  },
  delete(commentId: string) {
    return api.delete<void>(`/api/comments/${commentId}`);
  },
};
