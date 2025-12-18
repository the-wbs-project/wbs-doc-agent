import { Hono } from "hono";
import { jobsRoute } from "./routes/jobs";
import { JobStatusDO } from "./status/statusDO";
import { WbsWorkflow } from "./workflows/wbsWorkflow";

const app = new Hono<{ Bindings: Env }>();

app.route("/", jobsRoute);

app.get("/", (c) => c.text("wbs-json-pipeline OK"));

export default {
    fetch: app.fetch,
} satisfies ExportedHandler<Env>;

// Durable Object + Workflow exports
export { JobStatusDO, WbsWorkflow };
