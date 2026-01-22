export type JobStateValue = "pending" | "running" | "awaiting_input" | "completed" | "failed";

/** Status update from n8n */
export interface StatusUpdate {
  step: string;
  message: string;
  percent?: number;
  state?: JobStateValue;
  data?: Record<string, unknown>;
}

/** HITL question from n8n */
export interface Question {
  id: string;
  type: string;
  message: string;
  options?: string[];
  data?: Record<string, unknown>;
  askedAt: string;
  answeredAt?: string;
  answer?: unknown;
}

/** Answer from the site */
export interface Answer {
  questionId: string;
  answer: unknown;
}

/** Full job state stored in DO and broadcast via WebSocket */
export interface JobData {
  jobId: string;
  state: JobStateValue;
  step: string;
  percent: number;
  statuses: StatusUpdate[];
  questions: Question[];
  artifacts: string[];
  createdAt: string;
  updatedAt: string;
}

/** Artifact metadata */
export interface ArtifactMeta {
  name: string;
  size: number;
  contentType: string;
  uploadedAt: string;
}
