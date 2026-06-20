import { api } from './client';
import type { EscalationRequest } from '../types';

export const escalationApi = {
  create(data: { question: string; contact: string; priority?: string }) {
    return api.post<EscalationRequest>('/api/escalation/request', data);
  },
  list() {
    return api.get<EscalationRequest[]>('/api/escalation/list');
  },
  status(requestId: string) {
    return api.get<EscalationRequest>(`/api/escalation/status/${requestId}`);
  },
  claim(requestId: string) {
    return api.put<EscalationRequest>(`/api/escalation/${requestId}/claim`);
  },
  resolve(requestId: string, note?: string) {
    return api.put<EscalationRequest>(`/api/escalation/${requestId}/resolve`, { resolution_note: note });
  },
  close(requestId: string) {
    return api.put<EscalationRequest>(`/api/escalation/${requestId}/close`);
  },
};
