import type { JobRecord } from "../../../models/job";

export class JobsRepository {
  constructor(private db: D1Database) {}

  async create(job: JobRecord) {
    await this.db
      .prepare(
        `INSERT INTO jobs (
          job_id, mode, state, filename, content_type, size_bytes,
          file_hash_sha256, r2_upload_key, r2_artifacts_prefix,
          created_at, updated_at, options
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        job.jobId,
        job.mode,
        job.state,
        job.filename,
        job.contentType,
        job.sizeBytes,
        job.fileHashSha256,
        job.r2UploadKey,
        job.r2ArtifactsPrefix,
        job.createdAt,
        job.updatedAt,
        job.options ? JSON.stringify(job.options) : null
      )
      .run();
  }

  async get(jobId: string): Promise<JobRecord> {
    const row = await this.db
      .prepare("SELECT * FROM jobs WHERE job_id = ?")
      .bind(jobId)
      .first<{
        job_id: string;
        mode: string;
        state: string;
        filename: string;
        content_type: string;
        size_bytes: number;
        file_hash_sha256: string;
        r2_upload_key: string;
        r2_artifacts_prefix: string;
        created_at: string;
        updated_at: string;
        node_count: number | null;
        inferred_count: number | null;
        ambiguous_count: number | null;
        coverage_ratio: number | null;
        options: string | null;
        summary: string | null;
        error: string | null;
      }>();

    if (!row) throw new Error(`Job not found: ${jobId}`);

    return {
      jobId: row.job_id,
      mode: row.mode as JobRecord["mode"],
      state: row.state as JobRecord["state"],
      filename: row.filename,
      contentType: row.content_type,
      sizeBytes: row.size_bytes,
      fileHashSha256: row.file_hash_sha256,
      r2UploadKey: row.r2_upload_key,
      r2ArtifactsPrefix: row.r2_artifacts_prefix,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      nodeCount: row.node_count ?? undefined,
      inferredCount: row.inferred_count ?? undefined,
      ambiguousCount: row.ambiguous_count ?? undefined,
      coverageRatio: row.coverage_ratio ?? undefined,
      options: row.options ? JSON.parse(row.options) : undefined,
      summary: row.summary ?? undefined,
    } as JobRecord & { summary?: string };
  }

  async markRunning(jobId: string) {
    await this.db
      .prepare("UPDATE jobs SET state = 'running', updated_at = ? WHERE job_id = ?")
      .bind(new Date().toISOString(), jobId)
      .run();
  }

  async markFailed(jobId: string, error: string) {
    await this.db
      .prepare("UPDATE jobs SET state = 'failed', updated_at = ?, error = ? WHERE job_id = ?")
      .bind(new Date().toISOString(), error, jobId)
      .run();
  }

  async markCompleted(jobId: string, patch: Partial<JobRecord>) {
    const updates: string[] = ["state = 'completed'", "updated_at = ?"];
    const values: (string | number | null)[] = [new Date().toISOString()];

    if (patch.nodeCount !== undefined) {
      updates.push("node_count = ?");
      values.push(patch.nodeCount);
    }
    if (patch.inferredCount !== undefined) {
      updates.push("inferred_count = ?");
      values.push(patch.inferredCount);
    }
    if (patch.ambiguousCount !== undefined) {
      updates.push("ambiguous_count = ?");
      values.push(patch.ambiguousCount);
    }
    if (patch.coverageRatio !== undefined) {
      updates.push("coverage_ratio = ?");
      values.push(patch.coverageRatio);
    }
    if ((patch as any).summary !== undefined) {
      updates.push("summary = ?");
      values.push((patch as any).summary);
    }

    values.push(jobId);

    await this.db
      .prepare(`UPDATE jobs SET ${updates.join(", ")} WHERE job_id = ?`)
      .bind(...values)
      .run();
  }
}

