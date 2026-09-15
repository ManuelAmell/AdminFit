import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

const alias = { "@": path.resolve(__dirname, "./src") };

export default defineConfig({
  plugins: [react()],
  resolve: { alias },
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      exclude: ["node_modules/**", "tests/**", ".next/**", "src/components/ui/**"],
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "jsdom",
          setupFiles: ["./tests/unit/setup.ts"],
          include: ["tests/unit/**/*.test.{ts,tsx}"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          globalSetup: ["./tests/integration/setup.ts"],
          include: ["tests/integration/**/*.test.{ts,tsx}"],
          fileParallelism: false,
        },
      },
    ],
  },
});
