import { z } from "zod";
import { BoundGoCDClient } from "@/client/gocd-client.js";
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
        description:
            "Get details of a specific stage run including all jobs, their states (Scheduled, Building, Completed), results (Passed, Failed), and approval information. Use this to see which jobs failed in a stage, check stage status, or understand the overall stage execution. Essential for identifying which job to investigate when a stage fails.",
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
        description:
            "Manually trigger or rerun a specific stage in a pipeline. Use this to retry a failed stage, run a manual approval stage, or trigger a stage that requires manual intervention. Common for deployment stages or stages with manual approval gates.",
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
        description:
            "Cancel a running stage and all its jobs immediately. Use this to stop a long-running stage, abort a deployment that's going wrong, or cancel jobs that are stuck or no longer needed. All running jobs in the stage will be terminated.",
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
    client: BoundGoCDClient,
    toolName: string,
    args: Record<string, unknown>,
): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> {
    try {
        switch (toolName) {
            case "get_stage_instance": {
                const { pipelineName, pipelineCounter, stageName, stageCounter } = getStageInstanceSchema.parse(args);
                const instance = await client.getStageInstance(pipelineName, pipelineCounter, stageName, stageCounter);
                return {
                    content: [{ type: "text", text: JSON.stringify(instance, null, 2) }],
                };
            }

            case "trigger_stage": {
                const { pipelineName, pipelineCounter, stageName } = triggerStageSchema.parse(args);
                await client.triggerStage(pipelineName, pipelineCounter, stageName);
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
                await client.cancelStage(pipelineName, pipelineCounter, stageName, stageCounter);
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
