/**
 * 每日工作提醒排程（獨立執行，不依賴網站是否有人開啟）。
 * Render Cron Job：schedule "0 0 * * *"（UTC 00:00 ＝ 臺灣時間 08:00）
 *
 *   npm run cron:daily-reminders
 *   npm run cron:daily-reminders -- --force   # 非工作天也執行
 */
import { prisma } from "../src/lib/db";
import { runDailyReminders } from "../src/server/reminders/reminder-job";

async function main() {
  const summary = await runDailyReminders({ trigger: "CRON", force: process.argv.includes("--force") });
  console.log(JSON.stringify(summary));
  if (summary.status === "FAILED") process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
