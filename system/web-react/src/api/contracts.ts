import { api } from './client';
import type { Contract, Clause } from '../types';

interface ReviewResult {
  contract: Contract;
  summary: string;
  stats: { high: number; medium: number; low: number };
}

interface CompareResult {
  diffs: { clause: string; type: string; detail: string; favor: string }[];
  stats: { total: number; identical: number; formal: number; substantive: number };
}

interface GenerateRequest {
  contract_type: string;
  party_a: string;
  party_b: string;
  key_terms: string;
}

interface GenerateResult {
  content: string;
  download_url: string;
}

export const contractApi = {
  upload(formData: FormData) {
    return api.upload<Contract>('/api/contracts/upload', formData);
  },
  create(data: { title: string; contract_type: string; party_a: string; party_b: string; content: string; assigned_to?: string }) {
    return api.post<Contract>('/api/contracts/upload', data);
  },
  list() {
    return api.get<Contract[]>('/api/contracts/');
  },
  get(contractId: string) {
    return api.get<Contract>(`/api/contracts/${contractId}`);
  },
  review(contractId: string) {
    return api.post<ReviewResult>(`/api/contracts/review/${contractId}`);
  },
  compare(contractIdA: string, contractIdB: string) {
    return api.post<CompareResult>('/api/contracts/compare', {
      contract_a_id: contractIdA,
      contract_b_id: contractIdB,
    });
  },
  generate(data: GenerateRequest) {
    return api.post<GenerateResult>('/api/contracts/generate', data);
  },
  delete(contractId: string) {
    return api.delete<void>(`/api/contracts/${contractId}`);
  },
};
