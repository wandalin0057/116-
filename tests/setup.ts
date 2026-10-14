import { existsSync } from "node:fs";

// 載入 .env（若存在），並將資料庫切換至測試資料庫
if (existsSync(".env") && typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile(".env");
  } catch {
    /* ignore */
  }
}
(process.env as Record<string, string>).NODE_ENV = "test";
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.DATA_ENCRYPTION_KEY ??= Buffer.alloc(32, 7).toString("base64");
process.env.SESSION_SECRET ??= "test-session-secret-0123456789abcdef0123";
process.env.APP_URL ??= "http://localhost:3000";
process.env.EMAIL_PROVIDER = "console";
process.env.COMPANY_NAME ??= "測試交通工程顧問有限公司";
