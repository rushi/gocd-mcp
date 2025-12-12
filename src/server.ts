import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { GocdClient } from "./client/gocd-client.js";
import { allTools, handleToolCall } from "./tools/index.js";

export function createServer(client: GocdClient): Server {
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
        const { name, arguments: args } = request.params;
        return handleToolCall(client, name, (args as Record<string, unknown>) || {});
    });

    return server;
}
