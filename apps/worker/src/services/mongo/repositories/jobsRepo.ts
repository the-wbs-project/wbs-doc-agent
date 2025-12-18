import { ObjectId, type Collection, type Db, type Filter } from "mongodb";
import type { JobRecord } from "../../../models/job";

export class JobsRepository {
  private collection: Collection<JobRecord>;

  constructor(db: Db, collectionName: string) {
    this.collection = db.collection<JobRecord>(collectionName);
  }

  async create(job: JobRecord) {
    await this.collection.insertOne({ ...job, _id: new ObjectId(job.jobId) });
  }

  async get(jobId: string): Promise<JobRecord> {
    const doc = await this.collection.findOne({ _id: new ObjectId(jobId) }) as JobRecord & { _id?: ObjectId };
    if (!doc) throw new Error(`Job not found: ${jobId}`);

    delete doc._id;

    return doc;
  }

  async markRunning(jobId: string) {
    await this.collection.updateOne(
      { _id: new ObjectId(jobId) },
      { $set: { state: "running", updatedAt: new Date().toISOString() } }
    );
  }

  async markFailed(jobId: string, error: string) {
    await this.collection.updateOne(
      { _id: new ObjectId(jobId) },
      { $set: { state: "failed", updatedAt: new Date().toISOString(), error } }
    );
  }

  async markCompleted(jobId: string, patch: Partial<JobRecord>) {
    await this.collection.updateOne(
      { _id: new ObjectId(jobId) },
      { $set: { ...patch, state: "completed", updatedAt: new Date().toISOString() } }
    );
  }
}
