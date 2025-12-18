import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export type JobState = 'queued' | 'running' | 'completed' | 'failed';

export interface JobStatus {
  jobId: string;
  state: JobState;
  step: string;
  percent: number;
  messages: Array<{ ts: string; level: 'info' | 'warn' | 'error'; msg: string; data?: any }>;
  errors: Array<{ ts: string; msg: string; data?: any }>;
  updatedAt: string;
}

export interface WbsNode {
  jobId: string;
  id: string;
  parentId: string | null;
  title: string;
  description?: string | null;
  wbsLevel?: string | null;
  metadata: Array<{ key: string; value: string }>;
  provenance: {
    regionId: string;
    pageOrSheet: string;
    sourceType: 'table_cell' | 'paragraph_span' | 'unknown';
    quote: string;
  };
  inferred?: boolean;
  warnings?: string[];
}

export interface JobResult {
  jobId: string;
  mode: string;
  summary: string | null;
  qc: {
    nodeCount: number;
    inferredCount: number;
    coverageRatio: number;
  };
  nodes: WbsNode[];
  artifacts: { r2Prefix: string };
}

export interface UploadResponse {
  jobId: string;
}

@Injectable({ providedIn: 'root' })
export class JobsService {
  private http = inject(HttpClient);

  uploadFile(file: File, mode: 'strict' | 'best_judgment' = 'strict'): Observable<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('mode', mode);
    return this.http.post<UploadResponse>('/api/jobs', formData);
  }

  getStatus(jobId: string): Observable<JobStatus> {
    return this.http.get<JobStatus>(`/api/jobs/${jobId}/status`);
  }

  getResult(jobId: string): Observable<JobResult> {
    return this.http.get<JobResult>(`/api/jobs/${jobId}/result`);
  }
}

