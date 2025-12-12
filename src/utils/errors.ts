export class GocdApiError extends Error {
    constructor(
        public statusCode: number,
        public statusText: string,
        public endpoint: string,
        public responseBody?: string,
    ) {
        super(`GoCD API Error (${statusCode}): ${statusText} at ${endpoint}`);
        this.name = "GocdApiError";
    }
}

export function formatJsonResponse(data: unknown): { content: Array<{ type: "text"; text: string }> } {
    return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
}

export function formatErrorResponse(error: unknown): string {
    if (error instanceof GocdApiError) {
        if (error.statusCode === 401) {
            return JSON.stringify({
                error: true,
                code: "UNAUTHORIZED",
                message: "Authentication failed. Check GOCD_API_TOKEN.",
            });
        }
        if (error.statusCode === 403) {
            return JSON.stringify({
                error: true,
                code: "FORBIDDEN",
                message: `Permission denied for ${error.endpoint}`,
            });
        }
        if (error.statusCode === 404) {
            return JSON.stringify({
                error: true,
                code: "NOT_FOUND",
                message: `Resource not found: ${error.endpoint}`,
            });
        }
        return JSON.stringify({
            error: true,
            code: "API_ERROR",
            message: error.message,
            statusCode: error.statusCode,
        });
    }

    if (error instanceof Error) {
        return JSON.stringify({
            error: true,
            code: "ERROR",
            message: error.message,
        });
    }

    return JSON.stringify({
        error: true,
        code: "UNKNOWN_ERROR",
        message: String(error),
    });
}
