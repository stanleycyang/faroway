import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    exclude: ["node_modules/**", "dist/**", "e2e/**", "playwright-report/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "lcov"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "server-only": path.resolve(__dirname, "__tests__/mocks/server-only.ts"),
      "@faroway/validation": path.resolve(
        __dirname,
        "../../packages/validation/src/index.ts",
      ),
      "@faroway/constants": path.resolve(
        __dirname,
        "../../packages/constants/src/index.ts",
      ),
    },
  },
});
