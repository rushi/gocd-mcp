export interface Config {
    serverUrl: string;
    apiToken: string;
}

export function loadConfig(): Config {
    const serverUrl = process.env.GOCD_SERVER_URL;
    const apiToken = process.env.GOCD_API_TOKEN;

    if (!serverUrl) {
        throw new Error("GOCD_SERVER_URL environment variable is required");
    }

    if (!apiToken) {
        throw new Error("GOCD_API_TOKEN environment variable is required");
    }

    return {
        serverUrl: serverUrl.replace(/\/+$/, ""),
        apiToken,
    };
}
