import got, { Got, HTTPError } from "got";
import pino from "pino";
import { Config } from "../config.js";
import { GocdApiError } from "../utils/errors.js";
import {
    Pipeline,
    PipelineStatus,
    PipelineInstance,
    PipelineHistory,
    StageInstance,
    JobHistory,
    JobInstance,
    DashboardResponse,
    DashboardPipeline,
    TriggerOptions,
} from "./types.js";

const logger = pino(
    {
        name: "gocd-client",
        level: process.env.LOG_LEVEL || "info",
    },
    process.stderr,
);

export class GocdClient {
    private baseUrl: string;
    private token: string;
    private client: Got;

    constructor(config: Config) {
        this.baseUrl = config.serverUrl;
        this.token = config.apiToken;

        this.client = got.extend({
            prefixUrl: `${this.baseUrl}/go/api`,
            headers: {
                Authorization: `Bearer ${this.token}`,
            },
            timeout: {
                request: 30000,
            },
            retry: {
                limit: 2,
                methods: ["GET"],
            },
            hooks: {
                beforeRequest: [
                    (options) => {
                        logger.debug({ url: options.url?.toString(), method: options.method }, "Making API request");
                    },
                ],
                afterResponse: [
                    (response) => {
                        logger.debug(
                            { url: response.url, statusCode: response.statusCode },
                            "Received API response",
                        );
                        return response;
                    },
                ],
            },
        });
    }

    private async request<T>(
        method: "GET" | "POST" | "DELETE",
        path: string,
        apiVersion: string,
        body?: object,
    ): Promise<T> {
        const normalizedPath = path.startsWith("/") ? path.substring(1) : path;

        const headers: Record<string, string> = {
            Accept: `application/vnd.go.cd.${apiVersion}+json`,
        };

        if (path.includes("/cancel") || path.includes("/unpause") || path.includes("/pause")) {
            headers["X-GoCD-Confirm"] = "true";
        }

        try {
            const response = await this.client<T>(normalizedPath, {
                method,
                headers,
                json: body,
                responseType: "json",
                throwHttpErrors: false,
            });

            if (response.statusCode >= 400) {
                logger.error(
                    {
                        statusCode: response.statusCode,
                        path: normalizedPath,
                        body: response.body,
                    },
                    "API request failed",
                );
                throw new GocdApiError(
                    response.statusCode,
                    response.statusMessage || "Unknown error",
                    normalizedPath,
                    typeof response.body === "string" ? response.body : JSON.stringify(response.body),
                );
            }

            if (response.statusCode === 202 || response.statusCode === 204) {
                return { success: true } as T;
            }

            if (!response.body || (typeof response.body === "object" && Object.keys(response.body).length === 0)) {
                return { success: true } as T;
            }

            return response.body;
        } catch (error) {
            if (error instanceof HTTPError) {
                logger.error(
                    {
                        statusCode: error.response.statusCode,
                        path: normalizedPath,
                        message: error.message,
                    },
                    "HTTP error occurred",
                );
                throw new GocdApiError(
                    error.response.statusCode,
                    error.response.statusMessage || "Unknown error",
                    normalizedPath,
                    error.response.body as string,
                );
            }
            logger.error({ error, path: normalizedPath }, "Request failed");
            throw error;
        }
    }

    async listPipelines(): Promise<Pipeline[]> {
        const data = await this.request<DashboardResponse>("GET", "/dashboard", "v4");

        logger.debug({ data }, "Dashboard response received");

        const pipelineGroups = data._embedded?.pipeline_groups || data.pipeline_groups;

        if (!pipelineGroups) {
            logger.error({ data }, "Response missing pipeline_groups field");
            throw new Error("Invalid dashboard response: missing pipeline_groups field");
        }

        return pipelineGroups.flatMap((group) => {
            const pipelines = group._embedded?.pipelines || group.pipelines;

            if (!pipelines || pipelines.length === 0) {
                logger.debug({ group: group.name }, "Pipeline group has no pipelines");
                return [];
            }

            if (typeof pipelines[0] === "string") {
                return (pipelines as string[]).map((name) => ({
                    name,
                    group: group.name,
                    locked: false,
                    pauseInfo: null,
                }));
            }

            return (pipelines as DashboardPipeline[]).map((p) => ({
                name: p.name,
                group: group.name,
                locked: p.locked,
                pauseInfo: p.pause_info
                    ? {
                          paused: p.pause_info.paused,
                          pausedBy: p.pause_info.paused_by,
                          pauseReason: p.pause_info.pause_reason,
                      }
                    : null,
            }));
        });
    }

