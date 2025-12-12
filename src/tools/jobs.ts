import { BoundGoCDClient } from "@/client/gocd-client.js";
import { formatErrorResponse } from "@/utils/errors.js";
import { parseGocdUrl } from "@/utils/url-parser.js";
import { z } from "zod";

export const getJobHistorySchema = z.object({
    pipelineName: z.string().describe("Name of the pipeline"),
    stageName: z.string().describe("Name of the stage"),
    jobName: z.string().describe("Name of the job"),
    pageSize: z.number().optional().describe("Number of results per page (default: 10)"),
});

export const getJobInstanceSchema = z.object({
    pipelineName: z.string().describe("Name of the pipeline"),
    pipelineCounter: z.number().describe("Pipeline run counter"),
    stageName: z.string().describe("Name of the stage"),
    stageCounter: z.number().describe("Stage run counter"),
    jobName: z.string().describe("Name of the job"),
});

export const getJobConsoleSchema = z.object({
    pipelineName: z.string().describe("Name of the pipeline"),
    pipelineCounter: z.number().describe("Pipeline run counter"),
    stageName: z.string().describe("Name of the stage"),
    stageCounter: z.number().describe("Stage run counter"),
    jobName: z.string().describe("Name of the job"),
});

export const listJobArtifactsSchema = z.object({
    pipelineName: z.string().describe("Name of the pipeline"),
    pipelineCounter: z.number().describe("Pipeline run counter"),
    stageName: z.string().describe("Name of the stage"),
    stageCounter: z.number().describe("Stage run counter"),
    jobName: z.string().describe("Name of the job"),
});

export const getJobArtifactSchema = z.object({
    pipelineName: z.string().describe("Name of the pipeline"),
    pipelineCounter: z.number().describe("Pipeline run counter"),
    stageName: z.string().describe("Name of the stage"),
    stageCounter: z.number().describe("Stage run counter"),
    jobName: z.string().describe("Name of the job"),
    artifactPath: z.string().describe("Path to the artifact file (e.g., 'test-results/junit.xml')"),
});

export const parseJUnitXmlSchema = z.object({
    pipelineName: z.string().describe("Name of the pipeline"),
    pipelineCounter: z.number().describe("Pipeline run counter"),
    stageName: z.string().describe("Name of the stage"),
    stageCounter: z.number().describe("Stage run counter"),
    jobName: z.string().describe("Name of the job"),
    junitPath: z
        .string()
        .describe("Path to the JUnit XML file (e.g., 'test-results/junit.xml' or 'reports/TEST-*.xml')"),
});

export const parseGocdUrlSchema = z.object({
    url: z.string().describe("GoCD URL for a job, stage, or pipeline (e.g., from the browser)"),
});

export const analyzeJobFailuresSchema = z.object({
    pipelineName: z.string().describe("Name of the pipeline"),
    pipelineCounter: z.number().describe("Pipeline run counter"),
    stageName: z.string().describe("Name of the stage"),
    stageCounter: z.number().describe("Stage run counter"),
    jobName: z.string().describe("Name of the job"),
});

