import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
    resolve: {
        alias: {
            "@": resolve(__dirname, "./src"),
        },
    },
    test: {
        globals: true,
        environment: "node",
        setupFiles: ["./tests/setup.ts"],
        coverage: {
            provider: "v8",
            reporter: ["text", "json", "html", "lcov"],
            include: ["src/**/*.ts"],
            exclude: ["src/**/*.d.ts", "src/index.ts", "src/server.ts"],
            thresholds: {
                lines: 80,
                functions: 80,
                branches: 75,
                statements: 80,
            },
        },
    },
});
