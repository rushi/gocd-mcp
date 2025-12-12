import { GocdClient } from "@/client/gocd-client.js";
import { pipelineTools, handlePipelineTool } from "./pipelines.js";
import { stageTools, handleStageTool } from "./stages.js";
import { jobTools, handleJobTool } from "./jobs.js";

export const allTools = [...pipelineTools, ...stageTools, ...jobTools];

export async function handleToolCall(
    client: GocdClient,
    token: string,
    toolName: string,
    args: Record<string, unknown>,
): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> {
    if (pipelineTools.some((tool) => tool.name === toolName)) {
        return handlePipelineTool(client, token, toolName, args);
    }

    if (stageTools.some((tool) => tool.name === toolName)) {
        return handleStageTool(client, token, toolName, args);
    }

    if (jobTools.some((tool) => tool.name === toolName)) {
        return handleJobTool(client, token, toolName, args);
    }

    return {
        content: [{ type: "text", text: `Unknown tool: ${toolName}` }],
        isError: true,
    };
}
