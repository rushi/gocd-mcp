import { z } from "zod";
import { BoundGoCDClient } from "@/client/gocd-client.js";
import { formatErrorResponse, formatJsonResponse } from "@/utils/errors.js";

export const listPipelinesSchema = z.object({});

export const getPipelineStatusSchema = z.object({
    pipelineName: z.string().describe("Name of the pipeline"),
});

export const getPipelineHistorySchema = z.object({
    pipelineName: z.string().describe("Name of the pipeline"),
    pageSize: z.number().optional().describe("Number of results per page (default: 10)"),
    after: z.number().optional().describe("Pipeline counter to start after (for pagination)"),
});

export const getPipelineInstanceSchema = z.object({
    pipelineName: z.string().describe("Name of the pipeline"),
    pipelineCounter: z.number().describe("Pipeline run counter/number"),
});

export const triggerPipelineSchema = z.object({
    pipelineName: z.string().describe("Name of the pipeline to trigger"),
    environmentVariables: z.record(z.string()).optional().describe("Environment variables to set for this run"),
    updateMaterials: z.boolean().optional().describe("Whether to update materials before running (default: true)"),
});

export const pausePipelineSchema = z.object({
    pipelineName: z.string().describe("Name of the pipeline to pause"),
    pauseCause: z.string().optional().describe("Reason for pausing the pipeline"),
});

export const unpausePipelineSchema = z.object({
    pipelineName: z.string().describe("Name of the pipeline to unpause"),
});

export const pipelineTools = [
    {
        name: "list_pipelines",
        description:
            "List all pipelines in the GoCD server with their groups and pause status. Use this to discover available pipelines, check which pipelines are paused, or browse the pipeline catalog. Good starting point when you don't know the exact pipeline name.",
        inputSchema: {
            type: "object" as const,
            properties: {},
            required: [],
        },
    },
    {
        name: "get_pipeline_status",
        description:
            "Get the current status of a pipeline including pause state (paused or not), lock status (locked by another run), and schedulability (can it run now). Use this to check if a pipeline is currently running, why it's not running, or if it's paused. Quick status check without full history.",
        inputSchema: {
            type: "object" as const,
            properties: {
                pipelineName: { type: "string", description: "Name of the pipeline" },
            },
            required: ["pipelineName"],
        },
    },
    {
        name: "get_pipeline_history",
        description:
            "Get the run history of a pipeline with pagination support. Use this to see recent pipeline runs, find the latest run, check historical results, or identify patterns in failures. Shows run numbers (counters), results, and stage information for each run. Essential for finding a specific pipeline run to investigate.",
        inputSchema: {
            type: "object" as const,
            properties: {
                pipelineName: { type: "string", description: "Name of the pipeline" },
                pageSize: { type: "number", description: "Number of results per page (default: 10)" },
                after: {
                    type: "number",
                    description: "Pipeline counter to start after (for pagination)",
                },
            },
            required: ["pipelineName"],
        },
    },
    {
        name: "get_pipeline_instance",
        description:
            "Get comprehensive details of a specific pipeline run including build cause (what triggered it), materials (git commits, dependencies), and all stages with their status. Use this to understand why a pipeline ran, what code was built, or see the full pipeline execution details. Essential for investigating a specific run.",
        inputSchema: {
            type: "object" as const,
            properties: {
                pipelineName: { type: "string", description: "Name of the pipeline" },
                pipelineCounter: { type: "number", description: "Pipeline run counter/number" },
            },
            required: ["pipelineName", "pipelineCounter"],
        },
    },
    {
        name: "trigger_pipeline",
        description:
            "Schedule and trigger a new pipeline run immediately, optionally with custom environment variables. Use this to manually start a pipeline, trigger a deployment, or run a pipeline with specific configuration. Can pass environment variables to customize the run behavior. Note: Pipeline must not be paused.",
        inputSchema: {
            type: "object" as const,
            properties: {
                pipelineName: { type: "string", description: "Name of the pipeline to trigger" },
                environmentVariables: {
                    type: "object",
                    additionalProperties: { type: "string" },
                    description: "Environment variables to set for this run",
                },
                updateMaterials: {
                    type: "boolean",
                    description: "Whether to update materials before running (default: true)",
                },
            },
            required: ["pipelineName"],
        },
    },
    {
        name: "pause_pipeline",
        description:
            "Pause a pipeline to prevent automatic scheduling and triggering. Use this to temporarily disable a pipeline during maintenance, stop automatic deployments, or prevent a problematic pipeline from running. Paused pipelines won't run automatically but can still be manually triggered. Can include a reason for the pause.",
        inputSchema: {
            type: "object" as const,
            properties: {
                pipelineName: { type: "string", description: "Name of the pipeline to pause" },
                pauseCause: { type: "string", description: "Reason for pausing the pipeline" },
            },
            required: ["pipelineName"],
        },
    },
    {
        name: "unpause_pipeline",
        description:
            "Unpause a previously paused pipeline to resume automatic scheduling and triggering. Use this to re-enable a pipeline after maintenance, restore normal operations, or allow automatic runs to resume. The pipeline will immediately become eligible for automatic triggering based on its material changes.",
        inputSchema: {
            type: "object" as const,
            properties: {
                pipelineName: { type: "string", description: "Name of the pipeline to unpause" },
            },
            required: ["pipelineName"],
        },
    },
];

export async function handlePipelineTool(
    client: BoundGoCDClient,
    toolName: string,
    args: Record<string, unknown>,
): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> {
    try {
        switch (toolName) {
            case "list_pipelines": {
                const pipelines = await client.listPipelines();
                return formatJsonResponse(pipelines);
            }

            case "get_pipeline_status": {
                const { pipelineName } = getPipelineStatusSchema.parse(args);
                const status = await client.getPipelineStatus(pipelineName);
                return formatJsonResponse(status);
            }

            case "get_pipeline_history": {
                const { pipelineName, pageSize, after } = getPipelineHistorySchema.parse(args);
                const history = await client.getPipelineHistory(pipelineName, pageSize, after);
                return formatJsonResponse(history);
            }

            case "get_pipeline_instance": {
                const { pipelineName, pipelineCounter } = getPipelineInstanceSchema.parse(args);
                const instance = await client.getPipelineInstance(pipelineName, pipelineCounter);
                return formatJsonResponse(instance);
            }

            case "trigger_pipeline": {
                const { pipelineName, environmentVariables, updateMaterials } = triggerPipelineSchema.parse(args);
                await client.triggerPipeline(pipelineName, { environmentVariables, updateMaterials });
                return formatJsonResponse({ success: true, message: `Pipeline ${pipelineName} triggered` });
            }

            case "pause_pipeline": {
                const { pipelineName, pauseCause } = pausePipelineSchema.parse(args);
                await client.pausePipeline(pipelineName, pauseCause);
                return formatJsonResponse({ success: true, message: `Pipeline ${pipelineName} paused` });
            }

            case "unpause_pipeline": {
                const { pipelineName } = unpausePipelineSchema.parse(args);
                await client.unpausePipeline(pipelineName);
                return formatJsonResponse({ success: true, message: `Pipeline ${pipelineName} unpaused` });
            }

            default:
                return {
                    content: [{ type: "text", text: `Unknown pipeline tool: ${toolName}` }],
                    isError: true,
                };
        }
    } catch (error) {
        return {
            content: [{ type: "text", text: formatErrorResponse(error) }],
            isError: true,
        };
    }
}
