export interface McpServerConfig {
    host: string;
    port: number;
}

export interface GocdConfig {
    serverUrl: string;
}

export interface Config {
    mcp: McpServerConfig;
    gocd: GocdConfig;
}

export function loadConfig(): Config {
    const gocdServerUrl = process.env.GOCD_SERVER_URL;
    const mcpHost = process.env.MCP_HOST || "0.0.0.0";
    const mcpPort = parseInt(process.env.MCP_PORT || "3000", 10);

    if (!gocdServerUrl) {
        throw new Error("GOCD_SERVER_URL environment variable is required");
    }

    if (isNaN(mcpPort) || mcpPort < 1 || mcpPort > 65535) {
        throw new Error("MCP_PORT must be a valid port number (1-65535)");
    }

    return {
        mcp: {
            host: mcpHost,
            port: mcpPort,
        },
        gocd: {
            serverUrl: gocdServerUrl.replace(/\/+$/, ""),
        },
    };
}
