import type { Collection, Db, Filter } from "mongodb";
import type { WbsNode } from "../../../models/wbs";

export class NodesRepository {
  private collection: Collection<WbsNode>;

  constructor(db: Db, collectionName: string) {
    this.collection = db.collection<WbsNode>(collectionName);
  }

  async replaceForJob(jobId: string, nodes: WbsNode[]) {
    await this.collection.deleteMany({ jobId } as Filter<WbsNode>);
    if (nodes.length) {
      await this.collection.insertMany(nodes as any);
    }
  }

  async getForJob(jobId: string): Promise<WbsNode[]> {
    return this.collection.find({ jobId } as Filter<WbsNode>).toArray() as Promise<WbsNode[]>;
  }
}
