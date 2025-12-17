export type JobMode = "strict" | "best_judgment";
export type JobState = "queued" | "running" | "completed" | "failed";

export type JobRecord = {
  jobId: string;
  mode: JobMode;
  state: JobState;

  filename: string;
  contentType: string;
  sizeBytes: number;
  fileHashSha256: string;

  r2UploadKey: string;
  r2ArtifactsPrefix: string;

  createdAt: string;
  updatedAt: string;

  nodeCount?: number;
  inferredCount?: number;
  ambiguousCount?: number;
  coverageRatio?: number;

  options?: Record<string, any>;
};
