import { describe, it, expect, beforeEach } from "vitest";
import nock from "nock";
import { GocdClient } from "../../../src/client/gocd-client.js";
import { Config } from "../../../src/config.js";
import embeddedFormat from "../../fixtures/dashboard/embedded-format.json";
import directFormat from "../../fixtures/dashboard/direct-format.json";
import stringArray from "../../fixtures/dashboard/string-array.json";
import objectArray from "../../fixtures/dashboard/object-array.json";
import emptyGroups from "../../fixtures/dashboard/empty-groups.json";
import noPipelines from "../../fixtures/dashboard/no-pipelines.json";

describe("GoCD API Response Parsing", () => {
    const config: Config = {
        serverUrl: "https://gocd.example.com",
        apiToken: "test-token",
    };

    let client: GocdClient;

    beforeEach(() => {
        client = new GocdClient(config);
        nock.cleanAll();
    });

    describe("listPipelines()", () => {
        it("should parse _embedded.pipeline_groups format with _embedded.pipelines", async () => {
            nock("https://gocd.example.com")
                .get("/go/api/dashboard")
                .matchHeader("Accept", "application/vnd.go.cd.v4+json")
                .matchHeader("Authorization", "Bearer test-token")
                .reply(200, embeddedFormat);

            const pipelines = await client.listPipelines();

            expect(pipelines).toHaveLength(3);
            expect(pipelines[0]).toEqual({
                name: "build-pipeline",
                group: "main",
                locked: false,
                pauseInfo: {
                    paused: true,
                    pausedBy: "admin",
                    pauseReason: "Maintenance",
                },
            });
            expect(pipelines[1]).toEqual({
                name: "deploy-pipeline",
                group: "main",
                locked: true,
                pauseInfo: {
                    paused: false,
                    pausedBy: null,
                    pauseReason: null,
                },
            });
            expect(pipelines[2]).toEqual({
                name: "test-pipeline",
                group: "staging",
                locked: false,
                pauseInfo: null,
            });
        });

        it("should parse direct pipeline_groups format with direct pipelines", async () => {
            nock("https://gocd.example.com")
                .get("/go/api/dashboard")
                .matchHeader("Accept", "application/vnd.go.cd.v4+json")
                .reply(200, directFormat);

            const pipelines = await client.listPipelines();

            expect(pipelines).toHaveLength(2);
            expect(pipelines[0]).toEqual({
                name: "build-pipeline",
                group: "main",
                locked: false,
                pauseInfo: {
                    paused: true,
                    pausedBy: "admin",
                    pauseReason: "Maintenance",
                },
            });
            expect(pipelines[1]).toEqual({
                name: "deploy-pipeline",
                group: "main",
                locked: true,
                pauseInfo: {
                    paused: false,
                    pausedBy: null,
                    pauseReason: null,
                },
            });
        });

        it("should parse string array format for pipelines", async () => {
            nock("https://gocd.example.com")
                .get("/go/api/dashboard")
                .matchHeader("Accept", "application/vnd.go.cd.v4+json")
                .reply(200, stringArray);

            const pipelines = await client.listPipelines();

            expect(pipelines).toHaveLength(4);
            expect(pipelines[0]).toEqual({
                name: "pipeline1",
                group: "main",
                locked: false,
                pauseInfo: null,
            });
            expect(pipelines[1]).toEqual({
                name: "pipeline2",
                group: "main",
                locked: false,
                pauseInfo: null,
            });
            expect(pipelines[2]).toEqual({
                name: "pipeline3",
                group: "main",
                locked: false,
                pauseInfo: null,
            });
            expect(pipelines[3]).toEqual({
                name: "staging-pipeline",
                group: "staging",
                locked: false,
                pauseInfo: null,
            });
        });

        it("should parse object array format with full metadata", async () => {
            nock("https://gocd.example.com")
                .get("/go/api/dashboard")
                .matchHeader("Accept", "application/vnd.go.cd.v4+json")
                .reply(200, objectArray);

            const pipelines = await client.listPipelines();

            expect(pipelines).toHaveLength(1);
            expect(pipelines[0]).toEqual({
                name: "build-pipeline",
                group: "main",
                locked: false,
                pauseInfo: {
                    paused: true,
                    pausedBy: "admin",
                    pauseReason: "Maintenance",
                },
            });
        });

        it("should return empty array when no pipeline groups exist", async () => {
            nock("https://gocd.example.com")
                .get("/go/api/dashboard")
                .matchHeader("Accept", "application/vnd.go.cd.v4+json")
                .reply(200, emptyGroups);

            const pipelines = await client.listPipelines();

            expect(pipelines).toEqual([]);
        });

        it("should return empty array when pipeline group has no pipelines", async () => {
            nock("https://gocd.example.com")
                .get("/go/api/dashboard")
                .matchHeader("Accept", "application/vnd.go.cd.v4+json")
                .reply(200, noPipelines);

            const pipelines = await client.listPipelines();

            expect(pipelines).toEqual([]);
        });

        it("should handle null/missing pause_info gracefully", async () => {
            const dataWithNullPauseInfo = {
                _embedded: {
                    pipeline_groups: [
                        {
                            name: "main",
                            _embedded: {
                                pipelines: [
                                    {
                                        name: "pipeline-no-pause",
                                        locked: false,
                                    },
                                ],
                            },
                        },
                    ],
                },
            };

            nock("https://gocd.example.com")
                .get("/go/api/dashboard")
                .matchHeader("Accept", "application/vnd.go.cd.v4+json")
                .reply(200, dataWithNullPauseInfo);

            const pipelines = await client.listPipelines();

            expect(pipelines).toHaveLength(1);
            expect(pipelines[0].pauseInfo).toBeNull();
        });

        it("should throw error when pipeline_groups field is missing", async () => {
            const invalidData = {
                some_other_field: "value",
            };

            nock("https://gocd.example.com")
                .get("/go/api/dashboard")
                .matchHeader("Accept", "application/vnd.go.cd.v4+json")
                .reply(200, invalidData);

            await expect(client.listPipelines()).rejects.toThrow(
                "Invalid dashboard response: missing pipeline_groups field",
            );
        });

        it("should correctly convert snake_case to camelCase", async () => {
            nock("https://gocd.example.com")
                .get("/go/api/dashboard")
                .matchHeader("Accept", "application/vnd.go.cd.v4+json")
                .reply(200, embeddedFormat);

            const pipelines = await client.listPipelines();

            const pausedPipeline = pipelines.find((p) => p.pauseInfo?.paused);
            expect(pausedPipeline?.pauseInfo).toHaveProperty("pausedBy");
            expect(pausedPipeline?.pauseInfo).toHaveProperty("pauseReason");
            expect(pausedPipeline?.pauseInfo).not.toHaveProperty("paused_by");
            expect(pausedPipeline?.pauseInfo).not.toHaveProperty("pause_reason");
        });

        it("should handle mixed format: nested embedded with direct format fallback", async () => {
            const mixedFormat = {
                _embedded: {
                    pipeline_groups: [
                        {
                            name: "group1",
                            pipelines: ["string-pipeline"],
                        },
                        {
                            name: "group2",
                            _embedded: {
                                pipelines: [
                                    {
                                        name: "object-pipeline",
                                        locked: true,
                                        pause_info: {
                                            paused: false,
                                            paused_by: null,
                                            pause_reason: null,
                                        },
                                    },
                                ],
                            },
                        },
                    ],
                },
            };

            nock("https://gocd.example.com")
                .get("/go/api/dashboard")
                .matchHeader("Accept", "application/vnd.go.cd.v4+json")
                .reply(200, mixedFormat);

            const pipelines = await client.listPipelines();

            expect(pipelines).toHaveLength(2);
            expect(pipelines[0]).toEqual({
                name: "string-pipeline",
                group: "group1",
                locked: false,
                pauseInfo: null,
            });
            expect(pipelines[1]).toEqual({
                name: "object-pipeline",
                group: "group2",
                locked: true,
                pauseInfo: {
                    paused: false,
                    pausedBy: null,
                    pauseReason: null,
                },
            });
        });
    });
});
