export class ArtifactsRepository {
  constructor(private db: D1Database) {}

  async record(jobId: string, artifactKey: string, r2Key: string, meta: Record<string, unknown> = {}) {
    await this.db
      .prepare(
        `INSERT INTO artifacts (job_id, artifact_key, r2_key, meta, created_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(jobId, artifactKey, r2Key, JSON.stringify(meta), new Date().toISOString())
      .run();
  }
}

