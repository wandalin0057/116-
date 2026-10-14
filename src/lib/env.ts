import { z } from "zod";

/**
 * 伺服器端環境變數（僅能於伺服器端 import）。
 * 金鑰類變數不得以 NEXT_PUBLIC_ 前綴暴露於前端。
 */
const boolish = z
  .enum(["true", "false", "1", "0", ""])
  .optional()
  .transform((v) => v === "true" || v === "1");

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL 未設定"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET 至少需 32 字元"),
  SESSION_MAX_AGE_HOURS: z.coerce.number().int().positive().default(12),
  DATA_ENCRYPTION_KEY: z.string().min(1, "DATA_ENCRYPTION_KEY 未設定"),
  CRON_SECRET: z.string().min(1).optional(),
  EMAIL_PROVIDER: z.enum(["resend", "smtp", "console"]).default("console"),
  EMAIL_FROM: z.string().default("通學區案件系統 <no-reply@example.com>"),
  RESEND_API_KEY: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().optional(),
  SMTP_SECURE: boolish,
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  EMAIL_TEST_MODE: z
    .enum(["true", "false", "1", "0", ""])
    .optional()
    .transform((v) => v === undefined || v === "" ? true : v === "true" || v === "1"),
  EMAIL_TEST_RECIPIENT: z.string().optional(),
  COMPANY_NAME: z.string().default("○○交通工程顧問有限公司"),
  PDF_FONT_PATH: z.string().optional(),
  PDF_FONT_FAMILY: z.string().optional(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`環境變數設定錯誤：${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/** 測試用：重設快取 */
export function resetEnvCache() {
  cached = null;
}
