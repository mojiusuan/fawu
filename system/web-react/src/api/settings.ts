import { api } from './client';

interface Settings {
  LLM_PROVIDER?: string;
  LLM_TEMPERATURE?: number;
  LLM_MAX_TOKENS?: number;
  EMBEDDING_PROVIDER?: string;
  NEO4J_URI?: string;
  NEO4J_USERNAME?: string;
  NEO4J_PASSWORD?: string;
  JWT_SECRET_KEY?: string;
  JWT_ALGORITHM?: string;
  ACCESS_TOKEN_EXPIRE_MINUTES?: number;
  DEBUG?: boolean;
  LOG_LEVEL?: string;
  CLAUDE_API_KEY?: string;
  OPENAI_API_KEY?: string;
  DEEPSEEK_API_KEY?: string;
  CLAUDE_MODEL?: string;
  OPENAI_MODEL?: string;
  DEEPSEEK_MODEL?: string;
  PORT?: number;
}

export const settingsApi = {
  get() {
    return api.get<Settings>('/api/settings');
  },
  save(data: Settings) {
    return api.put<Settings>('/api/settings', data);
  },
  testLLM() {
    return api.post<{ success: boolean; message: string }>('/api/settings/test-llm');
  },
  testNeo4j() {
    return api.post<{ success: boolean; message: string }>('/api/settings/test-neo4j');
  },
  initKB() {
    return api.post<{ success: boolean; message: string }>('/api/knowledge/init');
  },
  kbStatus() {
    return api.get<Record<string, unknown>>('/api/knowledge/status');
  },
};
