import { api } from './client';
import type { Task, TaskPriority } from '../types';

interface CreateTaskRequest {
  title: string;
  description?: string;
  task_type: string;
  priority: TaskPriority;
  assigned_to: string;
  entity_type?: string;
  entity_id?: string;
  deadline?: string;
}

export const taskApi = {
  create(data: CreateTaskRequest) {
    return api.post<Task>('/api/tasks', data);
  },
  list(params?: { filter?: string; status?: string }) {
    const qs = new URLSearchParams();
    if (params?.filter) qs.set('filter', params.filter);
    if (params?.status) qs.set('status', params.status);
    const q = qs.toString();
    return api.get<Task[]>(`/api/tasks${q ? `?${q}` : ''}`);
  },
  get(taskId: string) {
    return api.get<Task>(`/api/tasks/${taskId}`);
  },
  accept(taskId: string) {
    return api.put<Task>(`/api/tasks/${taskId}/accept`);
  },
  reject(taskId: string, reason?: string) {
    return api.put<Task>(`/api/tasks/${taskId}/reject`, { reason });
  },
  complete(taskId: string, summary?: string) {
    return api.put<Task>(`/api/tasks/${taskId}/complete`, { result_summary: summary });
  },
  update(taskId: string, data: Partial<CreateTaskRequest>) {
    return api.put<Task>(`/api/tasks/${taskId}`, data);
  },
  cancel(taskId: string) {
    return api.delete<void>(`/api/tasks/${taskId}`);
  },
};
