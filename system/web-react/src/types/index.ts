// ============ Auth & User ============
export type Role = 'admin' | 'legal' | 'business' | 'auditor';

export interface UserInfo {
  id: string;
  username: string;
  display_name: string;
  role: Role;
  created_at: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  user: UserInfo;
}

export interface UserCreateRequest {
  username: string;
  display_name: string;
  password: string;
  role: Role;
}

// ============ Case ============
export type CaseStatus = 'draft' | 'assessing' | 'negotiating' | 'litigating' | 'closed';
export type CasePriority = 'low' | 'normal' | 'urgent' | 'critical';

export interface CaseProfile {
  case_id: string;
  user_id: string;
  case_name: string;
  case_type: string;
  case_type_name: string;
  status: CaseStatus;
  priority?: CasePriority;
  description: string;
  structured_facts: Record<string, unknown>;
  analysis_ids: string[];
  assigned_to: string | null;
  assigned_by: string | null;
  assigned_at: string | null;
  deadline: string | null;
  created_at: string;
  updated_at: string;
}

export interface CaseAnalysis {
  analysis_id: string;
  case_id: string;
  case_type: string;
  created_at: string;
  summary: string;
  legal_basis: { law: string; article: string; content: string }[];
  risk_assessment: { overall_risk: string; verdict: string };
  similar_cases: { title: string; case_number: string }[];
  evidence_checklist: { item: string; status: string }[];
  limitation_check: { type: string; period: string; deadline: string; is_expired: boolean } | null;
  fee_estimate: { court_fee: number; note?: string };
  disclaimer: string;
}

// ============ Contract ============
export type ReviewStatus = '未审查' | '审查中' | '已审查' | '需复核' | '已驳回' | '已归档';
export type RiskLevel = 'low' | 'medium' | 'high';

export interface Clause {
  clause_number: string;
  content: string;
  risk_level: RiskLevel;
  risk_analysis: string;
  law_basis: string;
  suggestion: string;
}

export interface Contract {
  id: string;
  title: string;
  contract_type: string;
  party_a: string;
  party_b: string;
  content: string;
  review_status: ReviewStatus;
  clauses: Clause[];
  created_at: string;
  assigned_to: string | null;
  assigned_by: string | null;
  assigned_at: string | null;
}

// ============ Consultation ============
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  law_basis?: { law: string; article: string; content: string }[];
  search_results?: { source: string; article: string; content: string; relevance: number }[];
  disclaimer?: string;
  timestamp: string;
}

export interface ConsultationHistory {
  id: string;
  question: string;
  answer_summary: string;
  timestamp: string;
}

// ============ Task ============
export type TaskType = 'case_review' | 'contract_review' | 'consultation_response' | 'document_draft' | 'escalation_handle' | 'general';
export type TaskStatus = 'pending' | 'accepted' | 'in_progress' | 'completed' | 'rejected' | 'cancelled';

export interface Task {
  task_id: string;
  title: string;
  description: string | null;
  task_type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  created_by: string;
  created_by_name?: string;
  assigned_to: string;
  assigned_to_name?: string;
  assigned_by: string;
  assigned_by_name?: string;
  entity_type: 'case' | 'contract' | 'consultation' | 'escalation' | null;
  entity_id: string | null;
  created_at: string;
  assigned_at: string | null;
  accepted_at: string | null;
  completed_at: string | null;
  deadline: string | null;
  result_summary: string | null;
  notes: string | null;
}

export type TaskPriority = 'low' | 'normal' | 'urgent' | 'critical';

// ============ Notification ============
export type NotificationType =
  | 'task_assigned'
  | 'task_accepted'
  | 'task_rejected'
  | 'task_completed'
  | 'review_completed'
  | 'approval_requested'
  | 'approval_result'
  | 'comment_added'
  | 'escalation_updated'
  | 'deadline_reminder';

export interface Notification {
  notification_id: string;
  user_id: string;
  title: string;
  body: string;
  notification_type: NotificationType;
  is_read: boolean;
  action_url: string | null;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
}

// ============ Approval ============
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface Approval {
  approval_id: string;
  entity_type: 'contract' | 'case' | 'document';
  entity_id: string;
  submitted_by: string;
  submitted_by_name?: string;
  approver_id: string;
  approver_name?: string;
  status: ApprovalStatus;
  comment: string | null;
  submitted_at: string;
  decided_at: string | null;
}

// ============ Comment ============
export interface Comment {
  comment_id: string;
  entity_type: 'case' | 'contract' | 'task' | 'approval';
  entity_id: string;
  user_id: string;
  user_name: string;
  content: string;
  parent_id: string | null;
  created_at: string;
}

// ============ Escalation ============
export type EscalationStatus = 'pending' | 'processing' | 'resolved' | 'closed';

export interface EscalationRequest {
  request_id: string;
  user_id: string;
  user_name: string;
  question: string;
  contact: string;
  priority: string;
  status: EscalationStatus;
  assigned_to: string | null;
  assigned_to_name?: string;
  assigned_at: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
  created_at: string;
}

// ============ Common ============
export interface ApiError {
  detail: string;
}

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface PagePermission {
  [page: string]: Role[];
}
