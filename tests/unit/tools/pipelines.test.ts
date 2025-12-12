import { describe, it, expect, vi, beforeEach } from "vitest";
import { handlePipelineTool } from "@/tools/pipelines.js";
import { BoundGoCDClient } from "@/client/gocd-client.js";
import { GocdApiError } from "@/utils/errors.js";

describe("Pipeline Tools", () => {
    let mockBoundClient: BoundGoCDClient;

    beforeEach(() => {
        mockBoundClient = {
            listPipelines: vi.fn(),
            getPipelineStatus: vi.fn(),
            getPipelineHistory: vi.fn(),
            getPipelineInstance: vi.fn(),
            triggerPipeline: vi.fn(),
            pausePipeline: vi.fn(),
            unpausePipeline: vi.fn(),
        } as unknown as BoundGoCDClient;
    });

    describe("list_pipelines", () => {
        it("should list all pipelines", async () => {
            const mockPipelines = [
                { name: "pipeline1", group: "main", locked: false, pauseInfo: null },
                { name: "pipeline2", group: "staging", locked: true, pauseInfo: null },
            ];

            vi.mocked(mockBoundClient.listPipelines).mockResolvedValue(mockPipelines);

            const result = await handlePipelineTool(mockBoundClient, "list_pipelines", {});

            expect(result.isError).toBeUndefined();
            expect(result.content[0].text).toBe(JSON.stringify(mockPipelines, null, 2));
            expect(mockBoundClient.listPipelines).toHaveBeenCalledWith();
        });

        it("should handle errors from client", async () => {
            vi.mocked(mockBoundClient.listPipelines).mockRejectedValue(
                new GocdApiError(500, "Internal Server Error", "dashboard", "Server error"),
            );

            const result = await handlePipelineTool(mockBoundClient, "list_pipelines", {});

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain("500");
        });
    });

    describe("get_pipeline_status", () => {
        it("should get pipeline status with valid pipeline name", async () => {
            const mockStatus = {
                paused: false,
                pausedCause: null,
                pausedBy: null,
                locked: false,
                schedulable: true,
            };

            vi.mocked(mockBoundClient.getPipelineStatus).mockResolvedValue(mockStatus);

            const result = await handlePipelineTool(mockBoundClient, "get_pipeline_status", {
                pipelineName: "build-pipeline",
            });

            expect(result.isError).toBeUndefined();
            expect(result.content[0].text).toBe(JSON.stringify(mockStatus, null, 2));
            expect(mockBoundClient.getPipelineStatus).toHaveBeenCalledWith( "build-pipeline");
        });

        it("should reject when pipelineName is missing", async () => {
            const result = await handlePipelineTool(mockBoundClient, "get_pipeline_status", {});

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain("pipelineName");
        });

        it("should handle 404 error for nonexistent pipeline", async () => {
            vi.mocked(mockBoundClient.getPipelineStatus).mockRejectedValue(
                new GocdApiError(404, "Not Found", "pipelines/nonexistent/status", "Pipeline not found"),
            );

            const result = await handlePipelineTool(mockBoundClient, "get_pipeline_status", {
                pipelineName: "nonexistent",
            });

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain("NOT_FOUND");
        });
    });

    describe("get_pipeline_history", () => {
        it("should get pipeline history with default parameters", async () => {
            const mockHistory = { pipelines: [] };

            vi.mocked(mockBoundClient.getPipelineHistory).mockResolvedValue(mockHistory);

            const result = await handlePipelineTool(mockBoundClient, "get_pipeline_history", {
                pipelineName: "build-pipeline",
            });

            expect(result.isError).toBeUndefined();
            expect(result.content[0].text).toBe(JSON.stringify(mockHistory, null, 2));
            expect(mockBoundClient.getPipelineHistory).toHaveBeenCalledWith(
                "build-pipeline",
                undefined,
                undefined,
            );
        });

        it("should get pipeline history with pagination parameters", async () => {
            const mockHistory = { pipelines: [] };

            vi.mocked(mockBoundClient.getPipelineHistory).mockResolvedValue(mockHistory);

            const result = await handlePipelineTool(mockBoundClient, "get_pipeline_history", {
                pipelineName: "build-pipeline",
                pageSize: 20,
                after: 10,
            });

            expect(result.isError).toBeUndefined();
            expect(mockBoundClient.getPipelineHistory).toHaveBeenCalledWith( "build-pipeline", 20, 10);
        });
    });

    describe("get_pipeline_instance", () => {
        it("should get specific pipeline instance", async () => {
            const mockInstance = {
                name: "build-pipeline",
                counter: 42,
                label: "42",
                naturalOrder: 42,
                canRun: true,
                preparingToSchedule: false,
                comment: null,
                scheduledDate: 1640000000000,
                buildCause: {
                    triggerMessage: "Triggered by admin",
                    triggerForced: true,
                    approver: "admin",
                    materialRevisions: [],
                },
                stages: [],
            };

            vi.mocked(mockBoundClient.getPipelineInstance).mockResolvedValue(mockInstance);

            const result = await handlePipelineTool(mockBoundClient, "get_pipeline_instance", {
                pipelineName: "build-pipeline",
                pipelineCounter: 42,
            });

            expect(result.isError).toBeUndefined();
            expect(result.content[0].text).toBe(JSON.stringify(mockInstance, null, 2));
            expect(mockBoundClient.getPipelineInstance).toHaveBeenCalledWith( "build-pipeline", 42);
        });

        it("should reject when required parameters are missing", async () => {
            const result = await handlePipelineTool(mockBoundClient, "get_pipeline_instance", {
                pipelineName: "build-pipeline",
            });

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain("pipelineCounter");
        });
    });

    describe("trigger_pipeline", () => {
        it("should trigger pipeline without options", async () => {
            vi.mocked(mockBoundClient.triggerPipeline).mockResolvedValue({ success: true });

            const result = await handlePipelineTool(mockBoundClient, "trigger_pipeline", {
                pipelineName: "build-pipeline",
            });

            expect(result.isError).toBeUndefined();
            const response = JSON.parse(result.content[0].text);
            expect(response.success).toBe(true);
            expect(response.message).toContain("triggered");
            expect(mockBoundClient.triggerPipeline).toHaveBeenCalledWith( "build-pipeline", {
                environmentVariables: undefined,
                updateMaterials: undefined,
            });
        });

        it("should trigger pipeline with environment variables", async () => {
            vi.mocked(mockBoundClient.triggerPipeline).mockResolvedValue({ success: true });

            const result = await handlePipelineTool(mockBoundClient, "trigger_pipeline", {
                pipelineName: "build-pipeline",
                environmentVariables: { KEY1: "value1", KEY2: "value2" },
            });

            expect(result.isError).toBeUndefined();
            expect(mockBoundClient.triggerPipeline).toHaveBeenCalledWith( "build-pipeline", {
                environmentVariables: { KEY1: "value1", KEY2: "value2" },
                updateMaterials: undefined,
            });
        });

        it("should trigger pipeline with updateMaterials flag", async () => {
            vi.mocked(mockBoundClient.triggerPipeline).mockResolvedValue({ success: true });

            const result = await handlePipelineTool(mockBoundClient, "trigger_pipeline", {
                pipelineName: "build-pipeline",
                updateMaterials: false,
            });

            expect(result.isError).toBeUndefined();
            expect(mockBoundClient.triggerPipeline).toHaveBeenCalledWith( "build-pipeline", {
                environmentVariables: undefined,
                updateMaterials: false,
            });
        });
    });

    describe("pause_pipeline", () => {
        it("should pause pipeline without reason", async () => {
            vi.mocked(mockBoundClient.pausePipeline).mockResolvedValue({ success: true });

            const result = await handlePipelineTool(mockBoundClient, "pause_pipeline", {
                pipelineName: "build-pipeline",
            });

            expect(result.isError).toBeUndefined();
            const response = JSON.parse(result.content[0].text);
            expect(response.success).toBe(true);
            expect(response.message).toContain("paused");
            expect(mockBoundClient.pausePipeline).toHaveBeenCalledWith( "build-pipeline", undefined);
        });

        it("should pause pipeline with reason", async () => {
            vi.mocked(mockBoundClient.pausePipeline).mockResolvedValue({ success: true });

            const result = await handlePipelineTool(mockBoundClient, "pause_pipeline", {
                pipelineName: "build-pipeline",
                pauseCause: "Maintenance window",
            });

            expect(result.isError).toBeUndefined();
            expect(mockBoundClient.pausePipeline).toHaveBeenCalledWith( "build-pipeline", "Maintenance window");
        });
    });

    describe("unpause_pipeline", () => {
        it("should unpause pipeline", async () => {
            vi.mocked(mockBoundClient.unpausePipeline).mockResolvedValue({ success: true });

            const result = await handlePipelineTool(mockBoundClient, "unpause_pipeline", {
                pipelineName: "build-pipeline",
            });

            expect(result.isError).toBeUndefined();
            const response = JSON.parse(result.content[0].text);
            expect(response.success).toBe(true);
            expect(response.message).toContain("unpaused");
            expect(mockBoundClient.unpausePipeline).toHaveBeenCalledWith( "build-pipeline");
        });
    });

    describe("unknown tool", () => {
        it("should return error for unknown tool name", async () => {
            const result = await handlePipelineTool(mockBoundClient, "unknown_tool", {});

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain("Unknown pipeline tool");
        });
    });
});
