import { describe, it, expect } from "vitest";
import { GocdApiError, formatErrorResponse } from "@/utils/errors.js";

describe("Error Utilities", () => {
    describe("GocdApiError", () => {
        it("should create error with all properties", () => {
            const error = new GocdApiError(404, "Not Found", "pipelines/test/status", '{"message":"Pipeline not found"}');

            expect(error).toBeInstanceOf(Error);
            expect(error.name).toBe("GocdApiError");
            expect(error.statusCode).toBe(404);
            expect(error.statusText).toBe("Not Found");
            expect(error.endpoint).toBe("pipelines/test/status");
            expect(error.responseBody).toBe('{"message":"Pipeline not found"}');
            expect(error.message).toBe("GoCD API Error (404): Not Found at pipelines/test/status");
        });

        it("should create error without response body", () => {
            const error = new GocdApiError(500, "Internal Server Error", "dashboard");

            expect(error.statusCode).toBe(500);
            expect(error.statusText).toBe("Internal Server Error");
            expect(error.endpoint).toBe("dashboard");
            expect(error.responseBody).toBeUndefined();
        });
    });

    describe("formatErrorResponse", () => {
        describe("GocdApiError formatting", () => {
            it("should format 401 unauthorized error", () => {
                const error = new GocdApiError(401, "Unauthorized", "pipelines/test/status");
                const formatted = formatErrorResponse(error);
                const parsed = JSON.parse(formatted);

                expect(parsed).toEqual({
                    error: true,
                    code: "UNAUTHORIZED",
                    message: "Authentication failed. Check GOCD_API_TOKEN.",
                });
            });

            it("should format 403 forbidden error", () => {
                const error = new GocdApiError(403, "Forbidden", "pipelines/test/trigger");
                const formatted = formatErrorResponse(error);
                const parsed = JSON.parse(formatted);

                expect(parsed).toEqual({
                    error: true,
                    code: "FORBIDDEN",
                    message: "Permission denied for pipelines/test/trigger",
                });
            });

            it("should format 404 not found error", () => {
                const error = new GocdApiError(404, "Not Found", "pipelines/nonexistent/status");
                const formatted = formatErrorResponse(error);
                const parsed = JSON.parse(formatted);

                expect(parsed).toEqual({
                    error: true,
                    code: "NOT_FOUND",
                    message: "Resource not found: pipelines/nonexistent/status",
                });
            });

            it("should format generic API error for other status codes", () => {
                const error = new GocdApiError(500, "Internal Server Error", "dashboard");
                const formatted = formatErrorResponse(error);
                const parsed = JSON.parse(formatted);

                expect(parsed).toEqual({
                    error: true,
                    code: "API_ERROR",
                    message: "GoCD API Error (500): Internal Server Error at dashboard",
                    statusCode: 500,
                });
            });

            it("should format 400 bad request error", () => {
                const error = new GocdApiError(400, "Bad Request", "pipelines/test/schedule");
                const formatted = formatErrorResponse(error);
                const parsed = JSON.parse(formatted);

                expect(parsed).toEqual({
                    error: true,
                    code: "API_ERROR",
                    message: "GoCD API Error (400): Bad Request at pipelines/test/schedule",
                    statusCode: 400,
                });
            });

            it("should format 503 service unavailable error", () => {
                const error = new GocdApiError(503, "Service Unavailable", "dashboard");
                const formatted = formatErrorResponse(error);
                const parsed = JSON.parse(formatted);

                expect(parsed).toEqual({
                    error: true,
                    code: "API_ERROR",
                    message: "GoCD API Error (503): Service Unavailable at dashboard",
                    statusCode: 503,
                });
            });
        });

        describe("Generic Error formatting", () => {
            it("should format standard Error instance", () => {
                const error = new Error("Something went wrong");
                const formatted = formatErrorResponse(error);
                const parsed = JSON.parse(formatted);

                expect(parsed).toEqual({
                    error: true,
                    code: "ERROR",
                    message: "Something went wrong",
                });
            });

            it("should format Error with empty message", () => {
                const error = new Error("");
                const formatted = formatErrorResponse(error);
                const parsed = JSON.parse(formatted);

                expect(parsed).toEqual({
                    error: true,
                    code: "ERROR",
                    message: "",
                });
            });

            it("should format custom Error subclass", () => {
                class CustomError extends Error {
                    constructor(message: string) {
                        super(message);
                        this.name = "CustomError";
                    }
                }

                const error = new CustomError("Custom error occurred");
                const formatted = formatErrorResponse(error);
                const parsed = JSON.parse(formatted);

                expect(parsed).toEqual({
                    error: true,
                    code: "ERROR",
                    message: "Custom error occurred",
                });
            });
        });

        describe("Unknown error formatting", () => {
            it("should format string as unknown error", () => {
                const formatted = formatErrorResponse("Something went wrong");
                const parsed = JSON.parse(formatted);

                expect(parsed).toEqual({
                    error: true,
                    code: "UNKNOWN_ERROR",
                    message: "Something went wrong",
                });
            });

            it("should format number as unknown error", () => {
                const formatted = formatErrorResponse(42);
                const parsed = JSON.parse(formatted);

                expect(parsed).toEqual({
                    error: true,
                    code: "UNKNOWN_ERROR",
                    message: "42",
                });
            });

            it("should format null as unknown error", () => {
                const formatted = formatErrorResponse(null);
                const parsed = JSON.parse(formatted);

                expect(parsed).toEqual({
                    error: true,
                    code: "UNKNOWN_ERROR",
                    message: "null",
                });
            });

            it("should format undefined as unknown error", () => {
                const formatted = formatErrorResponse(undefined);
                const parsed = JSON.parse(formatted);

                expect(parsed).toEqual({
                    error: true,
                    code: "UNKNOWN_ERROR",
                    message: "undefined",
                });
            });

            it("should format object as unknown error", () => {
                const formatted = formatErrorResponse({ custom: "error" });
                const parsed = JSON.parse(formatted);

                expect(parsed).toEqual({
                    error: true,
                    code: "UNKNOWN_ERROR",
                    message: "[object Object]",
                });
            });
        });

        describe("Error response structure", () => {
            it("should always return valid JSON", () => {
                const errors = [
                    new GocdApiError(401, "Unauthorized", "test"),
                    new Error("Test error"),
                    "string error",
                    null,
                    undefined,
                    42,
                ];

                errors.forEach((error) => {
                    const formatted = formatErrorResponse(error);
                    expect(() => JSON.parse(formatted)).not.toThrow();
                });
            });

            it("should always include error flag", () => {
                const errors = [
                    new GocdApiError(500, "Error", "test"),
                    new Error("Test"),
                    "error",
                ];

                errors.forEach((error) => {
                    const formatted = formatErrorResponse(error);
                    const parsed = JSON.parse(formatted);
                    expect(parsed.error).toBe(true);
                });
            });

            it("should always include code field", () => {
                const errors = [
                    new GocdApiError(401, "Unauthorized", "test"),
                    new Error("Test"),
                    "error",
                ];

                errors.forEach((error) => {
                    const formatted = formatErrorResponse(error);
                    const parsed = JSON.parse(formatted);
                    expect(parsed.code).toBeDefined();
                    expect(typeof parsed.code).toBe("string");
                });
            });

            it("should always include message field", () => {
                const errors = [
                    new GocdApiError(500, "Error", "test"),
                    new Error("Test"),
                    "error",
                ];

                errors.forEach((error) => {
                    const formatted = formatErrorResponse(error);
                    const parsed = JSON.parse(formatted);
                    expect(parsed.message).toBeDefined();
                });
            });
        });
    });
});
