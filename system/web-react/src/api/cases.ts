import { api } from './client';
import type { CaseProfile, CaseAnalysis } from '../types';

export const caseApi = {
  list(params?: { status?: string }) {
    const qs = params?.status ? `?status=${params.status}` : '';
    return api.get<CaseProfile[]>(`/api/case/profiles${qs}`);
  },
  get(caseId: string) {
    return api.get<CaseProfile>(`/api/case/profiles/${caseId}`);
  },
  create(data: { case_name: string; case_type: string; description: string }) {
    return api.post<CaseProfile>('/api/case/profiles', data);
  },
  update(caseId: string, data: Partial<CaseProfile>) {
    return api.put<CaseProfile>(`/api/case/profiles/${caseId}`, data);
  },
  delete(caseId: string) {
    return api.delete<void>(`/api/case/profiles/${caseId}`);
  },
  analyze(caseType: string, structuredFacts: Record<string, unknown>) {
    return api.post<CaseAnalysis>('/api/case/analyze', { case_type: caseType, structured_facts: structuredFacts });
  },
  getTypes() {
    return api.get<any[]>('/api/case/types');
  },
};
