import { GocdClient } from "@/client/gocd-client.js";
import { pipelineTools, handlePipelineTool } from "./pipelines.js";
import { stageTools, handleStageTool } from "./stages.js";
import { jobTools, handleJobTool } from "./jobs.js";

export const allTools = [...pipelineTools, ...stageTools, ...jobTools];

export async function handleToolCall(
    client: GocdClient,
    toolName: string,
    args: Record<string, unknown>,
): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> {
    if (pipelineTools.some((t) => t.name === toolName)) {
        return handlePipelineTool(client, toolName, args);
    }

    if (stageTools.some((t) => t.name === toolName)) {
        return handleStageTool(client, toolName, args);
    }

    if (jobTools.some((t) => t.name === toolName)) {
        return handleJobTool(client, toolName, args);
    }

    return {
        content: [{ type: "text", text: `Unknown tool: ${toolName}` }],
        isError: true,
    };
}
