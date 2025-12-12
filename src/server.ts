import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { GoCDClient } from "@/client/gocd-client.js";
import { allTools, handleToolCall } from "@/tools/index.js";
import { getCurrentToken } from "@/index.js";

export function createServer(client: GoCDClient): Server {
    const server = new Server(
        {
            name: "gocd-mcp",
            version: "1.0.0",
        },
        {
            capabilities: {
                tools: {},
            },
        },
    );

    server.setRequestHandler(ListToolsRequestSchema, async () => {
        return { tools: allTools };
    });

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        // Get token from current request context
        const token = getCurrentToken();

        if (!token) {
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            error: true,
                            code: "UNAUTHORIZED",
                            message: "GoCD API token is required. Please provide a Bearer token for authentication.",
                        }),
                    },
                ],
                isError: true,
            };
        }

        const { name, arguments: args } = request.params;
        return handleToolCall(client, token, name, (args as Record<string, unknown>) || {});
    });

    return server;
}
