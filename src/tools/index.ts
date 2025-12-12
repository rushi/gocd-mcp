import { GoCDClient } from "@/client/gocd-client.js";
import { formatUnknownToolError } from "@/utils/responses.js";
import { pipelineTools, handlePipelineTool } from "./pipelines.js";
import { stageTools, handleStageTool } from "./stages.js";
import { jobTools, handleJobTool } from "./jobs.js";

export const allTools = [...pipelineTools, ...stageTools, ...jobTools];

export async function handleToolCall(
    client: GoCDClient,
    token: string,
    toolName: string,
    args: Record<string, unknown>,
): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> {
    // Create a token-bound client to simplify API calls
    const boundClient = client.withToken(token);

    if (pipelineTools.some((tool) => tool.name === toolName)) {
        return handlePipelineTool(boundClient, toolName, args);
    }

    if (stageTools.some((tool) => tool.name === toolName)) {
        return handleStageTool(boundClient, toolName, args);
    }

    if (jobTools.some((tool) => tool.name === toolName)) {
        return handleJobTool(boundClient, toolName, args);
    }

    return formatUnknownToolError(toolName);
}
