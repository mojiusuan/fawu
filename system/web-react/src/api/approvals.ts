import { api } from './client';
import type { Approval } from '../types';

export const approvalApi = {
  submit(data: { entity_type: string; entity_id: string; approver_id: string; comment?: string }) {
    return api.post<Approval>('/api/approvals', data);
  },
  list(params?: { filter?: string }) {
    const qs = params?.filter ? `?filter=${params.filter}` : '';
    return api.get<Approval[]>(`/api/approvals${qs}`);
  },
  approve(approvalId: string, comment?: string) {
    return api.put<Approval>(`/api/approvals/${approvalId}/approve`, { comment });
  },
  reject(approvalId: string, comment?: string) {
    return api.put<Approval>(`/api/approvals/${approvalId}/reject`, { comment });
  },
};
