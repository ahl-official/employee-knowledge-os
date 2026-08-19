/** Shared domain types mirroring the Supabase schema. */

export type EmployeeStatus = "invited" | "in_progress" | "completed";

export interface Employee {
  id: string;
  full_name: string;
  department: string | null;
  designation: string | null;
  reporting_manager: string | null;
  experience: string | null;
  main_responsibility: string | null;
  access_token: string;
  status: EmployeeStatus;
  overall_progress: number; // 0-100
  current_task_id: string | null;
  created_at: string;
  updated_at: string;
  last_activity: string | null;
}

export type MessageRole = "assistant" | "user" | "system";

export interface Message {
  id: string;
  employee_id: string;
  session_id: string | null;
  role: MessageRole;
  content: string;
  task_id: string | null;
  created_at: string;
}

/** The 12 coverage dimensions per task (0-100 each). */
export interface Coverage {
  work_source: number;
  inputs: number;
  steps: number;
  research: number;
  tools: number;
  decisions: number;
  exceptions: number;
  failure_handling: number;
  quality_check: number;
  approval: number;
  output: number;
  evidence: number;
}

export const COVERAGE_KEYS: (keyof Coverage)[] = [
  "work_source",
  "inputs",
  "steps",
  "research",
  "tools",
  "decisions",
  "exceptions",
  "failure_handling",
  "quality_check",
  "approval",
  "output",
  "evidence",
];

export type TaskStatus = "pending" | "active" | "completed";

export interface Task {
  id: string;
  employee_id: string;
  name: string;
  frequency: string | null;
  priority: string | null;
  status: TaskStatus;
  coverage: Coverage;
  created_at: string;
  updated_at: string;
}

export interface Fact {
  id: string;
  employee_id: string;
  task_id: string | null;
  message_id: string | null;
  category: string;
  fact_text: string;
  source: string;
  created_at: string;
}

export type BranchStatus = "open" | "resolved";

export interface Branch {
  id: string;
  employee_id: string;
  task_id: string | null;
  topic: string;
  priority: "critical" | "high" | "medium" | "low";
  status: BranchStatus;
  suggested_question: string | null;
  created_at: string;
  resolved_at: string | null;
}

/** Structured JSON the LLM must return for each employee answer. */
export interface AIAnalysis {
  answer_summary: string;
  facts: { category: string; fact_text: string }[];
  new_terms: string[];
  new_tasks: { name: string; frequency?: string; priority?: string }[];
  new_branches: {
    topic: string;
    priority: "critical" | "high" | "medium" | "low";
    reason: string;
    suggested_question: string;
  }[];
  resolved_branch_topics: string[];
  coverage_update: Partial<Coverage>;
  current_task_complete: boolean;
  recommended_next_question: string;
  confidence: number; // 0-1
  requires_human_review: boolean;
}
