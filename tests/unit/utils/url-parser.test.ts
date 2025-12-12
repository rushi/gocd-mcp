import { describe, it, expect } from "vitest";
import { parseGocdUrl } from "@/utils/url-parser.js";

describe("URL Parser", () => {
    describe("parseGocdUrl", () => {
        describe("Job detail URLs", () => {
            it("should parse job detail URL with all components", () => {
                const url = "https://gocd.example.com/go/tab/build/detail/MyPipeline/123/BuildStage/1/UnitTests";
                const result = parseGocdUrl(url);

                expect(result).toEqual({
                    pipelineName: "MyPipeline",
                    pipelineCounter: 123,
                    stageName: "BuildStage",
                    stageCounter: 1,
                    jobName: "UnitTests",
                });
            });

            it("should parse job URL with hyphens in names", () => {
                const url = "https://gocd.example.com/go/tab/build/detail/my-pipeline/456/build-stage/2/unit-tests";
                const result = parseGocdUrl(url);

                expect(result).toEqual({
                    pipelineName: "my-pipeline",
                    pipelineCounter: 456,
                    stageName: "build-stage",
                    stageCounter: 2,
                    jobName: "unit-tests",
                });
            });

            it("should parse job URL with underscores in names", () => {
                const url = "https://gocd.example.com/go/tab/build/detail/my_pipeline/789/build_stage/1/unit_tests";
                const result = parseGocdUrl(url);

                expect(result).toEqual({
                    pipelineName: "my_pipeline",
                    pipelineCounter: 789,
                    stageName: "build_stage",
                    stageCounter: 1,
                    jobName: "unit_tests",
                });
            });

            it("should parse job URL with large counter numbers", () => {
                const url = "https://gocd.example.com/go/tab/build/detail/Pipeline/99999/Stage/9999/Job";
                const result = parseGocdUrl(url);

                expect(result).toEqual({
                    pipelineName: "Pipeline",
                    pipelineCounter: 99999,
                    stageName: "Stage",
                    stageCounter: 9999,
                    jobName: "Job",
                });
            });
        });

        describe("Stage URLs", () => {
            it("should parse stage URL with all components", () => {
                const url = "https://gocd.example.com/go/pipelines/MyPipeline/123/BuildStage/1";
                const result = parseGocdUrl(url);

                expect(result).toEqual({
                    pipelineName: "MyPipeline",
                    pipelineCounter: 123,
                    stageName: "BuildStage",
                    stageCounter: 1,
                });
            });

            it("should parse stage URL without job name", () => {
                const url = "https://gocd.example.com/go/pipelines/test-pipeline/100/test-stage/2";
                const result = parseGocdUrl(url);

                expect(result).toEqual({
                    pipelineName: "test-pipeline",
                    pipelineCounter: 100,
                    stageName: "test-stage",
                    stageCounter: 2,
                });
            });

            it("should parse stage URL with rerun counter", () => {
                const url = "https://gocd.example.com/go/pipelines/MyPipeline/50/DeployStage/3";
                const result = parseGocdUrl(url);

                expect(result).toEqual({
                    pipelineName: "MyPipeline",
                    pipelineCounter: 50,
                    stageName: "DeployStage",
                    stageCounter: 3,
                });
            });
        });

        describe("Pipeline value stream map URLs", () => {
            it("should parse pipeline VSM URL", () => {
                const url = "https://gocd.example.com/go/pipelines/value_stream_map/MyPipeline/123";
                const result = parseGocdUrl(url);

                expect(result).toEqual({
                    pipelineName: "MyPipeline",
                    pipelineCounter: 123,
                });
            });

            it("should parse VSM URL with hyphenated pipeline name", () => {
                const url = "https://gocd.example.com/go/pipelines/value_stream_map/my-pipeline/456";
                const result = parseGocdUrl(url);

                expect(result).toEqual({
                    pipelineName: "my-pipeline",
                    pipelineCounter: 456,
                });
            });
        });

        describe("Pipeline instance URLs", () => {
            it("should parse pipeline instance URL", () => {
                const url = "https://gocd.example.com/go/pipelines/MyPipeline/123";
                const result = parseGocdUrl(url);

                expect(result).toEqual({
                    pipelineName: "MyPipeline",
                    pipelineCounter: 123,
                });
            });

            it("should parse pipeline URL with counter 1", () => {
                const url = "https://gocd.example.com/go/pipelines/FirstRun/1";
                const result = parseGocdUrl(url);

                expect(result).toEqual({
                    pipelineName: "FirstRun",
                    pipelineCounter: 1,
                });
            });
        });

        describe("Different hosts and protocols", () => {
            it("should parse URL with different host", () => {
                const url = "https://ci.company.com/go/tab/build/detail/Pipeline/1/Stage/1/Job";
                const result = parseGocdUrl(url);

                expect(result.pipelineName).toBe("Pipeline");
            });

            it("should parse URL with localhost", () => {
                const url = "http://localhost:8153/go/tab/build/detail/Pipeline/1/Stage/1/Job";
                const result = parseGocdUrl(url);

                expect(result.pipelineName).toBe("Pipeline");
            });

            it("should parse URL with port number", () => {
                const url = "https://gocd.example.com:8154/go/tab/build/detail/Pipeline/1/Stage/1/Job";
                const result = parseGocdUrl(url);

                expect(result.pipelineName).toBe("Pipeline");
            });
        });

        describe("Error handling", () => {
            it("should throw error for invalid URL", () => {
                expect(() => parseGocdUrl("not-a-url")).toThrow("Invalid URL format");
            });

            it("should throw error for unrecognized GoCD URL format", () => {
                const url = "https://gocd.example.com/go/admin/pipelines";
                expect(() => parseGocdUrl(url)).toThrow("Unrecognized GoCD URL format");
            });

            it("should throw error for empty string", () => {
                expect(() => parseGocdUrl("")).toThrow("Invalid URL format");
            });

            it("should throw error for non-GoCD URL", () => {
                const url = "https://github.com/user/repo";
                expect(() => parseGocdUrl(url)).toThrow("Unrecognized GoCD URL format");
            });

            it("should throw error for GoCD URL without counter", () => {
                const url = "https://gocd.example.com/go/pipelines/MyPipeline";
                expect(() => parseGocdUrl(url)).toThrow("Unrecognized GoCD URL format");
            });

            it("should throw error for partial job URL", () => {
                const url = "https://gocd.example.com/go/tab/build/detail/Pipeline/123";
                expect(() => parseGocdUrl(url)).toThrow("Unrecognized GoCD URL format");
            });
        });

        describe("URL variations", () => {
            it("should parse URL with trailing slash", () => {
                const url = "https://gocd.example.com/go/pipelines/MyPipeline/123/";
                const result = parseGocdUrl(url);

                expect(result.pipelineName).toBe("MyPipeline");
                expect(result.pipelineCounter).toBe(123);
            });

            it("should parse URL with query parameters", () => {
                const url = "https://gocd.example.com/go/tab/build/detail/Pipeline/1/Stage/1/Job?tab=artifacts";
                const result = parseGocdUrl(url);

                expect(result).toEqual({
                    pipelineName: "Pipeline",
                    pipelineCounter: 1,
                    stageName: "Stage",
                    stageCounter: 1,
                    jobName: "Job",
                });
            });

            it("should parse URL with hash fragment", () => {
                const url = "https://gocd.example.com/go/tab/build/detail/Pipeline/1/Stage/1/Job#console";
                const result = parseGocdUrl(url);

                expect(result).toEqual({
                    pipelineName: "Pipeline",
                    pipelineCounter: 1,
                    stageName: "Stage",
                    stageCounter: 1,
                    jobName: "Job",
                });
            });
        });

        describe("Counter parsing", () => {
            it("should parse counters as numbers", () => {
                const url = "https://gocd.example.com/go/pipelines/Pipeline/42/Stage/7";
                const result = parseGocdUrl(url);

                expect(typeof result.pipelineCounter).toBe("number");
                expect(typeof result.stageCounter).toBe("number");
                expect(result.pipelineCounter).toBe(42);
                expect(result.stageCounter).toBe(7);
            });

            it("should handle zero-padded counters", () => {
                const url = "https://gocd.example.com/go/pipelines/Pipeline/007/Stage/001";
                const result = parseGocdUrl(url);

                expect(result.pipelineCounter).toBe(7);
                expect(result.stageCounter).toBe(1);
            });
        });
    });
});
