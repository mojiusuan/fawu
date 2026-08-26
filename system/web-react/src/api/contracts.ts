import { api } from './client';
import type { Contract, RiskLevel } from '../types';

interface ReviewResult {
  contract_id: string;
  review_summary: string;
  high_risks: number;
  medium_risks: number;
  low_risks: number;
  clauses: { clause_number: string; content: string; risk_level: RiskLevel; risk_analysis: string; law_basis: string; suggestion: string }[];
  suggestions: string;
  audit_id: string;
}

interface CompareResult {
  contract_a_title: string;
  contract_b_title: string;
  total_clauses: number;
  identical: number;
  formal_diff: number;
  substantive_diff: number;
  differences: { clause: string; type: string; detail: string; favor: string }[];
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
    return api.upload<Contract>('/api/contracts/upload/file', formData);
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