export const jobTools = [
    {
        name: "parse_gocd_url",
        description:
            "Parse a GoCD URL to extract pipeline, stage, and job information. Use this FIRST when the user provides a GoCD URL (e.g., from their browser) before calling other tools. Supports job detail URLs, stage URLs, and pipeline URLs.",
        inputSchema: {
            type: "object" as const,
            properties: {
                url: {
                    type: "string",
                    description: "GoCD URL for a job, stage, or pipeline (e.g., from the browser)",
                },
            },
            required: ["url"],
        },
    },
    {
        name: "analyze_job_failures",
        description:
            "Comprehensive analysis of all failures and errors for a job. Use this when asked to 'get errors', 'analyze failures', 'what went wrong', 'why did this fail', or 'show me the problems'. Automatically finds JUnit test reports and extracts test failures with error messages and stack traces, plus checks console logs for build errors. This is the recommended tool for failure analysis.",
        inputSchema: {
            type: "object" as const,
            properties: {
                pipelineName: { type: "string", description: "Name of the pipeline" },
                pipelineCounter: { type: "number", description: "Pipeline run counter" },
                stageName: { type: "string", description: "Name of the stage" },
                stageCounter: { type: "number", description: "Stage run counter" },
                jobName: { type: "string", description: "Name of the job" },
            },
            required: ["pipelineName", "pipelineCounter", "stageName", "stageCounter", "jobName"],
        },
    },
    {
        name: "get_job_history",
        description:
            "Get the execution history of a specific job across multiple pipeline runs. Use this to see historical trends, past runs, or to find a specific job instance.",
        inputSchema: {
            type: "object" as const,
            properties: {
                pipelineName: { type: "string", description: "Name of the pipeline" },
                stageName: { type: "string", description: "Name of the stage" },
                jobName: { type: "string", description: "Name of the job" },
                pageSize: { type: "number", description: "Number of results per page (default: 10)" },
            },
            required: ["pipelineName", "stageName", "jobName"],
        },
    },
    {
        name: "get_job_instance",
        description:
            "Get details of a specific job run including state (Scheduled, Building, Completed), result (Passed, Failed, Cancelled), agent information, and timestamps. Use this to check job status or get basic job information without downloading logs or artifacts.",
        inputSchema: {
            type: "object" as const,
            properties: {
                pipelineName: { type: "string", description: "Name of the pipeline" },
                pipelineCounter: { type: "number", description: "Pipeline run counter" },
                stageName: { type: "string", description: "Name of the stage" },
                stageCounter: { type: "number", description: "Stage run counter" },
                jobName: { type: "string", description: "Name of the job" },
            },
            required: ["pipelineName", "pipelineCounter", "stageName", "stageCounter", "jobName"],
        },
    },
    {
        name: "get_job_console",
        description:
            "Get the complete console log output for a specific job run. Use this to see build logs, compilation errors, runtime errors, stack traces, or any output written to stdout/stderr during job execution. Essential for debugging build failures and understanding what happened during execution.",
        inputSchema: {
            type: "object" as const,
            properties: {
                pipelineName: { type: "string", description: "Name of the pipeline" },
                pipelineCounter: { type: "number", description: "Pipeline run counter" },
                stageName: { type: "string", description: "Name of the stage" },
                stageCounter: { type: "number", description: "Stage run counter" },
                jobName: { type: "string", description: "Name of the job" },
            },
            required: ["pipelineName", "pipelineCounter", "stageName", "stageCounter", "jobName"],
        },
    },
    {
        name: "list_job_artifacts",
        description:
            "List all artifacts (files and folders) produced by a job, including test reports (JUnit XML), coverage reports, build outputs, and logs. Use this to discover what files are available before downloading specific artifacts. Essential first step when looking for test results or build artifacts.",
        inputSchema: {
            type: "object" as const,
            properties: {
                pipelineName: { type: "string", description: "Name of the pipeline" },
                pipelineCounter: { type: "number", description: "Pipeline run counter" },
                stageName: { type: "string", description: "Name of the stage" },
                stageCounter: { type: "number", description: "Stage run counter" },
                jobName: { type: "string", description: "Name of the job" },
            },
            required: ["pipelineName", "pipelineCounter", "stageName", "stageCounter", "jobName"],
        },
    },
    {
        name: "get_job_artifact",
        description:
            "Download and read a specific artifact file from a job. Use this to retrieve specific files like test reports, coverage data, configuration files, or any other build artifact when you know the exact path. For test reports, consider using parse_junit_xml instead for structured output.",
        inputSchema: {
            type: "object" as const,
            properties: {
                pipelineName: { type: "string", description: "Name of the pipeline" },
                pipelineCounter: { type: "number", description: "Pipeline run counter" },
                stageName: { type: "string", description: "Name of the stage" },
                stageCounter: { type: "number", description: "Stage run counter" },
                jobName: { type: "string", description: "Name of the job" },
                artifactPath: {
                    type: "string",
                    description: "Path to the artifact file (e.g., 'test-results/junit.xml')",
                },
            },
            required: ["pipelineName", "pipelineCounter", "stageName", "stageCounter", "jobName", "artifactPath"],
        },
    },
    {
        name: "parse_junit_xml",
        description:
            "Parse a JUnit XML test report to extract structured test results, failures, and errors. Use this when analyzing test failures, understanding which tests failed, or getting detailed error messages and stack traces from test runs. Returns comprehensive test data including test names, failure messages, and stack traces in a structured format. Prefer this over get_job_artifact for test reports.",
        inputSchema: {
            type: "object" as const,
            properties: {
                pipelineName: { type: "string", description: "Name of the pipeline" },
                pipelineCounter: { type: "number", description: "Pipeline run counter" },
                stageName: { type: "string", description: "Name of the stage" },
                stageCounter: { type: "number", description: "Stage run counter" },
                jobName: { type: "string", description: "Name of the job" },
                junitPath: {
                    type: "string",
                    description: "Path to the JUnit XML file (e.g., 'test-results/junit.xml' or 'reports/TEST-*.xml')",
                },
            },
            required: ["pipelineName", "pipelineCounter", "stageName", "stageCounter", "jobName", "junitPath"],
        },
    },
];

