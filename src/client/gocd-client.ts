import got, { Got, HTTPError } from "got";
import pino from "pino";
import { isEmpty, castArray, isString } from "lodash-es";
import qs from "qs";
import { XMLParser } from "fast-xml-parser";
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

const logger = pino(
    {
        name: "gocd-client",
        level: process.env.LOG_LEVEL || "info",
    },
    process.stderr,
);

/**
 * A token-bound client instance where all methods are pre-bound with a specific GoCD API token.
 * This type represents the return value of GoCDClient.withToken()
 */
export type BoundGoCDClient = {
    listPipelines(): Promise<Pipeline[]>;
    getPipelineStatus(name: string): Promise<PipelineStatus>;
    getPipelineHistory(name: string, pageSize?: number, after?: number): Promise<PipelineHistory>;
    getPipelineInstance(name: string, counter: number): Promise<PipelineInstance>;
    triggerPipeline(name: string, options?: TriggerOptions): Promise<{ success: boolean }>;
    pausePipeline(name: string, reason?: string): Promise<{ success: boolean }>;
    unpausePipeline(name: string): Promise<{ success: boolean }>;
    getStageInstance(
        pipelineName: string,
        pipelineCounter: number,
        stageName: string,
        stageCounter: number,
    ): Promise<StageInstance>;
    triggerStage(pipelineName: string, pipelineCounter: number, stageName: string): Promise<{ success: boolean }>;
    cancelStage(
        pipelineName: string,
        pipelineCounter: number,
        stageName: string,
        stageCounter: number,
    ): Promise<{ success: boolean }>;
    getJobHistory(pipelineName: string, stageName: string, jobName: string, pageSize?: number): Promise<JobHistory>;
    getJobInstance(
        pipelineName: string,
        pipelineCounter: number,
        stageName: string,
        stageCounter: number,
        jobName: string,
    ): Promise<JobInstance>;
    getJobConsoleLog(
        pipelineName: string,
        pipelineCounter: number,
        stageName: string,
        stageCounter: number,
        jobName: string,
    ): Promise<string>;
    listJobArtifacts(
        pipelineName: string,
        pipelineCounter: number,
        stageName: string,
        stageCounter: number,
        jobName: string,
    ): Promise<ArtifactFile[]>;
    getJobArtifact(
        pipelineName: string,
        pipelineCounter: number,
        stageName: string,
        stageCounter: number,
        jobName: string,
        artifactPath: string,
    ): Promise<string>;
    parseJUnitXml(
        pipelineName: string,
        pipelineCounter: number,
        stageName: string,
        stageCounter: number,
        jobName: string,
        junitPath: string,
    ): Promise<JUnitTestResults>;
};

export class GoCDClient {
    private baseUrl: string;
    private client: Got;

