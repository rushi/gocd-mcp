import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadConfig } from "@/config.js";

const CERT = "-----BEGIN CERTIFICATE-----\nnot-a-real-cert\n-----END CERTIFICATE-----\n";

describe("loadConfig() TLS options", () => {
    let tempDir: string;

    beforeEach(() => {
        tempDir = mkdtempSync(join(tmpdir(), "gocd-mcp-config-"));
        process.env.GOCD_SERVER_URL = "https://gocd.example.com";
        delete process.env.GOCD_REJECT_UNAUTHORIZED;
        delete process.env.GOCD_CA_CERT;
    });

    afterEach(() => {
        rmSync(tempDir, { recursive: true, force: true });
        delete process.env.GOCD_SERVER_URL;
        delete process.env.GOCD_REJECT_UNAUTHORIZED;
        delete process.env.GOCD_CA_CERT;
        vi.restoreAllMocks();
    });

    it("should verify certificates by default", () => {
        const config = loadConfig();

        expect(config.gocd.rejectUnauthorized).toBe(true);
        expect(config.gocd.caCert).toBeUndefined();
    });

    it("should disable verification when GOCD_REJECT_UNAUTHORIZED is false", () => {
        const warn = vi.spyOn(console, "error").mockImplementation(() => {});
        process.env.GOCD_REJECT_UNAUTHORIZED = "false";

        const config = loadConfig();

        expect(config.gocd.rejectUnauthorized).toBe(false);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining("GOCD_REJECT_UNAUTHORIZED=false"));
    });

    it("should keep verification on for any other GOCD_REJECT_UNAUTHORIZED value", () => {
        process.env.GOCD_REJECT_UNAUTHORIZED = "0";

        expect(loadConfig().gocd.rejectUnauthorized).toBe(true);
    });

    it("should read the CA certificate from GOCD_CA_CERT", () => {
        const certPath = join(tempDir, "homelab-ca.pem");
        writeFileSync(certPath, CERT);
        process.env.GOCD_CA_CERT = certPath;

        const config = loadConfig();

        expect(config.gocd.caCert).toBe(CERT);
        expect(config.gocd.rejectUnauthorized).toBe(true);
    });

    it("should throw when GOCD_CA_CERT points at a missing file", () => {
        process.env.GOCD_CA_CERT = join(tempDir, "missing.pem");

        expect(() => loadConfig()).toThrow(/GOCD_CA_CERT could not be read/);
    });
});
