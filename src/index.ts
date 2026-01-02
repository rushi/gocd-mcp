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

/**
 * Check if the request body is an MCP initialize request
 */
function isInitializeRequest(body: unknown): boolean {
    if (!body || typeof body !== "object") {
        return false;
    }

    // Handle single request
    if ("method" in body && (body as { method: string }).method === "initialize") {
        return true;
    }

    // Handle batch requests - check if any is an initialize request
    if (Array.isArray(body)) {
        return body.some((msg) => msg && typeof msg === "object" && "method" in msg && msg.method === "initialize");
    }

    return false;
}

async function main(): Promise<void> {
    debug.server("Starting GoCD MCP server");
    const config = loadConfig();
    debug.server("Config loaded: %O", { host: config.mcp.host, port: config.mcp.port, gocdUrl: config.gocd.serverUrl });

    const client = new GoCDClient(config.gocd);
    debug.client("GoCD client initialized for %s", config.gocd.serverUrl);

    const mcpServer = createServer(client);

    // Store active transports by session ID for stateful mode
    const transports = new Map<string, StreamableHTTPServerTransport>();

    debug.server("MCP server initialized (stateful mode with per-session transports)");

    const fastify = Fastify({ logger: false, disableRequestLogging: true });

    await fastify.register(compress, { encodings: ["gzip", "deflate"] });

    fastify.addHook("onSend", async (_request, reply) => {
        reply.removeHeader("X-Powered-By");
    });

    fastify.all("/mcp", async (request, reply) => {
        const authHeader = request.headers.authorization;
        const match = authHeader?.match(/^Bearer\s+(.+)$/i);
        const hasToken = !!match;
        const sessionId = request.headers["mcp-session-id"] as string | undefined;

        debug.http(
            "MCP request received: %s %s (hasToken: %s, sessionId: %s)",
            request.method,
            request.url,
            hasToken,
            sessionId ?? "none",
        );

        // Store token for this request (Node.js single-threaded execution ensures safety)
        currentRequestToken = match ? match[1] : undefined;

        try {
            // Check for existing session transport
            let transport = sessionId ? transports.get(sessionId) : undefined;

            // Handle initialization requests (no session ID yet)
            if (!transport) {
                // For non-initialization requests with invalid/missing session, return error
                const isInitRequest = request.method === "POST" && isInitializeRequest(request.body);

                if (!isInitRequest && sessionId) {
                    debug.session("Session not found: %s - client should reinitialize", sessionId);
                    reply.code(404).send({
                        jsonrpc: "2.0",
                        error: { code: -32000, message: "Session not found. Please reinitialize." },
                        id: null,
                    });
                    return;
                }

                // Create new transport for new session
                transport = new StreamableHTTPServerTransport({
                    sessionIdGenerator: () => randomUUID(),
                    onsessioninitialized: (id) => {
                        debug.session("Session initialized: %s", id);
                        console.error(`MCP session initialized: ${id}`);
                        transports.set(id, transport!);
                    },
                    onsessionclosed: (id) => {
                        debug.session("Session closed: %s", id);
                        console.error(`MCP session closed: ${id}`);
                        transports.delete(id);
                    },
                });

                // Connect new transport to the MCP server
                await mcpServer.connect(transport);
                debug.session("New transport created and connected");
            }

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
