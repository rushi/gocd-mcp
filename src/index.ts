#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { GocdClient } from "./client/gocd-client.js";
import { createServer } from "./server.js";

async function main(): Promise<void> {
    const config = loadConfig();
    const client = new GocdClient(config);
    const server = createServer(client);

    const transport = new StdioServerTransport();
    await server.connect(transport);

    // stdout is reserved for MCP protocol
    console.error("GoCD MCP server running on stdio");
}

main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
