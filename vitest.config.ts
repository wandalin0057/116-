import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    globalSetup: ["tests/global-setup.ts"],
    // 整合測試共用同一個測試資料庫，需依序執行
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
