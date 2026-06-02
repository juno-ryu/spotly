import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      // 테스트가 도입된 모듈만 coverage 측정·강제. 다른 모듈은 점진적으로 추가
      include: [
        "src/server/anonymous/**/*.ts",
        "src/app/api/cron/cleanup-anonymous/**/*.ts",
        "src/features/analysis/anonymous-actions.ts",
        "src/app/auth/callback/**/*.ts",
      ],
      exclude: ["**/*.test.ts", "**/types.ts"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
