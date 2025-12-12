import { z } from "zod";
import { GocdClient } from "../client/gocd-client.js";
import { formatErrorResponse } from "../utils/errors.js";

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
        description: "List all pipelines in the GoCD server with their groups and pause status",
        inputSchema: {
            type: "object" as const,
            properties: {},
            required: [],
        },
    },
    {
        name: "get_pipeline_status",
        description: "Get the current status of a pipeline including pause state, lock status, and schedulability",
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
        description: "Get the run history of a pipeline with pagination support",
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
        description: "Get details of a specific pipeline run including build cause, materials, and stages",
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
        description: "Schedule/trigger a pipeline run, optionally with environment variables",
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
        description: "Pause a pipeline to prevent automatic scheduling",
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
        description: "Unpause a previously paused pipeline",
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
    client: GocdClient,
    toolName: string,
    args: Record<string, unknown>,
): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> {
    try {
        switch (toolName) {
            case "list_pipelines": {
                const pipelines = await client.listPipelines();
                return {
                    content: [{ type: "text", text: JSON.stringify(pipelines, null, 2) }],
                };
            }

            case "get_pipeline_status": {
                const { pipelineName } = getPipelineStatusSchema.parse(args);
                const status = await client.getPipelineStatus(pipelineName);
                return {
                    content: [{ type: "text", text: JSON.stringify(status, null, 2) }],
                };
            }

            case "get_pipeline_history": {
                const { pipelineName, pageSize, after } = getPipelineHistorySchema.parse(args);
                const history = await client.getPipelineHistory(pipelineName, pageSize, after);
                return {
                    content: [{ type: "text", text: JSON.stringify(history, null, 2) }],
                };
            }

            case "get_pipeline_instance": {
                const { pipelineName, pipelineCounter } = getPipelineInstanceSchema.parse(args);
                const instance = await client.getPipelineInstance(pipelineName, pipelineCounter);
                return {
                    content: [{ type: "text", text: JSON.stringify(instance, null, 2) }],
                };
            }

            case "trigger_pipeline": {
                const { pipelineName, environmentVariables, updateMaterials } = triggerPipelineSchema.parse(args);
                await client.triggerPipeline(pipelineName, { environmentVariables, updateMaterials });
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({ success: true, message: `Pipeline ${pipelineName} triggered` }),
                        },
                    ],
                };
            }

            case "pause_pipeline": {
                const { pipelineName, pauseCause } = pausePipelineSchema.parse(args);
                await client.pausePipeline(pipelineName, pauseCause);
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({ success: true, message: `Pipeline ${pipelineName} paused` }),
                        },
                    ],
                };
            }

            case "unpause_pipeline": {
                const { pipelineName } = unpausePipelineSchema.parse(args);
                await client.unpausePipeline(pipelineName);
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({ success: true, message: `Pipeline ${pipelineName} unpaused` }),
                        },
                    ],
                };
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
