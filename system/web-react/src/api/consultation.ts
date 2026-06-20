import { api } from './client';
import type { ChatMessage, ConsultationHistory } from '../types';

export const consultationApi = {
  ask(question: string, scope?: string) {
    return api.post<ChatMessage>('/api/consultation/ask', { question, scope });
  },
  history() {
    return api.get<ConsultationHistory[]>('/api/consultation/history');
  },
  clearHistory() {
    return api.delete<void>('/api/consultation/history');
  },
};
