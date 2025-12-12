#!/usr/bin/env node

import Fastify from "fastify";
import compress from "@fastify/compress";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { randomUUID } from "crypto";
import { loadConfig } from "@/config.js";
import { GoCDClient } from "@/client/gocd-client.js";
import { createServer } from "@/server.js";

// Request-scoped token storage (safe due to Node.js single-threaded execution)
let currentRequestToken: string | undefined;

export function getCurrentToken(): string | undefined {
    return currentRequestToken;
}

async function main(): Promise<void> {
    const config = loadConfig();
    const client = new GoCDClient(config.gocd);

    // Create a single MCP server instance
    const mcpServer = createServer(client);

    // Create a single transport that will handle all sessions
    const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id) => {
            console.error(`MCP session initialized: ${id}`);
        },
        onsessionclosed: (id) => {
            console.error(`MCP session closed: ${id}`);
        },
    });

    // Connect the server to the transport once
    await mcpServer.connect(transport);

    // Create Fastify instance
    const fastify = Fastify({
        logger: false,
        disableRequestLogging: true,
    });

    // Register compression plugin for gzip responses
    await fastify.register(compress, {
        encodings: ["gzip", "deflate"],
    });

    // Remove X-Powered-By header
    fastify.addHook("onSend", async (_request, reply) => {
        reply.removeHeader("X-Powered-By");
    });

    // Handle all MCP protocol requests through the single transport
    fastify.all("/mcp", async (request, reply) => {
        // Extract Authorization header
        const authHeader = request.headers.authorization;
        const match = authHeader?.match(/^Bearer\s+(.+)$/i);

        // Store token for this request (Node.js single-threaded execution ensures safety)
        currentRequestToken = match ? match[1] : undefined;

        try {
            // The transport handles session management internally
            await transport.handleRequest(request.raw, reply.raw, request.body);
        } finally {
            // Clear token after request completes
            currentRequestToken = undefined;
        }
    });

    // Health check endpoint
    fastify.get("/health", async () => {
        return { status: "ok", service: "gocd-mcp" };
    });

    // Graceful shutdown handlers
    const closeGracefully = async (signal: string) => {
        console.error(`${signal} received, shutting down gracefully`);
        await fastify.close();
        console.error("Server closed");
        process.exit(0);
    };

    process.on("SIGTERM", () => closeGracefully("SIGTERM"));
    process.on("SIGINT", () => closeGracefully("SIGINT"));

    // Start server
    try {
        await fastify.listen({
            port: config.mcp.port,
            host: config.mcp.host,
        });

        console.error(`GoCD MCP server listening on http://${config.mcp.host}:${config.mcp.port}`);
        console.error(`MCP endpoint: http://${config.mcp.host}:${config.mcp.port}/mcp`);
        console.error(`Health check: http://${config.mcp.host}:${config.mcp.port}/health`);
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
}

main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
