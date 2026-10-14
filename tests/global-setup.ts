import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

/** 整合測試前，對測試資料庫執行 migration */
export default function setup() {
  if (existsSync(".env") && typeof process.loadEnvFile === "function") {
    try {
      process.loadEnvFile(".env");
    } catch {
      /* ignore */
    }
  }
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    console.warn("[測試] 未設定 TEST_DATABASE_URL，將略過整合測試");
    return;
  }
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } });
}
