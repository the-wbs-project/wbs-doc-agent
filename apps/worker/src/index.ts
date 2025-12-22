import { Hono } from "hono";
import { jobsRoute } from "./routes/jobs";
import { JobStatusDO } from "./status/statusDO";
import { WbsWorkflow } from "./workflows/wbsWorkflow";
import { cors } from "hono/cors";

const app = new Hono<{ Bindings: Env }>();

app.use("/api/*", cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "OPTIONS"],
}));
app.route("/api/jobs", jobsRoute);

app.get("/", (c) => c.text("wbs-json-pipeline OK"));

export default {
    fetch: app.fetch,
} satisfies ExportedHandler<Env>;

// Durable Object + Workflow exports
export { JobStatusDO, WbsWorkflow };
