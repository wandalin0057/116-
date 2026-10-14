import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { logger } from "@/lib/logger";
import { runDailyReminders } from "@/server/reminders/reminder-job";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * 外部排程觸發每日提醒（備援用；主要排程為 Render Cron Job 直接執行 scripts/run-daily-reminders.ts）。
 * 需以 Authorization: Bearer $CRON_SECRET 呼叫。重複呼叫不會重複寄信。
 */
export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "未授權" }, { status: 401 });
  const force = req.nextUrl.searchParams.get("force") === "1";
  try {
    const summary = await runDailyReminders({ trigger: "API", force });
    return NextResponse.json(summary, { status: summary.status === "FAILED" ? 500 : 200 });
  } catch (err) {
    logger.error("Cron API 執行失敗", { err });
    return NextResponse.json({ error: "執行失敗" }, { status: 500 });
  }
}
