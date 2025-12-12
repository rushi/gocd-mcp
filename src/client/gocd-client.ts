import got, { Got, HTTPError } from "got";
import pino from "pino";
import { GocdConfig } from "@/config.js";
import { GocdApiError } from "@/utils/errors.js";
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
    ArtifactFile,
    JUnitTestResults,
    JUnitTestSuite,
    JUnitTestCase,
} from "./types.js";
import { XMLParser } from "fast-xml-parser";

const logger = pino(
    {
        name: "gocd-client",
        level: process.env.LOG_LEVEL || "info",
    },
    process.stderr,
);

export class GocdClient {
    private baseUrl: string;
    private client: Got;

    constructor(config: GocdConfig) {
        this.baseUrl = config.serverUrl;

        this.client = got.extend({
            prefixUrl: `${this.baseUrl}/go/api`,
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
        token: string,
        method: "GET" | "POST" | "DELETE",
        path: string,
        apiVersion: string,
        body?: object,
    ): Promise<T> {
        const normalizedPath = path.startsWith("/") ? path.substring(1) : path;

        const headers: Record<string, string> = {
            Accept: `application/vnd.go.cd.${apiVersion}+json`,
            Authorization: `Bearer ${token}`,
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

    async listPipelines(token: string): Promise<Pipeline[]> {
        const data = await this.request<DashboardResponse>(token, "GET", "/dashboard", "v4");

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

    async getPipelineStatus(token: string, name: string): Promise<PipelineStatus> {
        return this.request<PipelineStatus>(token, "GET", `/pipelines/${encodeURIComponent(name)}/status`, "v1");
    }

    async getPipelineHistory(token: string, name: string, pageSize?: number, after?: number): Promise<PipelineHistory> {
        const params = new URLSearchParams();
        if (pageSize) {
            params.set("page_size", String(pageSize));
        }
        if (after !== undefined) {
            params.set("after", String(after));
        }
        const query = params.toString();
        const path = `/pipelines/${encodeURIComponent(name)}/history${query ? `?${query}` : ""}`;
        return this.request<PipelineHistory>(token, "GET", path, "v1");
    }

    async getPipelineInstance(token: string, name: string, counter: number): Promise<PipelineInstance> {
        return this.request<PipelineInstance>(token, "GET", `/pipelines/${encodeURIComponent(name)}/${counter}`, "v1");
    }

    async triggerPipeline(token: string, name: string, options?: TriggerOptions): Promise<{ success: boolean }> {
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
            token,
            "POST",
            `/pipelines/${encodeURIComponent(name)}/schedule`,
            "v1",
            Object.keys(body).length > 0 ? body : undefined,
        );
    }

    async pausePipeline(token: string, name: string, reason?: string): Promise<{ success: boolean }> {
        const body = reason ? { pause_cause: reason } : undefined;
        return this.request<{ success: boolean }>(token, "POST", `/pipelines/${encodeURIComponent(name)}/pause`, "v1", body);
    }

    async unpausePipeline(token: string, name: string): Promise<{ success: boolean }> {
        return this.request<{ success: boolean }>(token, "POST", `/pipelines/${encodeURIComponent(name)}/unpause`, "v1");
    }

    async getStageInstance(
        token: string,
        pipeline: string,
        pipelineCounter: number,
        stage: string,
        stageCounter: number,
    ): Promise<StageInstance> {
        return this.request<StageInstance>(
            token,
            "GET",
            `/stages/${encodeURIComponent(pipeline)}/${pipelineCounter}/${encodeURIComponent(stage)}/${stageCounter}`,
            "v3",
        );
    }

    async triggerStage(token: string, pipeline: string, pipelineCounter: number, stage: string): Promise<{ success: boolean }> {
        return this.request<{ success: boolean }>(
            token,
            "POST",
            `/stages/${encodeURIComponent(pipeline)}/${pipelineCounter}/${encodeURIComponent(stage)}/run`,
            "v2",
        );
    }

    async cancelStage(
        token: string,
        pipeline: string,
        pipelineCounter: number,
        stage: string,
        stageCounter: number,
    ): Promise<{ success: boolean }> {
        return this.request<{ success: boolean }>(
            token,
            "POST",
            `/stages/${encodeURIComponent(pipeline)}/${pipelineCounter}/${encodeURIComponent(stage)}/${stageCounter}/cancel`,
            "v3",
        );
    }

    async getJobHistory(token: string, pipeline: string, stage: string, job: string, pageSize?: number): Promise<JobHistory> {
        const params = new URLSearchParams();
        if (pageSize) {
            params.set("page_size", String(pageSize));
        }
        const query = params.toString();
        const path = `/jobs/${encodeURIComponent(pipeline)}/${encodeURIComponent(stage)}/${encodeURIComponent(job)}/history${query ? `?${query}` : ""}`;
        return this.request<JobHistory>(token, "GET", path, "v1");
    }

    async getJobInstance(
        token: string,
        pipeline: string,
        pipelineCounter: number,
        stage: string,
        stageCounter: number,
        job: string,
    ): Promise<JobInstance> {
        return this.request<JobInstance>(
            token,
            "GET",
            `/jobs/${encodeURIComponent(pipeline)}/${pipelineCounter}/${encodeURIComponent(stage)}/${stageCounter}/${encodeURIComponent(job)}`,
            "v1",
        );
    }

    async getJobConsoleLog(
        token: string,
        pipeline: string,
        pipelineCounter: number,
        stage: string,
        stageCounter: number,
        job: string,
    ): Promise<string> {
        const path = `files/${encodeURIComponent(pipeline)}/${pipelineCounter}/${encodeURIComponent(stage)}/${stageCounter}/${encodeURIComponent(job)}/cruise-output/console.log`;

        try {
            const response = await this.client.get(path, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                prefixUrl: `${this.baseUrl}/go`,
            });
            return response.body;
        } catch (error) {
            throw new Error(`Failed to fetch console log: ${(error as Error).message}`);
        }
    }

    async listJobArtifacts(
        token: string,
        pipeline: string,
        pipelineCounter: number,
        stage: string,
        stageCounter: number,
        job: string,
    ): Promise<ArtifactFile[]> {
        const path = `files/${encodeURIComponent(pipeline)}/${pipelineCounter}/${encodeURIComponent(stage)}/${stageCounter}/${encodeURIComponent(job)}.json`;

        try {
            const response = await this.client.get(path, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                prefixUrl: `${this.baseUrl}/go`,
                responseType: "json",
            });
            return response.body as ArtifactFile[];
        } catch (error) {
            throw new Error(`Failed to list artifacts: ${(error as Error).message}`);
        }
    }

    async getJobArtifact(
        token: string,
        pipeline: string,
        pipelineCounter: number,
        stage: string,
        stageCounter: number,
        job: string,
        artifactPath: string,
    ): Promise<string> {
        const path = `files/${encodeURIComponent(pipeline)}/${pipelineCounter}/${encodeURIComponent(stage)}/${stageCounter}/${encodeURIComponent(job)}/${artifactPath}`;

        try {
            const response = await this.client.get(path, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                prefixUrl: `${this.baseUrl}/go`,
            });
            return response.body;
        } catch (error) {
            throw new Error(`Failed to fetch artifact: ${(error as Error).message}`);
        }
    }

    async parseJUnitXml(
        token: string,
        pipeline: string,
        pipelineCounter: number,
        stage: string,
        stageCounter: number,
        job: string,
        junitPath: string,
    ): Promise<JUnitTestResults> {
        // Fetch the JUnit XML file
        const xmlContent = await this.getJobArtifact(token, pipeline, pipelineCounter, stage, stageCounter, job, junitPath);

        // Parse XML
        const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: "@_",
        });
        const parsed = parser.parse(xmlContent);