    constructor(config: GocdConfig) {
        this.baseUrl = config.serverUrl;

        this.client = got.extend({
            prefixUrl: `${this.baseUrl}/go/api`,
            timeout: { request: 30000 },
            retry: { limit: 2, methods: ["GET"] },
            hooks: {
                beforeRequest: [
                    (options) => {
                        logger.debug({ url: options.url?.toString(), method: options.method }, "Making API request");
                    },
                ],
                afterResponse: [
                    (response) => {
                        logger.debug({ url: response.url, statusCode: response.statusCode }, "Received API response");
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
                    isString(response.body) ? response.body : JSON.stringify(response.body),
                );
            }

            if (response.statusCode === 202 || response.statusCode === 204) {
                return { success: true } as T;
            }

            if (isEmpty(response.body)) {
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

    private async get<T>(token: string, path: string, apiVersion: string): Promise<T> {
        return this.request<T>(token, "GET", path, apiVersion);
    }

    private async post<T>(token: string, path: string, apiVersion: string, body?: object): Promise<T> {
        return this.request<T>(token, "POST", path, apiVersion, body);
    }

    private async delete<T>(token: string, path: string, apiVersion: string): Promise<T> {
        return this.request<T>(token, "DELETE", path, apiVersion);
    }

    async listPipelines(token: string): Promise<Pipeline[]> {
        const data = await this.get<DashboardResponse>(token, "/dashboard", "v4");
        logger.debug({ data }, "Dashboard response received");

        const pipelineGroups = data._embedded?.pipeline_groups || data.pipeline_groups;
        if (!pipelineGroups) {
            logger.error({ data }, "Response missing pipeline_groups field");
            throw new Error("Invalid dashboard response: missing pipeline_groups field");
        }

        return pipelineGroups.flatMap((group) => {
            const pipelines = group._embedded?.pipelines || group.pipelines;
            if (isEmpty(pipelines)) {
                logger.debug({ group: group.name }, "Pipeline group has no pipelines");
                return [];
            }

            if (isString(pipelines[0])) {
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
        const url = `/pipelines/${encodeURIComponent(name)}/status`;
        return this.get<PipelineStatus>(token, url, "v1");
    }

    async getPipelineHistory(token: string, name: string, pageSize?: number, after?: number): Promise<PipelineHistory> {
        const query = qs.stringify({ page_size: pageSize, after }, { skipNulls: true });
        const path = `/pipelines/${encodeURIComponent(name)}/history${query ? `?${query}` : ""}`;
        return this.get<PipelineHistory>(token, path, "v1");
    }

    async getPipelineInstance(token: string, name: string, counter: number): Promise<PipelineInstance> {
        const url = `/pipelines/${encodeURIComponent(name)}/${counter}`;
        return this.get<PipelineInstance>(token, url, "v1");
    }

    async triggerPipeline(token: string, name: string, options?: TriggerOptions): Promise<{ success: boolean }> {
        const body: Record<string, unknown> = {};

        if (options?.environmentVariables) {
            // Transform environment variables to API format: array of {name, value} objects
            body.environment_variables = Object.entries(options.environmentVariables).map(([name, value]) => {
                return { name, value };
            });
        }

        if (options?.updateMaterials !== undefined) {
            body.update_materials_before_scheduling = options.updateMaterials;
        }

        const url = `/pipelines/${encodeURIComponent(name)}/schedule`;
        return this.post<{ success: boolean }>(token, url, "v1", isEmpty(body) ? undefined : body);
    }

    async pausePipeline(token: string, name: string, reason?: string): Promise<{ success: boolean }> {
        const body = reason ? { pause_cause: reason } : undefined;
        const url = `/pipelines/${encodeURIComponent(name)}/pause`;
        return this.post<{ success: boolean }>(token, url, "v1", body);
    }

    async unpausePipeline(token: string, name: string): Promise<{ success: boolean }> {
        const url = `/pipelines/${encodeURIComponent(name)}/unpause`;
        return this.post<{ success: boolean }>(token, url, "v1");
    }

    async getStageInstance(
        token: string,
        pipeline: string,
        pipelineCounter: number,
        stage: string,
        stageCounter: number,
    ): Promise<StageInstance> {
        const url = `/stages/${encodeURIComponent(pipeline)}/${pipelineCounter}/${encodeURIComponent(stage)}/${stageCounter}`;
        return this.get<StageInstance>(token, url, "v3");
    }

    async triggerStage(
        token: string,
        pipeline: string,
        pipelineCounter: number,
        stage: string,
    ): Promise<{ success: boolean }> {
        const url = `/stages/${encodeURIComponent(pipeline)}/${pipelineCounter}/${encodeURIComponent(stage)}/run`;
        return this.post<{ success: boolean }>(token, url, "v2");
    }

    async cancelStage(
        token: string,
        pipeline: string,
        pipelineCounter: number,
        stage: string,
        stageCounter: number,
    ): Promise<{ success: boolean }> {
        const url = `/stages/${encodeURIComponent(pipeline)}/${pipelineCounter}/${encodeURIComponent(stage)}/${stageCounter}/cancel`;
        return this.post<{ success: boolean }>(token, url, "v3");
    }

    async getJobHistory(
        token: string,
        pipeline: string,
        stage: string,
        job: string,
        pageSize?: number,
    ): Promise<JobHistory> {
        const query = qs.stringify({ page_size: pageSize }, { skipNulls: true });
        const path = `/jobs/${encodeURIComponent(pipeline)}/${encodeURIComponent(stage)}/${encodeURIComponent(job)}/history${query ? `?${query}` : ""}`;
        return this.get<JobHistory>(token, path, "v1");
    }

    async getJobInstance(
        token: string,
        pipeline: string,
        pipelineCounter: number,
        stage: string,
        stageCounter: number,
        job: string,
    ): Promise<JobInstance> {
        const url = `/jobs/${encodeURIComponent(pipeline)}/${pipelineCounter}/${encodeURIComponent(stage)}/${stageCounter}/${encodeURIComponent(job)}`;
        return this.get<JobInstance>(token, url, "v1");
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
                headers: { Authorization: `Bearer ${token}` },
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
                headers: { Authorization: `Bearer ${token}` },
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
                headers: { Authorization: `Bearer ${token}` },
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
        const xmlContent = await this.getJobArtifact(
            token,
            pipeline,
            pipelineCounter,
            stage,
            stageCounter,
            job,
            junitPath,
        );

        const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: "@_",
        });
        const parsed = parser.parse(xmlContent);

        let testsuites: any[] = [];
        if (parsed.testsuites) {
            testsuites = castArray(parsed.testsuites.testsuite);
        } else if (parsed.testsuite) {
            testsuites = castArray(parsed.testsuite);
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
            const testcaseArray = suite.testcase ? castArray(suite.testcase) : [];

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
                        content: isString(testcase.failure) ? testcase.failure : testcase.failure["#text"] || "",
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
                        content: isString(testcase.error) ? testcase.error : testcase.error["#text"] || "",
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
                    skippedMsg = isString(testcase.skipped) ? testcase.skipped : testcase.skipped["@_message"] || "";
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
            summary: { totalTests, totalFailures, totalErrors, totalSkipped, totalTime },
            failedTests,
        };
    }

    /**
     * Create a token-bound client instance where all methods use the provided token.
     * This simplifies the API by eliminating the need to pass the token to every method call.
     *
     * @param token - The GoCD API token to use for all requests
     * @returns An object with all client methods pre-bound with the token
     *
     * @example
     * ```ts
     * const boundClient = client.withToken("my-token");
     * const pipelines = await boundClient.listPipelines();
     * const status = await boundClient.getPipelineStatus("my-pipeline");
     * ```
     */
    withToken(token: string): BoundGoCDClient {
        return {
            listPipelines: (...args: Parameters<BoundGoCDClient["listPipelines"]>) =>
                this.listPipelines(token, ...args),
            getPipelineStatus: (...args: Parameters<BoundGoCDClient["getPipelineStatus"]>) =>
                this.getPipelineStatus(token, ...args),
            getPipelineHistory: (...args: Parameters<BoundGoCDClient["getPipelineHistory"]>) =>
                this.getPipelineHistory(token, ...args),
            getPipelineInstance: (...args: Parameters<BoundGoCDClient["getPipelineInstance"]>) =>
                this.getPipelineInstance(token, ...args),
            triggerPipeline: (...args: Parameters<BoundGoCDClient["triggerPipeline"]>) =>
                this.triggerPipeline(token, ...args),
            pausePipeline: (...args: Parameters<BoundGoCDClient["pausePipeline"]>) =>
                this.pausePipeline(token, ...args),
            unpausePipeline: (...args: Parameters<BoundGoCDClient["unpausePipeline"]>) =>
                this.unpausePipeline(token, ...args),
            getStageInstance: (...args: Parameters<BoundGoCDClient["getStageInstance"]>) =>
                this.getStageInstance(token, ...args),
            triggerStage: (...args: Parameters<BoundGoCDClient["triggerStage"]>) => this.triggerStage(token, ...args),
            cancelStage: (...args: Parameters<BoundGoCDClient["cancelStage"]>) => this.cancelStage(token, ...args),
            getJobHistory: (...args: Parameters<BoundGoCDClient["getJobHistory"]>) =>
                this.getJobHistory(token, ...args),
            getJobInstance: (...args: Parameters<BoundGoCDClient["getJobInstance"]>) =>
                this.getJobInstance(token, ...args),
            getJobConsoleLog: (...args: Parameters<BoundGoCDClient["getJobConsoleLog"]>) =>
                this.getJobConsoleLog(token, ...args),
            listJobArtifacts: (...args: Parameters<BoundGoCDClient["listJobArtifacts"]>) =>
                this.listJobArtifacts(token, ...args),
            getJobArtifact: (...args: Parameters<BoundGoCDClient["getJobArtifact"]>) =>
                this.getJobArtifact(token, ...args),
            parseJUnitXml: (...args: Parameters<BoundGoCDClient["parseJUnitXml"]>) =>
                this.parseJUnitXml(token, ...args),
        };
    }
}