export async function handleJobTool(
    client: BoundGoCDClient,
    toolName: string,
    args: Record<string, unknown>,
): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> {
    try {
        switch (toolName) {
            case "parse_gocd_url": {
                const { url } = parseGocdUrlSchema.parse(args);
                const parsed = parseGocdUrl(url);
                return {
                    content: [{ type: "text", text: JSON.stringify(parsed, null, 2) }],
                };
            }

            case "analyze_job_failures": {
                const { pipelineName, pipelineCounter, stageName, stageCounter, jobName } =
                    analyzeJobFailuresSchema.parse(args);
                const failures: { testFailures?: unknown; consoleErrors?: string; summary: string } = { summary: "" };

                try {
                    const junitPatterns = [
                        "test-results/junit.xml",
                        "test-results/TEST-*.xml",
                        "target/surefire-reports/TEST-*.xml",
                        "build/test-results/**/*.xml",
                        "reports/junit.xml",
                        "reports/TEST-*.xml",
                    ];

                    let testResults = null;
                    for (const pattern of junitPatterns) {
                        try {
                            testResults = await client.parseJUnitXml(
                                pipelineName,
                                pipelineCounter,
                                stageName,
                                stageCounter,
                                jobName,
                                pattern,
                            );
                            if (testResults) {
                                failures.testFailures = testResults;
                                break;
                            }
                        } catch {
                            // JUnit file not found at this path, try next pattern
                            continue;
                        }
                    }
                } catch (error) {
                    // Job may not have published test artifacts
                }

                try {
                    const consoleLog = await client.getJobConsoleLog(
                        pipelineName,
                        pipelineCounter,
                        stageName,
                        stageCounter,
                        jobName,
                    );
                    failures.consoleErrors = consoleLog;
                } catch (error) {
                    // Job may not have console logs available yet
                }

                if (failures.testFailures) {
                    failures.summary = "Found test failures in JUnit XML reports.";
                }

                if (failures.consoleErrors) {
                    failures.summary += "Console log available for error analysis.";
                }

                if (!failures.testFailures && !failures.consoleErrors) {
                    failures.summary = "No test reports or logs found. Job may be running or no artifacts published.";
                }

                return {
                    content: [{ type: "text", text: JSON.stringify(failures, null, 2) }],
                };
            }

            case "get_job_history": {
                const { pipelineName, stageName, jobName, pageSize } = getJobHistorySchema.parse(args);
                const history = await client.getJobHistory(pipelineName, stageName, jobName, pageSize);
                return {
                    content: [{ type: "text", text: JSON.stringify(history, null, 2) }],
                };
            }

            case "get_job_instance": {
                const { pipelineName, pipelineCounter, stageName, stageCounter, jobName } =
                    getJobInstanceSchema.parse(args);
                const instance = await client.getJobInstance(
                    pipelineName,
                    pipelineCounter,
                    stageName,
                    stageCounter,
                    jobName,
                );
                return {
                    content: [{ type: "text", text: JSON.stringify(instance, null, 2) }],
                };
            }

            case "get_job_console": {
                const { pipelineName, pipelineCounter, stageName, stageCounter, jobName } =
                    getJobConsoleSchema.parse(args);
                const consoleLog = await client.getJobConsoleLog(
                    pipelineName,
                    pipelineCounter,
                    stageName,
                    stageCounter,
                    jobName,
                );
                return {
                    content: [{ type: "text", text: consoleLog }],
                };
            }

            case "list_job_artifacts": {
                const { pipelineName, pipelineCounter, stageName, stageCounter, jobName } =
                    listJobArtifactsSchema.parse(args);
                const artifacts = await client.listJobArtifacts(
                    pipelineName,
                    pipelineCounter,
                    stageName,
                    stageCounter,
                    jobName,
                );
                return {
                    content: [{ type: "text", text: JSON.stringify(artifacts, null, 2) }],
                };
            }

            case "get_job_artifact": {
                const { pipelineName, pipelineCounter, stageName, stageCounter, jobName, artifactPath } =
                    getJobArtifactSchema.parse(args);
                const artifact = await client.getJobArtifact(
                    pipelineName,
                    pipelineCounter,
                    stageName,
                    stageCounter,
                    jobName,
                    artifactPath,
                );
                return {
                    content: [{ type: "text", text: artifact }],
                };
            }

            case "parse_junit_xml": {
                const { pipelineName, pipelineCounter, stageName, stageCounter, jobName, junitPath } =
                    parseJUnitXmlSchema.parse(args);
                const results = await client.parseJUnitXml(
                    pipelineName,
                    pipelineCounter,
                    stageName,
                    stageCounter,
                    jobName,
                    junitPath,
                );
                return {
                    content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
                };
            }

            default:
                return {
                    content: [{ type: "text", text: `Unknown job tool: ${toolName}` }],
                    isError: true,
                };
        }
    } catch (error) {
        return {
            content: [{ type: "text", text: formatErrorResponse(error) }],
            isError: true,
        };
    }
}
