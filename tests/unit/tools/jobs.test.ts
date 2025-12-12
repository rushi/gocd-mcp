import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleJobTool } from "@/tools/jobs.js";
import { GocdClient } from "@/client/gocd-client.js";
import { GocdApiError } from "@/utils/errors.js";

describe("Job Tools", () => {
    let mockClient: GocdClient;

    beforeEach(() => {
        mockClient = {
            getJobHistory: vi.fn(),
            getJobInstance: vi.fn(),
            listJobArtifacts: vi.fn(),
            parseJUnitXml: vi.fn(),
            getJobConsoleLog: vi.fn(),
        } as unknown as GocdClient;
    });

    describe("get_job_history", () => {
        it("should get job history with required parameters", async () => {
            const mockHistory = {
                jobs: [],
                pagination: {
                    offset: 0,
                    total: 0,
                    pageSize: 10,
                },
            };

            vi.mocked(mockClient.getJobHistory).mockResolvedValue(mockHistory);

            const result = await handleJobTool(mockClient, "test-token", "get_job_history", {
                pipelineName: "build-pipeline",
                stageName: "build",
                jobName: "test-job",
            });

            expect(result.isError).toBeUndefined();
            expect(result.content[0].text).toBe(JSON.stringify(mockHistory, null, 2));
            expect(mockClient.getJobHistory).toHaveBeenCalledWith("test-token", "build-pipeline", "build", "test-job", undefined);
        });

        it("should get job history with pageSize parameter", async () => {
            const mockHistory = {
                jobs: [],
                pagination: {
                    offset: 0,
                    total: 0,
                    pageSize: 20,
                },
            };

            vi.mocked(mockClient.getJobHistory).mockResolvedValue(mockHistory);

            const result = await handleJobTool(mockClient, "test-token", "get_job_history", {
                pipelineName: "build-pipeline",
                stageName: "build",
                jobName: "test-job",
                pageSize: 20,
            });

            expect(result.isError).toBeUndefined();
            expect(mockClient.getJobHistory).toHaveBeenCalledWith("test-token", "build-pipeline", "build", "test-job", 20);
        });

        it("should reject when required parameters are missing", async () => {
            const result = await handleJobTool(mockClient, "test-token", "get_job_history", {
                pipelineName: "build-pipeline",
                stageName: "build",
            });

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain("jobName");
        });

        it("should handle errors from client", async () => {
            vi.mocked(mockClient.getJobHistory).mockRejectedValue(
                new GocdApiError(404, "Not Found", "jobs/build-pipeline/build/test-job/history", "Job not found"),
            );

            const result = await handleJobTool(mockClient, "test-token", "get_job_history", {
                pipelineName: "build-pipeline",
                stageName: "build",
                jobName: "test-job",
            });

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain("NOT_FOUND");
        });
    });

    describe("get_job_instance", () => {
        it("should get job instance with all required parameters", async () => {
            const mockJob = {
                name: "test-job",
                state: "Completed",
                result: "Passed",
                scheduledDate: 1640000000000,
                agentUuid: "agent-123",
                originalJobId: null,
                rerun: false,
            };

            vi.mocked(mockClient.getJobInstance).mockResolvedValue(mockJob);

            const result = await handleJobTool(mockClient, "test-token", "get_job_instance", {
                pipelineName: "build-pipeline",
                pipelineCounter: 10,
                stageName: "build",
                stageCounter: 1,
                jobName: "test-job",
            });

            expect(result.isError).toBeUndefined();
            expect(result.content[0].text).toBe(JSON.stringify(mockJob, null, 2));
            expect(mockClient.getJobInstance).toHaveBeenCalledWith("test-token", "build-pipeline", 10, "build", 1, "test-job");
        });

        it("should reject when required parameters are missing", async () => {
            const result = await handleJobTool(mockClient, "test-token", "get_job_instance", {
                pipelineName: "build-pipeline",
                pipelineCounter: 10,
                stageName: "build",
                stageCounter: 1,
            });

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain("jobName");
        });

        it("should handle authorization errors", async () => {
            vi.mocked(mockClient.getJobInstance).mockRejectedValue(
                new GocdApiError(401, "Unauthorized", "jobs/build-pipeline/10/build/1/test-job", "Not authorized"),
            );

            const result = await handleJobTool(mockClient, "test-token", "get_job_instance", {
                pipelineName: "build-pipeline",
                pipelineCounter: 10,
                stageName: "build",
                stageCounter: 1,
                jobName: "test-job",
            });

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain("UNAUTHORIZED");
        });
    });

    describe("parse_gocd_url", () => {
        it("should parse job detail URL successfully", async () => {
            const result = await handleJobTool(mockClient, "test-token", "parse_gocd_url", {
                url: "https://gocd.example.com/go/tab/build/detail/MyPipeline/123/BuildStage/1/UnitTests",
            });

            expect(result.isError).toBeUndefined();
            const parsed = JSON.parse(result.content[0].text);
            expect(parsed).toEqual({
                pipelineName: "MyPipeline",
                pipelineCounter: 123,
                stageName: "BuildStage",
                stageCounter: 1,
                jobName: "UnitTests",
            });
        });

        it("should parse stage URL successfully", async () => {
            const result = await handleJobTool(mockClient, "test-token", "parse_gocd_url", {
                url: "https://gocd.example.com/go/pipelines/MyPipeline/123/BuildStage/1",
            });

            expect(result.isError).toBeUndefined();
            const parsed = JSON.parse(result.content[0].text);
            expect(parsed).toEqual({
                pipelineName: "MyPipeline",
                pipelineCounter: 123,
                stageName: "BuildStage",
                stageCounter: 1,
            });
        });

        it("should parse pipeline URL successfully", async () => {
            const result = await handleJobTool(mockClient, "test-token", "parse_gocd_url", {
                url: "https://gocd.example.com/go/pipelines/MyPipeline/123",
            });

            expect(result.isError).toBeUndefined();
            const parsed = JSON.parse(result.content[0].text);
            expect(parsed).toEqual({
                pipelineName: "MyPipeline",
                pipelineCounter: 123,
            });
        });

        it("should handle invalid URL", async () => {
            const result = await handleJobTool(mockClient, "test-token", "parse_gocd_url", {
                url: "not-a-valid-url",
            });

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain("Invalid URL format");
        });

        it("should handle unrecognized GoCD URL format", async () => {
            const result = await handleJobTool(mockClient, "test-token", "parse_gocd_url", {
                url: "https://gocd.example.com/go/admin/pipelines",
            });

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain("Unrecognized GoCD URL format");
        });

        it("should reject when URL parameter is missing", async () => {
            const result = await handleJobTool(mockClient, "test-token", "parse_gocd_url", {});

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain("url");
        });
    });

    describe("analyze_job_failures", () => {
        it("should analyze job with test failures and console errors", async () => {
            const mockJUnitResults = {
                suites: [
                    {
                        name: "AuthTests",
                        tests: 10,
                        failures: 2,
                        errors: 0,
                        skipped: 1,
                        time: 5.2,
                        testCases: [
                            {
                                name: "test_login",
                                classname: "AuthTests",
                                time: 0.5,
                                status: "failed" as const,
                                failure: {
                                    message: "Expected 200 but got 401",
                                    type: "AssertionError",
                                    content: "Stack trace...",
                                },
                            },
                        ],
                    },
                ],
                summary: {
                    totalTests: 10,
                    totalFailures: 2,
                    totalErrors: 0,
                    totalSkipped: 1,
                    totalTime: 5.2,
                },
                failedTests: [
                    {
                        suiteName: "AuthTests",
                        testName: "test_login",
                        className: "AuthTests",
                        message: "Expected 200 but got 401",
                        type: "AssertionError",
                        details: "Stack trace...",
                    },
                ],
            };
            const mockConsoleLog = "Error: Build failed\nStack trace...";

            vi.mocked(mockClient.parseJUnitXml).mockResolvedValue(mockJUnitResults);
            vi.mocked(mockClient.getJobConsoleLog).mockResolvedValue(mockConsoleLog);

            const result = await handleJobTool(mockClient, "test-token", "analyze_job_failures", {
                pipelineName: "build-pipeline",
                pipelineCounter: 10,
                stageName: "build",
                stageCounter: 1,
                jobName: "test-job",
            });

            expect(result.isError).toBeUndefined();
            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.testFailures).toEqual(mockJUnitResults);
            expect(parsed.consoleErrors).toBe(mockConsoleLog);
            expect(parsed.summary).toContain("test failures");
            expect(parsed.summary).toContain("Console log");
        });

        it("should handle job with no test failures or console errors", async () => {
            vi.mocked(mockClient.parseJUnitXml).mockRejectedValue(new Error("No JUnit files found"));
            vi.mocked(mockClient.getJobConsoleLog).mockRejectedValue(new Error("Console not available"));

            const result = await handleJobTool(mockClient, "test-token", "analyze_job_failures", {
                pipelineName: "build-pipeline",
                pipelineCounter: 10,
                stageName: "build",
                stageCounter: 1,
                jobName: "test-job",
            });

            expect(result.isError).toBeUndefined();
            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.testFailures).toBeUndefined();
            expect(parsed.consoleErrors).toBeUndefined();
            expect(parsed.summary).toContain("No test reports or console logs found");
        });

        it("should handle job with only test failures", async () => {
            const mockJUnitResults = {
                suites: [
                    {
                        name: "TestSuite",
                        tests: 5,
                        failures: 1,
                        errors: 0,
                        skipped: 0,
                        time: 2.5,
                        testCases: [],
                    },
                ],
                summary: {
                    totalTests: 5,
                    totalFailures: 1,
                    totalErrors: 0,
                    totalSkipped: 0,
                    totalTime: 2.5,
                },
                failedTests: [],
            };

            vi.mocked(mockClient.parseJUnitXml).mockResolvedValue(mockJUnitResults);
            vi.mocked(mockClient.getJobConsoleLog).mockRejectedValue(new Error("Console not available"));

            const result = await handleJobTool(mockClient, "test-token", "analyze_job_failures", {
                pipelineName: "build-pipeline",
                pipelineCounter: 10,
                stageName: "build",
                stageCounter: 1,
                jobName: "test-job",
            });

            expect(result.isError).toBeUndefined();
            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.testFailures).toEqual(mockJUnitResults);
            expect(parsed.consoleErrors).toBeUndefined();
            expect(parsed.summary).toContain("test failures");
        });

        it("should handle job with only console errors", async () => {
            const mockConsoleLog = "Error: Compilation failed";

            vi.mocked(mockClient.parseJUnitXml).mockRejectedValue(new Error("No JUnit files"));
            vi.mocked(mockClient.getJobConsoleLog).mockResolvedValue(mockConsoleLog);

            const result = await handleJobTool(mockClient, "test-token", "analyze_job_failures", {
                pipelineName: "build-pipeline",
                pipelineCounter: 10,
                stageName: "build",
                stageCounter: 1,
                jobName: "test-job",
            });

            expect(result.isError).toBeUndefined();
            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.testFailures).toBeUndefined();
            expect(parsed.consoleErrors).toBe(mockConsoleLog);
            expect(parsed.summary).toContain("Console log");
        });

        it("should reject when required parameters are missing", async () => {
            const result = await handleJobTool(mockClient, "test-token", "analyze_job_failures", {
                pipelineName: "build-pipeline",
                pipelineCounter: 10,
            });

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain("stageName");
        });
    });

    describe("unknown tool", () => {
        it("should return error for unknown tool name", async () => {
            const result = await handleJobTool(mockClient, "test-token", "unknown_tool", {});

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain("Unknown job tool");
        });
    });
});
