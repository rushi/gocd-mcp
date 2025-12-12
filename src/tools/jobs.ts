import { z } from "zod";
import { GocdClient } from "../client/gocd-client.js";
import { formatErrorResponse } from "../utils/errors.js";

export const getJobHistorySchema = z.object({
    pipelineName: z.string().describe("Name of the pipeline"),
    stageName: z.string().describe("Name of the stage"),
    jobName: z.string().describe("Name of the job"),
    pageSize: z.number().optional().describe("Number of results per page (default: 10)"),
});

export const getJobInstanceSchema = z.object({
    pipelineName: z.string().describe("Name of the pipeline"),
    pipelineCounter: z.number().describe("Pipeline run counter"),
    stageName: z.string().describe("Name of the stage"),
    stageCounter: z.number().describe("Stage run counter"),
    jobName: z.string().describe("Name of the job"),
});

export const jobTools = [
    {
        name: "get_job_history",
        description: "Get the execution history of a specific job",
        inputSchema: {
            type: "object" as const,
            properties: {
                pipelineName: { type: "string", description: "Name of the pipeline" },
                stageName: { type: "string", description: "Name of the stage" },
                jobName: { type: "string", description: "Name of the job" },
                pageSize: { type: "number", description: "Number of results per page (default: 10)" },
            },
            required: ["pipelineName", "stageName", "jobName"],
        },
    },
    {
        name: "get_job_instance",
        description: "Get details of a specific job run including state, result, and agent information",
        inputSchema: {
            type: "object" as const,
            properties: {
                pipelineName: { type: "string", description: "Name of the pipeline" },
                pipelineCounter: { type: "number", description: "Pipeline run counter" },
                stageName: { type: "string", description: "Name of the stage" },
                stageCounter: { type: "number", description: "Stage run counter" },
                jobName: { type: "string", description: "Name of the job" },
            },
            required: ["pipelineName", "pipelineCounter", "stageName", "stageCounter", "jobName"],
        },
    },
];

export async function handleJobTool(
    client: GocdClient,
    toolName: string,
    args: Record<string, unknown>,
): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> {
    try {
        switch (toolName) {
            case "get_job_history": {
                const { pipelineName, stageName, jobName, pageSize } = getJobHistorySchema.parse(args);
                const history = await client.getJobHistory(pipelineName, stageName, jobName, pageSize);
                return {
                    content: [{ type: "text", text: JSON.stringify(history, null, 2) }],
                };
            }

            case "get_job_instance": {
                const { pipelineName, pipelineCounter, stageName, stageCounter, jobName } =
                    getJobInstanceSchema.parse(args);
                const instance = await client.getJobInstance(
                    pipelineName,
                    pipelineCounter,
                    stageName,
                    stageCounter,
                    jobName,
                );
                return {
                    content: [{ type: "text", text: JSON.stringify(instance, null, 2) }],
                };
            }

            default:
                return {
                    content: [{ type: "text", text: `Unknown job tool: ${toolName}` }],
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
