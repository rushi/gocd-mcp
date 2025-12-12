import { describe, it, expect, beforeEach } from "vitest";
import nock from "nock";
import { GocdClient } from "@/client/gocd-client.js";
import { Config } from "@/config.js";
import { GocdApiError } from "@/utils/errors.js";
import pipelineStatus from "../../fixtures/pipelines/pipeline-status.json";
import pipelineHistory from "../../fixtures/pipelines/pipeline-history.json";

describe("GocdClient API Endpoints", () => {
    const config: Config = {
        serverUrl: "https://gocd.example.com",
        apiToken: "test-token",
    };

    let client: GocdClient;

    beforeEach(() => {
        client = new GocdClient(config);
        nock.cleanAll();
    });

    describe("getPipelineStatus()", () => {
        it("should fetch pipeline status with correct API version", async () => {
            nock("https://gocd.example.com")
                .get("/go/api/pipelines/build-pipeline/status")
                .matchHeader("Accept", "application/vnd.go.cd.v1+json")
                .matchHeader("Authorization", "Bearer test-token")
                .reply(200, pipelineStatus);

            const status = await client.getPipelineStatus("build-pipeline");

            expect(status).toEqual(pipelineStatus);
        });

        it("should URL encode pipeline names with special characters", async () => {
            nock("https://gocd.example.com")
                .get("/go/api/pipelines/my%20pipeline%20%2F%20test/status")
                .matchHeader("Accept", "application/vnd.go.cd.v1+json")
                .reply(200, pipelineStatus);

            const status = await client.getPipelineStatus("my pipeline / test");

            expect(status).toEqual(pipelineStatus);
        });
    });

    describe("getPipelineHistory()", () => {
        it("should fetch pipeline history with default parameters", async () => {
            nock("https://gocd.example.com")
                .get("/go/api/pipelines/build-pipeline/history")
                .matchHeader("Accept", "application/vnd.go.cd.v1+json")
                .reply(200, pipelineHistory);

            const history = await client.getPipelineHistory("build-pipeline");

            expect(history).toEqual(pipelineHistory);
        });

        it("should include pagination query parameters when provided", async () => {
            nock("https://gocd.example.com")
                .get("/go/api/pipelines/build-pipeline/history")
                .query({ page_size: "10", after: "5" })
                .matchHeader("Accept", "application/vnd.go.cd.v1+json")
                .reply(200, pipelineHistory);

            const history = await client.getPipelineHistory("build-pipeline", 10, 5);

            expect(history).toEqual(pipelineHistory);
        });

        it("should include only pageSize when after is not provided", async () => {
            nock("https://gocd.example.com")
                .get("/go/api/pipelines/build-pipeline/history")
                .query({ page_size: "20" })
                .matchHeader("Accept", "application/vnd.go.cd.v1+json")
                .reply(200, pipelineHistory);

            const history = await client.getPipelineHistory("build-pipeline", 20);

            expect(history).toEqual(pipelineHistory);
        });
    });

    describe("getPipelineInstance()", () => {
        it("should fetch specific pipeline instance by counter", async () => {
            const instance = {
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

            nock("https://gocd.example.com")
                .get("/go/api/pipelines/build-pipeline/42")
                .matchHeader("Accept", "application/vnd.go.cd.v1+json")
                .reply(200, instance);

            const result = await client.getPipelineInstance("build-pipeline", 42);

            expect(result).toEqual(instance);
        });
    });

    describe("triggerPipeline()", () => {
        it("should trigger pipeline without options", async () => {
            nock("https://gocd.example.com")
                .post("/go/api/pipelines/build-pipeline/schedule")
                .matchHeader("Accept", "application/vnd.go.cd.v1+json")
                .reply(202);

            const result = await client.triggerPipeline("build-pipeline");

            expect(result).toEqual({ success: true });
        });

        it("should transform environment variables to array format", async () => {
            nock("https://gocd.example.com")
                .post("/go/api/pipelines/build-pipeline/schedule", (body: any) => {
                    expect(body.environment_variables).toEqual([
                        { name: "ENV_VAR_1", value: "value1" },
                        { name: "ENV_VAR_2", value: "value2" },
                    ]);
                    return true;
                })
                .matchHeader("Accept", "application/vnd.go.cd.v1+json")
                .reply(202);

            const result = await client.triggerPipeline("build-pipeline", {
                environmentVariables: {
                    ENV_VAR_1: "value1",
                    ENV_VAR_2: "value2",
                },
            });

            expect(result).toEqual({ success: true });
        });

        it("should include updateMaterials flag when provided", async () => {
            nock("https://gocd.example.com")
                .post("/go/api/pipelines/build-pipeline/schedule", (body: any) => {
                    expect(body.update_materials_before_scheduling).toBe(false);
                    return true;
                })
                .matchHeader("Accept", "application/vnd.go.cd.v1+json")
                .reply(202);

            const result = await client.triggerPipeline("build-pipeline", {
                updateMaterials: false,
            });

            expect(result).toEqual({ success: true });
        });

        it("should include both env vars and updateMaterials", async () => {
            nock("https://gocd.example.com")
                .post("/go/api/pipelines/build-pipeline/schedule", (body: any) => {
                    expect(body.environment_variables).toEqual([{ name: "KEY", value: "val" }]);
                    expect(body.update_materials_before_scheduling).toBe(true);
                    return true;
                })
                .matchHeader("Accept", "application/vnd.go.cd.v1+json")
                .reply(202);

            const result = await client.triggerPipeline("build-pipeline", {
                environmentVariables: { KEY: "val" },
                updateMaterials: true,
            });

            expect(result).toEqual({ success: true });
        });
    });

    describe("pausePipeline()", () => {
        it("should pause pipeline with X-GoCD-Confirm header", async () => {
            nock("https://gocd.example.com")
                .post("/go/api/pipelines/build-pipeline/pause")
                .matchHeader("Accept", "application/vnd.go.cd.v1+json")
                .matchHeader("X-GoCD-Confirm", "true")
                .reply(200);

            const result = await client.pausePipeline("build-pipeline");

            expect(result).toEqual({ success: true });
        });

        it("should include pause reason when provided", async () => {
            nock("https://gocd.example.com")
                .post("/go/api/pipelines/build-pipeline/pause", (body: any) => {
                    expect(body.pause_cause).toBe("Maintenance window");
                    return true;
                })
                .matchHeader("X-GoCD-Confirm", "true")
                .reply(200);

            const result = await client.pausePipeline("build-pipeline", "Maintenance window");

            expect(result).toEqual({ success: true });
        });

        it("should send empty body when no reason provided", async () => {
            nock("https://gocd.example.com")
                .post("/go/api/pipelines/build-pipeline/pause", undefined)
                .matchHeader("X-GoCD-Confirm", "true")
                .reply(200);

            const result = await client.pausePipeline("build-pipeline");

            expect(result).toEqual({ success: true });
        });
    });

    describe("unpausePipeline()", () => {
        it("should unpause pipeline with X-GoCD-Confirm header", async () => {
            nock("https://gocd.example.com")
                .post("/go/api/pipelines/build-pipeline/unpause")
                .matchHeader("Accept", "application/vnd.go.cd.v1+json")
                .matchHeader("X-GoCD-Confirm", "true")
                .reply(200);

            const result = await client.unpausePipeline("build-pipeline");

            expect(result).toEqual({ success: true });
        });
    });

    describe("getStageInstance()", () => {
        it("should fetch stage instance with correct parameters", async () => {
            const stage = {
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

            nock("https://gocd.example.com")
                .get("/go/api/stages/build-pipeline/10/build/1")
                .matchHeader("Accept", "application/vnd.go.cd.v3+json")
                .reply(200, stage);

            const result = await client.getStageInstance("build-pipeline", 10, "build", 1);

            expect(result).toEqual(stage);
        });

        it("should URL encode pipeline and stage names", async () => {
            nock("https://gocd.example.com")
                .get("/go/api/stages/my%20pipeline/10/my%20stage/1")
                .matchHeader("Accept", "application/vnd.go.cd.v3+json")
                .reply(200, {});

            await client.getStageInstance("my pipeline", 10, "my stage", 1);

            expect(nock.isDone()).toBe(true);
        });
    });

    describe("triggerStage()", () => {
        it("should trigger stage with correct API version", async () => {
            nock("https://gocd.example.com")
                .post("/go/api/stages/build-pipeline/10/build/run")
                .matchHeader("Accept", "application/vnd.go.cd.v2+json")
                .reply(202);

            const result = await client.triggerStage("build-pipeline", 10, "build");

            expect(result).toEqual({ success: true });
        });
    });

    describe("cancelStage()", () => {
        it("should cancel stage with X-GoCD-Confirm header", async () => {
            nock("https://gocd.example.com")
                .post("/go/api/stages/build-pipeline/10/build/1/cancel")
                .matchHeader("Accept", "application/vnd.go.cd.v3+json")
                .matchHeader("X-GoCD-Confirm", "true")
                .reply(200);

            const result = await client.cancelStage("build-pipeline", 10, "build", 1);

            expect(result).toEqual({ success: true });
        });
    });

    describe("getJobHistory()", () => {
        it("should fetch job history with default parameters", async () => {
            const jobHistory = {
                jobs: [],
                pagination: {
                    offset: 0,
                    total: 0,
                    pageSize: 10,
                },
            };

            nock("https://gocd.example.com")
                .get("/go/api/jobs/build-pipeline/build/test-job/history")
                .matchHeader("Accept", "application/vnd.go.cd.v1+json")
                .reply(200, jobHistory);

            const result = await client.getJobHistory("build-pipeline", "build", "test-job");

            expect(result).toEqual(jobHistory);
        });

        it("should include page_size query parameter when provided", async () => {
            nock("https://gocd.example.com")
                .get("/go/api/jobs/build-pipeline/build/test-job/history")
                .query({ page_size: "20" })
                .matchHeader("Accept", "application/vnd.go.cd.v1+json")
                .reply(200, { jobs: [], pagination: { offset: 0, total: 0, pageSize: 20 } });

            const result = await client.getJobHistory("build-pipeline", "build", "test-job", 20);

            expect(result.pagination.pageSize).toBe(20);
        });
    });

    describe("getJobInstance()", () => {
        it("should fetch job instance with all parameters", async () => {
            const job = {
                name: "test-job",
                state: "Completed",
                result: "Passed",
                scheduledDate: 1640000000000,
                agentUuid: "agent-123",
                originalJobId: null,
                rerun: false,
            };

            nock("https://gocd.example.com")
                .get("/go/api/jobs/build-pipeline/10/build/1/test-job")
                .matchHeader("Accept", "application/vnd.go.cd.v1+json")
                .reply(200, job);

            const result = await client.getJobInstance("build-pipeline", 10, "build", 1, "test-job");

            expect(result).toEqual(job);
        });

        it("should URL encode all name parameters", async () => {
            nock("https://gocd.example.com")
                .get("/go/api/jobs/my%20pipeline/10/my%20stage/1/my%20job")
                .matchHeader("Accept", "application/vnd.go.cd.v1+json")
                .reply(200, {});

            await client.getJobInstance("my pipeline", 10, "my stage", 1, "my job");

            expect(nock.isDone()).toBe(true);
        });
    });

    describe("Error Handling", () => {
        it("should throw GocdApiError for 401 unauthorized", async () => {
            nock("https://gocd.example.com")
                .get("/go/api/pipelines/build-pipeline/status")
                .times(3)
                .reply(401, { message: "Unauthorized" });

            const error = await client.getPipelineStatus("build-pipeline").catch((e) => e);
            expect(error).toBeInstanceOf(GocdApiError);
            expect(error.message).toContain("401");
        });

        it("should throw GocdApiError for 403 forbidden", async () => {
            nock("https://gocd.example.com")
                .get("/go/api/pipelines/build-pipeline/status")
                .times(3)
                .reply(403, { message: "Forbidden" });

            const error = await client.getPipelineStatus("build-pipeline").catch((e) => e);
            expect(error).toBeInstanceOf(GocdApiError);
            expect(error.message).toContain("403");
        });

        it("should throw GocdApiError for 404 not found", async () => {
            nock("https://gocd.example.com")
                .get("/go/api/pipelines/nonexistent/status")
                .times(3)
                .reply(404, { message: "Pipeline not found" });

            const error = await client.getPipelineStatus("nonexistent").catch((e) => e);
            expect(error).toBeInstanceOf(GocdApiError);
            expect(error.message).toContain("404");
        });

        it("should throw GocdApiError for 400 bad request", async () => {
            nock("https://gocd.example.com")
                .post("/go/api/pipelines/build-pipeline/schedule")
                .reply(400, { message: "Invalid request" });

            const error = await client.triggerPipeline("build-pipeline").catch((e) => e);
            expect(error).toBeInstanceOf(GocdApiError);
            expect(error.message).toContain("400");
        });

        it("should throw GocdApiError for 500 internal server error", async () => {
            nock("https://gocd.example.com")
                .get("/go/api/pipelines/build-pipeline/status")
                .times(3)
                .reply(500, { message: "Internal server error" });

            const error = await client.getPipelineStatus("build-pipeline").catch((e) => e);
            expect(error).toBeInstanceOf(GocdApiError);
            expect(error.message).toContain("500");
        });

        it("should return success for 202 accepted with no body", async () => {
            nock("https://gocd.example.com")
                .post("/go/api/pipelines/build-pipeline/schedule")
                .reply(202);

            const result = await client.triggerPipeline("build-pipeline");

            expect(result).toEqual({ success: true });
        });

        it("should return success for 204 no content", async () => {
            nock("https://gocd.example.com")
                .post("/go/api/pipelines/build-pipeline/unpause")
                .matchHeader("X-GoCD-Confirm", "true")
                .reply(204);

            const result = await client.unpausePipeline("build-pipeline");

            expect(result).toEqual({ success: true });
        });

        it("should return success for empty body responses", async () => {
            nock("https://gocd.example.com")
                .post("/go/api/pipelines/build-pipeline/unpause")
                .matchHeader("X-GoCD-Confirm", "true")
                .reply(200, {});

            const result = await client.unpausePipeline("build-pipeline");

            expect(result).toEqual({ success: true });
        });
    });
});