        // Handle both single testsuite and testsuites wrapper
        let testsuites: any[] = [];
        if (parsed.testsuites) {
            testsuites = Array.isArray(parsed.testsuites.testsuite)
                ? parsed.testsuites.testsuite
                : [parsed.testsuites.testsuite];
        } else if (parsed.testsuite) {
            testsuites = Array.isArray(parsed.testsuite) ? parsed.testsuite : [parsed.testsuite];
        }

        const suites: JUnitTestSuite[] = [];
        const failedTests: JUnitTestResults["failedTests"] = [];
        let totalTests = 0;
        let totalFailures = 0;
        let totalErrors = 0;
        let totalSkipped = 0;
        let totalTime = 0;

        for (const suite of testsuites) {
            const suiteName = suite["@_name"] || "Unknown Suite";
            const tests = parseInt(suite["@_tests"] || "0", 10);
            const failures = parseInt(suite["@_failures"] || "0", 10);
            const errors = parseInt(suite["@_errors"] || "0", 10);
            const skipped = parseInt(suite["@_skipped"] || "0", 10);
            const time = parseFloat(suite["@_time"] || "0");

            totalTests += tests;
            totalFailures += failures;
            totalErrors += errors;
            totalSkipped += skipped;
            totalTime += time;

            const testCases: JUnitTestCase[] = [];
            const testcaseArray = suite.testcase
                ? Array.isArray(suite.testcase)
                    ? suite.testcase
                    : [suite.testcase]
                : [];

            for (const testcase of testcaseArray) {
                const testName = testcase["@_name"] || "Unknown Test";
                const className = testcase["@_classname"] || "";
                const testTime = parseFloat(testcase["@_time"] || "0");

                let status: JUnitTestCase["status"] = "passed";
                let failure: JUnitTestCase["failure"];
                let error: JUnitTestCase["error"];
                let skippedMsg: string | undefined;

                if (testcase.failure) {
                    status = "failed";
                    failure = {
                        message: testcase.failure["@_message"] || "",
                        type: testcase.failure["@_type"] || "",
                        content: typeof testcase.failure === "string" ? testcase.failure : testcase.failure["#text"] || "",
                    };
                    failedTests.push({
                        suiteName,
                        testName,
                        className,
                        message: failure.message,
                        type: failure.type,
                        details: failure.content,
                    });
                } else if (testcase.error) {
                    status = "error";
                    error = {
                        message: testcase.error["@_message"] || "",
                        type: testcase.error["@_type"] || "",
                        content: typeof testcase.error === "string" ? testcase.error : testcase.error["#text"] || "",
                    };
                    failedTests.push({
                        suiteName,
                        testName,
                        className,
                        message: error.message,
                        type: error.type,
                        details: error.content,
                    });
                } else if (testcase.skipped !== undefined) {
                    status = "skipped";
                    skippedMsg = typeof testcase.skipped === "string" ? testcase.skipped : testcase.skipped["@_message"] || "";
                }

                testCases.push({
                    name: testName,
                    classname: className,
                    time: testTime,
                    status,
                    failure,
                    error,
                    skipped: skippedMsg,
                });
            }

            suites.push({
                name: suiteName,
                tests,
                failures,
                errors,
                skipped,
                time,
                timestamp: suite["@_timestamp"],
                testCases,
            });
        }

        return {
            suites,
            summary: {
                totalTests,
                totalFailures,
                totalErrors,
                totalSkipped,
                totalTime,
            },
            failedTests,
        };
    }
}
