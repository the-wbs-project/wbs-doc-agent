import { getMongoClient } from "../mongoClient";
import { ArtifactsRepository } from "./artifactsRepo";
import { JobsRepository } from "./jobsRepo";
import { NodesRepository } from "./nodesRepo";

export class Repositories {
    readonly jobs: JobsRepository;
    readonly nodes: NodesRepository;
    readonly artifacts: ArtifactsRepository;

    private constructor(jobs: JobsRepository, nodes: NodesRepository, artifacts: ArtifactsRepository) {
        this.jobs = jobs;
        this.nodes = nodes;
        this.artifacts = artifacts;
    }

    static async create(env: Env): Promise<Repositories> {
        const client = await getMongoClient(env.MONGO_URI);
        const db = client.db(env.MONGO_DB);

        return new Repositories(
            new JobsRepository(db, env.MONGO_COLL_JOBS),
            new NodesRepository(db, env.MONGO_COLL_NODES),
            new ArtifactsRepository(db, env.MONGO_COLL_ARTIFACTS)
        );
    }
}
