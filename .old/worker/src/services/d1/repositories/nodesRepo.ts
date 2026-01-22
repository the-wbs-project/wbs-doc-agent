import type { WbsNode } from "../../../models/wbs";

export class NodesRepository {
  constructor(private db: D1Database) {}

  async replaceForJob(jobId: string, nodes: WbsNode[]) {
    // Delete existing nodes for this job first
    await this.db.prepare("DELETE FROM nodes WHERE job_id = ?").bind(jobId).run();

    if (!nodes.length) return;

    // Batch insert nodes (job_id first to match composite PK order)
    const stmt = this.db.prepare(
      `INSERT INTO nodes (job_id, id, parent_id, title, description, wbs_level, metadata, provenance, inferred, warnings)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const batch = nodes.map((node) =>
      stmt.bind(
        jobId,
        node.id,
        node.parentId,
        node.title,
        node.description ?? null,
        node.wbsLevel ?? null,
        JSON.stringify(node.metadata),
        JSON.stringify(node.provenance),
        node.inferred ? 1 : 0,
        JSON.stringify(node.warnings ?? [])
      )
    );

    await this.db.batch(batch);
  }

  async getForJob(jobId: string): Promise<WbsNode[]> {
    const { results } = await this.db
      .prepare("SELECT * FROM nodes WHERE job_id = ?")
      .bind(jobId)
      .all<{
        id: string;
        job_id: string;
        parent_id: string | null;
        title: string;
        description: string | null;
        wbs_level: string | null;
        metadata: string;
        provenance: string;
        inferred: number;
        warnings: string;
      }>();

    return results.map((row) => ({
      id: row.id,
      jobId: row.job_id,
      parentId: row.parent_id,
      title: row.title,
      description: row.description,
      wbsLevel: row.wbs_level,
      metadata: JSON.parse(row.metadata),
      provenance: JSON.parse(row.provenance),
      inferred: row.inferred === 1,
      warnings: JSON.parse(row.warnings),
    }));
  }
}

