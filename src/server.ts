import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { GoCDClient } from "@/client/gocd-client.js";
import { allTools, handleToolCall } from "@/tools/index.js";
import { getCurrentToken } from "@/index.js";
import { formatJsonResponse } from "@/utils/responses.js";
import { debug } from "@/utils/debug.js";
import packageJson from "../package.json" with { type: "json" };

export function createServer(client: GoCDClient): Server {
    debug.server("Creating MCP server v%s", packageJson.version);
    const server = new Server({ name: "gocd-mcp", version: packageJson.version }, { capabilities: { tools: {} } });

    server.setRequestHandler(ListToolsRequestSchema, async () => {
        debug.tools("Listing %d available tools", allTools.length);
        return { tools: allTools };
    });

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        debug.tools("Tool call received: %s with args: %O", name, args);

        const token = getCurrentToken();

        if (!token) {
            debug.tools("Tool call rejected: no auth token provided");
            return {
                ...formatJsonResponse({
                    error: true,
                    code: "UNAUTHORIZED",
                    message: "GoCD API token is required. Please provide a Bearer token for authentication.",
                }),
                isError: true,
            };
        }

        const result = await handleToolCall(client, token, name, (args as Record<string, unknown>) || {});
        debug.tools("Tool call completed: %s (isError: %s)", name, result.isError ?? false);
        return result;
    });

    return server;
}
