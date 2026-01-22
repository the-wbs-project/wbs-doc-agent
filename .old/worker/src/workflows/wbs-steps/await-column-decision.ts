import type { WorkflowStep } from "cloudflare:workers";
import type { GlobalAnalysis } from "../../models/globalAnalysis";
import type { WbsWorkflowContext } from "../../models/wbs-workflow-context";
import type { Logger } from "../../services/logger";
import { setStatus } from "../../status/statusClient";

export type ColumnDecision = {
    treatAsNodes: boolean;
};

/**
 * Checks if the document is a matrix with column headers and needs user decision.
 * If so, pauses the workflow and waits for user input.
 */
export async function awaitColumnDecisionStep(
    ctx: WbsWorkflowContext,
    env: Env,
    globalAnalysis: GlobalAnalysis,
    step: WorkflowStep,
    logger: Logger
): Promise<ColumnDecision | null> {
    const columnHeaders = globalAnalysis.structuralElements.columnHeaders;
    const isMatrix = globalAnalysis.documentPattern === "matrix" || globalAnalysis.structuralElements.hasPhaseColumns;

    // If not a matrix or no column headers detected, skip
    if (!isMatrix || !columnHeaders || columnHeaders.length === 0) {
        logger.info("column-decision - skipped (not matrix or no columns)");
        return null;
    }

    logger.info("column-decision - awaiting user input", { columnHeaders });

    // Set status to awaiting_input with the question
    await setStatus(ctx.job.jobId, env.JOB_STATUS_DO, {
        state: "awaiting_input",
        step: "column_decision",
        percent: 28,
        message: "Waiting for user decision on column headers",
        pendingInput: {
            type: "column_decision",
            columnHeaders,
            documentPattern: globalAnalysis.documentPattern,
            message: `This document appears to be a matrix layout with the following column headers: ${columnHeaders.join(", ")}. Should these columns be treated as WBS nodes (tasks/phases) or just as informational organization?`
        }
    });

    // Wait for user to submit their decision
    const event = await step.waitForEvent<{ type: string; payload: ColumnDecision }>("user makes column decision.", {
        type: "column_decision",
        timeout: "24 hours"
    });

    const decision = event.payload as unknown as ColumnDecision;
    logger.info("column-decision - received", { treatAsNodes: decision.treatAsNodes });

    // Clear pending input and resume
    await setStatus(ctx.job.jobId, env.JOB_STATUS_DO, {
        state: "running",
        step: "extract_regions",
        percent: 30,
        message: `Column decision: ${decision.treatAsNodes ? "Treat as WBS nodes" : "Treat as informational only"}`,
        pendingInput: undefined
    });

    return decision;
}
