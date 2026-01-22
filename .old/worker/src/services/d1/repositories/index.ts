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

  static create(env: Env): Repositories {
    const db = env.DB;
    return new Repositories(
      new JobsRepository(db),
      new NodesRepository(db),
      new ArtifactsRepository(db)
    );
  }
}

