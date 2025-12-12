import { z } from "zod";
import { GocdClient } from "@/client/gocd-client.js";
import { formatErrorResponse } from "@/utils/errors.js";

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

export const jobTools = [
    {
        name: "get_job_history",
        description: "Get the execution history of a specific job",
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
        description: "Get details of a specific job run including state, result, and agent information",
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
        description: "Get the console log output for a specific job run to see build logs and error messages",
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
            "List all artifacts (files and folders) produced by a job, including test reports and build outputs",
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
        description: "Download and read a specific artifact file from a job, such as test reports or logs",
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
            "Parse a JUnit XML test report to extract test results, failures, and errors. Returns structured test data including failed test details with error messages and stack traces.",
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
    client: GocdClient,
    token: string,
    toolName: string,
    args: Record<string, unknown>,
): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> {
    try {
        switch (toolName) {
            case "get_job_history": {
                const { pipelineName, stageName, jobName, pageSize } = getJobHistorySchema.parse(args);
                const history = await client.getJobHistory(token, pipelineName, stageName, jobName, pageSize);
                return {
                    content: [{ type: "text", text: JSON.stringify(history, null, 2) }],
                };
            }

            case "get_job_instance": {
                const { pipelineName, pipelineCounter, stageName, stageCounter, jobName } =
                    getJobInstanceSchema.parse(args);
                const instance = await client.getJobInstance(
                    token,
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
                    token,
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
                    token,
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
                    token,
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
                    token,
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
