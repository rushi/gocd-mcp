#!/usr/bin/env node

import Fastify from "fastify";
import compress from "@fastify/compress";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { randomUUID } from "crypto";
import { loadConfig } from "@/config.js";
import { GoCDClient } from "@/client/gocd-client.js";
import { createServer } from "@/server.js";
import { debug } from "@/utils/debug.js";

// Request-scoped token storage (safe due to Node.js single-threaded execution)
let currentRequestToken: string | undefined;

export function getCurrentToken(): string | undefined {
    return currentRequestToken;
}

async function main(): Promise<void> {
    debug.server("Starting GoCD MCP server");
    const config = loadConfig();
    debug.server("Config loaded: %O", { host: config.mcp.host, port: config.mcp.port, gocdUrl: config.gocd.serverUrl });

    const client = new GoCDClient(config.gocd);
    debug.client("GoCD client initialized for %s", config.gocd.serverUrl);

    const mcpServer = createServer(client);

    const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id) => {
            debug.session("Session initialized: %s", id);
            console.error(`MCP session initialized: ${id}`);
        },
        onsessionclosed: (id) => {
            debug.session("Session closed: %s", id);
            console.error(`MCP session closed: ${id}`);
        },
    });

    await mcpServer.connect(transport);
    debug.server("MCP server connected to transport");

    const fastify = Fastify({ logger: false, disableRequestLogging: true });

    await fastify.register(compress, { encodings: ["gzip", "deflate"] });

    fastify.addHook("onSend", async (_request, reply) => {
        reply.removeHeader("X-Powered-By");
    });

    fastify.all("/mcp", async (request, reply) => {
        const authHeader = request.headers.authorization;
        const match = authHeader?.match(/^Bearer\s+(.+)$/i);
        const hasToken = !!match;

        debug.http("MCP request received: %s %s (hasToken: %s)", request.method, request.url, hasToken);

        // Store token for this request (Node.js single-threaded execution ensures safety)
        currentRequestToken = match ? match[1] : undefined;

        try {
            // Transport handles session management internally
            await transport.handleRequest(request.raw, reply.raw, request.body);
            debug.http("MCP request completed: %s %s", request.method, request.url);
        } finally {
            // Clear token after request completes
            currentRequestToken = undefined;
        }
    });

    fastify.get("/health", async () => {
        return { status: "ok", service: "gocd-mcp" };
    });

    const closeGracefully = async (signal: string) => {
        debug.server("Received %s signal, initiating graceful shutdown", signal);
        console.error(`${signal} received, shutting down gracefully`);
        await fastify.close();
        debug.server("Server closed");
        console.error("Server closed");
        process.exit(0);
    };

    process.on("SIGTERM", () => closeGracefully("SIGTERM"));
    process.on("SIGINT", () => closeGracefully("SIGINT"));

    try {
        await fastify.listen({ port: config.mcp.port, host: config.mcp.host });

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
