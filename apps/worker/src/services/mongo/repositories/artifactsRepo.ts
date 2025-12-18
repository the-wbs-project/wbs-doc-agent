import type { Collection, Db } from "mongodb";

interface Artifact {
  jobId: string;
  artifactKey: string;
  r2Key: string;
  meta: Record<string, unknown>;
  createdAt: Date;
}

export class ArtifactsRepository {
  private collection: Collection<Artifact>;

  constructor(db: Db, collectionName: string) {
    this.collection = db.collection<Artifact>(collectionName);
  }

  async record(jobId: string, artifactKey: string, r2Key: string, meta: Record<string, unknown> = {}) {
    await this.collection.insertOne({
      jobId,
      artifactKey,
      r2Key,
      meta,
      createdAt: new Date(),
    });
  }
}
