import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleJobTool } from "../../../src/tools/jobs.js";
import { GocdClient } from "../../../src/client/gocd-client.js";
import { GocdApiError } from "../../../src/utils/errors.js";

describe("Job Tools", () => {
    let mockClient: GocdClient;

    beforeEach(() => {
        mockClient = {
            getJobHistory: vi.fn(),
            getJobInstance: vi.fn(),
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

            const result = await handleJobTool(mockClient, "get_job_history", {
                pipelineName: "build-pipeline",
                stageName: "build",
                jobName: "test-job",
            });

            expect(result.isError).toBeUndefined();
            expect(result.content[0].text).toBe(JSON.stringify(mockHistory, null, 2));
            expect(mockClient.getJobHistory).toHaveBeenCalledWith("build-pipeline", "build", "test-job", undefined);
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

            const result = await handleJobTool(mockClient, "get_job_history", {
                pipelineName: "build-pipeline",
                stageName: "build",
                jobName: "test-job",
                pageSize: 20,
            });

            expect(result.isError).toBeUndefined();
            expect(mockClient.getJobHistory).toHaveBeenCalledWith("build-pipeline", "build", "test-job", 20);
        });

        it("should reject when required parameters are missing", async () => {
            const result = await handleJobTool(mockClient, "get_job_history", {
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

            const result = await handleJobTool(mockClient, "get_job_history", {
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

            const result = await handleJobTool(mockClient, "get_job_instance", {
                pipelineName: "build-pipeline",
                pipelineCounter: 10,
                stageName: "build",
                stageCounter: 1,
                jobName: "test-job",
            });

            expect(result.isError).toBeUndefined();
            expect(result.content[0].text).toBe(JSON.stringify(mockJob, null, 2));
            expect(mockClient.getJobInstance).toHaveBeenCalledWith("build-pipeline", 10, "build", 1, "test-job");
        });

        it("should reject when required parameters are missing", async () => {
            const result = await handleJobTool(mockClient, "get_job_instance", {
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

            const result = await handleJobTool(mockClient, "get_job_instance", {
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

    describe("unknown tool", () => {
        it("should return error for unknown tool name", async () => {
            const result = await handleJobTool(mockClient, "unknown_tool", {});

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain("Unknown job tool");
        });
    });
});
