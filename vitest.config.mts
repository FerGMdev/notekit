import path from "node:path";
import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  /* Reuse the same .env the Next app and Prisma CLI read. */
  const env = loadEnv(mode, process.cwd(), "");

  return {
    resolve: {
      alias: {
        "@": path.resolve(process.cwd()),
      },
    },
    test: {
      environment: "node",
      include: ["tests/**/*.test.ts"],
      env,
      /* The suites share a database: run files one at a time. */
      fileParallelism: false,
      testTimeout: 30_000,
    },
  };
});