    async getPipelineStatus(name: string): Promise<PipelineStatus> {
        return this.request<PipelineStatus>("GET", `/pipelines/${encodeURIComponent(name)}/status`, "v1");
    }

    async getPipelineHistory(name: string, pageSize?: number, after?: number): Promise<PipelineHistory> {
        const params = new URLSearchParams();
        if (pageSize) {
            params.set("page_size", String(pageSize));
        }
        if (after !== undefined) {
            params.set("after", String(after));
        }
        const query = params.toString();
        const path = `/pipelines/${encodeURIComponent(name)}/history${query ? `?${query}` : ""}`;
        return this.request<PipelineHistory>("GET", path, "v1");
    }

    async getPipelineInstance(name: string, counter: number): Promise<PipelineInstance> {
        return this.request<PipelineInstance>("GET", `/pipelines/${encodeURIComponent(name)}/${counter}`, "v1");
    }

    async triggerPipeline(name: string, options?: TriggerOptions): Promise<{ success: boolean }> {
        const body: Record<string, unknown> = {};

        if (options?.environmentVariables) {
            body.environment_variables = Object.entries(options.environmentVariables).map(([varName, value]) => ({
                name: varName,
                value,
            }));
        }

        if (options?.updateMaterials !== undefined) {
            body.update_materials_before_scheduling = options.updateMaterials;
        }

        return this.request<{ success: boolean }>(
            "POST",
            `/pipelines/${encodeURIComponent(name)}/schedule`,
            "v1",
            Object.keys(body).length > 0 ? body : undefined,
        );
    }

    async pausePipeline(name: string, reason?: string): Promise<{ success: boolean }> {
        const body = reason ? { pause_cause: reason } : undefined;
        return this.request<{ success: boolean }>("POST", `/pipelines/${encodeURIComponent(name)}/pause`, "v1", body);
    }

    async unpausePipeline(name: string): Promise<{ success: boolean }> {
        return this.request<{ success: boolean }>("POST", `/pipelines/${encodeURIComponent(name)}/unpause`, "v1");
    }

    async getStageInstance(
        pipeline: string,
        pipelineCounter: number,
        stage: string,
        stageCounter: number,
    ): Promise<StageInstance> {
        return this.request<StageInstance>(
            "GET",
            `/stages/${encodeURIComponent(pipeline)}/${pipelineCounter}/${encodeURIComponent(stage)}/${stageCounter}`,
            "v3",
        );
    }

    async triggerStage(pipeline: string, pipelineCounter: number, stage: string): Promise<{ success: boolean }> {
        return this.request<{ success: boolean }>(
            "POST",
            `/stages/${encodeURIComponent(pipeline)}/${pipelineCounter}/${encodeURIComponent(stage)}/run`,
            "v2",
        );
    }

    async cancelStage(
        pipeline: string,
        pipelineCounter: number,
        stage: string,
        stageCounter: number,
    ): Promise<{ success: boolean }> {
        return this.request<{ success: boolean }>(
            "POST",
            `/stages/${encodeURIComponent(pipeline)}/${pipelineCounter}/${encodeURIComponent(stage)}/${stageCounter}/cancel`,
            "v3",
        );
    }

    async getJobHistory(pipeline: string, stage: string, job: string, pageSize?: number): Promise<JobHistory> {
        const params = new URLSearchParams();
        if (pageSize) {
            params.set("page_size", String(pageSize));
        }
        const query = params.toString();
        const path = `/jobs/${encodeURIComponent(pipeline)}/${encodeURIComponent(stage)}/${encodeURIComponent(job)}/history${query ? `?${query}` : ""}`;
        return this.request<JobHistory>("GET", path, "v1");
    }

    async getJobInstance(
        pipeline: string,
        pipelineCounter: number,
        stage: string,
        stageCounter: number,
        job: string,
    ): Promise<JobInstance> {
        return this.request<JobInstance>(
            "GET",
            `/jobs/${encodeURIComponent(pipeline)}/${pipelineCounter}/${encodeURIComponent(stage)}/${stageCounter}/${encodeURIComponent(job)}`,
            "v1",
        );
    }
}
