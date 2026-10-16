import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

const alias = { "@": fileURLToPath(new URL("./src", import.meta.url)) };

export default defineConfig({
  test: {
    // RLS 測試共用同一個資料庫，避免測試檔互相干擾
    fileParallelism: false,
    projects: [
      {
        resolve: { alias },
        test: { name: "unit", include: ["tests/unit/**/*.test.ts"], environment: "node" },
      },
      {
        resolve: { alias },
        test: {
          name: "rls",
          include: ["tests/rls/**/*.test.ts"],
          environment: "node",
          globalSetup: ["tests/rls/global-setup.ts"],
          testTimeout: 20000,
          hookTimeout: 60000,
        },
      },
    ],
  },
});
