/** 伺服器啟動時驗證環境變數，設定錯誤時立即失敗（避免以不安全設定運行） */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { getEnv } = await import("@/lib/env");
  const env = getEnv();
  if (env.NODE_ENV === "production") {
    if (env.SESSION_SECRET.startsWith("dev-only")) throw new Error("正式環境不可使用開發用 SESSION_SECRET");
    if (!env.CRON_SECRET) console.warn(JSON.stringify({ level: "warn", message: "未設定 CRON_SECRET，/api/cron 端點將拒絕所有請求" }));
    if (env.EMAIL_PROVIDER === "console") console.warn(JSON.stringify({ level: "warn", message: "EMAIL_PROVIDER=console，提醒信不會實際寄出" }));
  }
}
