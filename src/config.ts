import { readFileSync } from "node:fs";

export interface McpServerConfig {
    host: string;
    port: number;
}

export interface GocdConfig {
    serverUrl: string;
    /** When false, the TLS certificate of the GoCD server is not verified. */
    rejectUnauthorized: boolean;
    /** PEM-encoded CA certificate used to verify the GoCD server. */
    caCert?: string;
}

export interface Config {
    mcp: McpServerConfig;
    gocd: GocdConfig;
}

export function loadConfig(): Config {
    const gocdServerUrl = process.env.GOCD_SERVER_URL;
    const mcpHost = process.env.MCP_HOST || "0.0.0.0";
    const mcpPort = parseInt(process.env.MCP_PORT || "3000", 10);
    const rejectUnauthorized = process.env.GOCD_REJECT_UNAUTHORIZED !== "false";
    const caCertPath = process.env.GOCD_CA_CERT;

    if (!gocdServerUrl) {
        throw new Error("GOCD_SERVER_URL environment variable is required");
    }

    if (isNaN(mcpPort) || mcpPort < 1 || mcpPort > 65535) {
        throw new Error("MCP_PORT must be a valid port number (1-65535)");
    }

    let caCert: string | undefined;

    if (caCertPath) {
        try {
            caCert = readFileSync(caCertPath, "utf8");
        } catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            throw new Error(`GOCD_CA_CERT could not be read from "${caCertPath}": ${reason}`);
        }
    }

    if (!rejectUnauthorized) {
        console.error(
            "WARNING: GOCD_REJECT_UNAUTHORIZED=false. TLS certificates from the GoCD server are not verified, which allows man-in-the-middle attacks. Prefer GOCD_CA_CERT.",
        );
    }

    return {
        mcp: { host: mcpHost, port: mcpPort },
        gocd: { serverUrl: gocdServerUrl.replace(/\/+$/, ""), rejectUnauthorized, caCert },
    };
}
