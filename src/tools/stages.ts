import { z } from "zod";
import { GocdClient } from "@/client/gocd-client.js";
import { formatErrorResponse } from "@/utils/errors.js";

export const getStageInstanceSchema = z.object({
    pipelineName: z.string().describe("Name of the pipeline"),
    pipelineCounter: z.number().describe("Pipeline run counter"),
    stageName: z.string().describe("Name of the stage"),
    stageCounter: z.number().describe("Stage run counter (usually 1, higher for reruns)"),
});

export const triggerStageSchema = z.object({
    pipelineName: z.string().describe("Name of the pipeline"),
    pipelineCounter: z.number().describe("Pipeline run counter"),
    stageName: z.string().describe("Name of the stage to trigger"),
});

export const cancelStageSchema = z.object({
    pipelineName: z.string().describe("Name of the pipeline"),
    pipelineCounter: z.number().describe("Pipeline run counter"),
    stageName: z.string().describe("Name of the stage"),
    stageCounter: z.number().describe("Stage run counter"),
});

export const stageTools = [
    {
        name: "get_stage_instance",
        description: "Get details of a specific stage run including jobs and their states",
        inputSchema: {
            type: "object" as const,
            properties: {
                pipelineName: { type: "string", description: "Name of the pipeline" },
                pipelineCounter: { type: "number", description: "Pipeline run counter" },
                stageName: { type: "string", description: "Name of the stage" },
                stageCounter: {
                    type: "number",
                    description: "Stage run counter (usually 1, higher for reruns)",
                },
            },
            required: ["pipelineName", "pipelineCounter", "stageName", "stageCounter"],
        },
    },
    {
        name: "trigger_stage",
        description: "Manually trigger a specific stage in a pipeline run",
        inputSchema: {
            type: "object" as const,
            properties: {
                pipelineName: { type: "string", description: "Name of the pipeline" },
                pipelineCounter: { type: "number", description: "Pipeline run counter" },
                stageName: { type: "string", description: "Name of the stage to trigger" },
            },
            required: ["pipelineName", "pipelineCounter", "stageName"],
        },
    },
    {
        name: "cancel_stage",
        description: "Cancel a running stage and all its jobs",
        inputSchema: {
            type: "object" as const,
            properties: {
                pipelineName: { type: "string", description: "Name of the pipeline" },
                pipelineCounter: { type: "number", description: "Pipeline run counter" },
                stageName: { type: "string", description: "Name of the stage" },
                stageCounter: { type: "number", description: "Stage run counter" },
            },
            required: ["pipelineName", "pipelineCounter", "stageName", "stageCounter"],
        },
    },
];

export async function handleStageTool(
    client: GocdClient,
    token: string,
    toolName: string,
    args: Record<string, unknown>,
): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> {
    try {
        switch (toolName) {
            case "get_stage_instance": {
                const { pipelineName, pipelineCounter, stageName, stageCounter } = getStageInstanceSchema.parse(args);
                const instance = await client.getStageInstance(
                    token,
                    pipelineName,
                    pipelineCounter,
                    stageName,
                    stageCounter,
                );
                return {
                    content: [{ type: "text", text: JSON.stringify(instance, null, 2) }],
                };
            }

            case "trigger_stage": {
                const { pipelineName, pipelineCounter, stageName } = triggerStageSchema.parse(args);
                await client.triggerStage(token, pipelineName, pipelineCounter, stageName);
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                success: true,
                                message: `Stage ${stageName} triggered in ${pipelineName}/${pipelineCounter}`,
                            }),
                        },
                    ],
                };
            }

            case "cancel_stage": {
                const { pipelineName, pipelineCounter, stageName, stageCounter } = cancelStageSchema.parse(args);
                await client.cancelStage(token, pipelineName, pipelineCounter, stageName, stageCounter);
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                success: true,
                                message: `Stage ${stageName}/${stageCounter} cancelled in ${pipelineName}/${pipelineCounter}`,
                            }),
                        },
                    ],
                };
            }

            default:
                return {
                    content: [{ type: "text", text: `Unknown stage tool: ${toolName}` }],
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
