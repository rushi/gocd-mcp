import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleStageTool } from "@/tools/stages.js";
import { BoundGoCDClient } from "@/client/gocd-client.js";
import { GocdApiError } from "@/utils/errors.js";

describe("Stage Tools", () => {
    let mockBoundClient: BoundGoCDClient;

    beforeEach(() => {
        mockBoundClient = {
            getStageInstance: vi.fn(),
            triggerStage: vi.fn(),
            cancelStage: vi.fn(),
        } as unknown as BoundGoCDClient;
    });

    describe("get_stage_instance", () => {
        it("should get stage instance with all required parameters", async () => {
            const mockStage = {
                name: "build",
                counter: 1,
                status: "Passed",
                result: "Passed",
                approvalType: "auto",
                approvedBy: null,
                scheduledDate: 1640000000000,
                rerunOfCounter: null,
                operatePermission: true,
                canRun: true,
                jobs: [],
            };

            vi.mocked(mockBoundClient.getStageInstance).mockResolvedValue(mockStage);

            const result = await handleStageTool(mockBoundClient, "get_stage_instance", {
                pipelineName: "build-pipeline",
                pipelineCounter: 10,
                stageName: "build",
                stageCounter: 1,
            });

            expect(result.isError).toBeUndefined();
            expect(result.content[0].text).toBe(JSON.stringify(mockStage, null, 2));
            expect(mockBoundClient.getStageInstance).toHaveBeenCalledWith( "build-pipeline", 10, "build", 1);
        });

        it("should reject when required parameters are missing", async () => {
            const result = await handleStageTool(mockBoundClient, "get_stage_instance", {
                pipelineName: "build-pipeline",
                pipelineCounter: 10,
                stageName: "build",
            });

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain("stageCounter");
        });

        it("should handle errors from client", async () => {
            vi.mocked(mockBoundClient.getStageInstance).mockRejectedValue(
                new GocdApiError(404, "Not Found", "stages/build-pipeline/10/build/1", "Stage not found"),
            );

            const result = await handleStageTool(mockBoundClient, "get_stage_instance", {
                pipelineName: "build-pipeline",
                pipelineCounter: 10,
                stageName: "build",
                stageCounter: 1,
            });

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain("NOT_FOUND");
        });
    });

    describe("trigger_stage", () => {
        it("should trigger stage successfully", async () => {
            vi.mocked(mockBoundClient.triggerStage).mockResolvedValue({ success: true });

            const result = await handleStageTool(mockBoundClient, "trigger_stage", {
                pipelineName: "build-pipeline",
                pipelineCounter: 10,
                stageName: "deploy",
            });

            expect(result.isError).toBeUndefined();
            const response = JSON.parse(result.content[0].text);
            expect(response.success).toBe(true);
            expect(response.message).toContain("Stage deploy triggered");
            expect(mockBoundClient.triggerStage).toHaveBeenCalledWith( "build-pipeline", 10, "deploy");
        });

        it("should reject when pipelineName is missing", async () => {
            const result = await handleStageTool(mockBoundClient, "trigger_stage", {
                pipelineCounter: 10,
                stageName: "deploy",
            });

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain("pipelineName");
        });

        it("should handle permission errors", async () => {
            vi.mocked(mockBoundClient.triggerStage).mockRejectedValue(
                new GocdApiError(403, "Forbidden", "stages/build-pipeline/10/deploy/run", "Insufficient permissions"),
            );

            const result = await handleStageTool(mockBoundClient, "trigger_stage", {
                pipelineName: "build-pipeline",
                pipelineCounter: 10,
                stageName: "deploy",
            });

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain("FORBIDDEN");
        });
    });

    describe("cancel_stage", () => {
        it("should cancel stage successfully", async () => {
            vi.mocked(mockBoundClient.cancelStage).mockResolvedValue({ success: true });

            const result = await handleStageTool(mockBoundClient, "cancel_stage", {
                pipelineName: "build-pipeline",
                pipelineCounter: 10,
                stageName: "build",
                stageCounter: 1,
            });

            expect(result.isError).toBeUndefined();
            const response = JSON.parse(result.content[0].text);
            expect(response.success).toBe(true);
            expect(response.message).toContain("Stage build/1 cancelled");
            expect(mockBoundClient.cancelStage).toHaveBeenCalledWith( "build-pipeline", 10, "build", 1);
        });

        it("should reject when stageCounter is missing", async () => {
            const result = await handleStageTool(mockBoundClient, "cancel_stage", {
                pipelineName: "build-pipeline",
                pipelineCounter: 10,
                stageName: "build",
            });

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain("stageCounter");
        });

        it("should handle cancellation errors", async () => {
            vi.mocked(mockBoundClient.cancelStage).mockRejectedValue(
                new GocdApiError(400, "Bad Request", "stages/build-pipeline/10/build/1/cancel", "Stage not running"),
            );

            const result = await handleStageTool(mockBoundClient, "cancel_stage", {
                pipelineName: "build-pipeline",
                pipelineCounter: 10,
                stageName: "build",
                stageCounter: 1,
            });

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain("400");
        });
    });

    describe("unknown tool", () => {
        it("should return error for unknown tool name", async () => {
            const result = await handleStageTool(mockBoundClient, "unknown_tool", {});

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain("Unknown stage tool");
        });
    });
});
