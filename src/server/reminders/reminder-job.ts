import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { dbDateToISO, isoToDbDate, taipeiToday, type ISODate } from "@/lib/dates";
import { logger } from "@/lib/logger";
import { loadBusinessDayService } from "@/server/business-days/calendar-repository";
import { getEmailSettings } from "@/server/settings/settings-service";
import { COLLEAGUE_REMINDER_TASKS, OPEN_TASK_STATUSES } from "@/server/schedule/task-types";
import { createMailer, type Mailer } from "./mailer";
import { buildDigest, digestCount, renderDigestEmail, type ReminderTask } from "./reminder-builder";

export const DAILY_JOB_NAME = "DAILY_REMINDER";
const MAX_ATTEMPTS = 5;
/** PENDING 狀態超過此時間視為中斷，可安全重試 */
const STALE_PENDING_MS = 15 * 60_000;

export interface RunOptions {
  now?: Date;
  trigger?: "CRON" | "MANUAL" | "API";
  mailer?: Mailer;
  /** 強制於非工作天執行 */
  force?: boolean;
  /** 只處理特定使用者（手動重試用） */
  userIds?: string[];
}

export interface RunSummary {
  jobRunId: string;
  runDate: ISODate;
  status: "SUCCEEDED" | "PARTIAL" | "FAILED";
  sent: number;
  failed: number;
  skipped: number;
  message: string;
}

export const dedupeKeyFor = (userId: string, date: ISODate, type: NotificationType = "DAILY_DIGEST") => `${type}:${userId}:${date}`;

type NotificationType = "DAILY_DIGEST" | "MANAGER_DIGEST";

const OPEN_TASK_WHERE = {
  reminderEnabled: true,
  status: { in: OPEN_TASK_STATUSES },
  schoolCase: { status: { in: ["ACTIVE", "ON_HOLD"] as ("ACTIVE" | "ON_HOLD")[] } },
};

function toReminderTask(t: {
  id: string;
  caseId: string;
  title: string;
  taskType: ReminderTask["taskType"];
  overrideDueDate: Date | null;
  calculatedDueDate: Date | null;
  dueDateEstimated: boolean;
  schoolCase: { schoolName: string; responsibleUser?: { name: string } };
  assignedUser?: { name: string } | null;
}): ReminderTask {
  return {
    id: t.id,
    caseId: t.caseId,
    schoolName: t.schoolCase.schoolName,
    title: t.title,
    taskType: t.taskType,
    dueDate: dbDateToISO((t.overrideDueDate ?? t.calculatedDueDate)!),
    estimated: !t.overrideDueDate && t.dueDateEstimated,
    assigneeName: t.assignedUser?.name ?? t.schoolCase.responsibleUser?.name ?? null,
  };
}

/** 全部學校總表：所有執行中案件之未完成工作（專案經理使用） */
async function loadAllTasks(): Promise<ReminderTask[]> {
  const tasks = await prisma.task.findMany({
    where: OPEN_TASK_WHERE,
    include: { schoolCase: { select: { schoolName: true, responsibleUser: { select: { name: true } } } }, assignedUser: { select: { name: true } } },
  });
  return tasks.filter((t) => t.overrideDueDate || t.calculatedDueDate).map(toReminderTask);
}

/**
 * 取得使用者的提醒工作：
 * - 一般同事：指派給本人（或未指派且本人為案件負責人）之「同事提醒工作」（提供報告書、簡報、修正圖說）
 * - 管理員（專案經理）：所有案件的全部工作
 */
async function loadUserTasks(user: { id: string; role: "ADMIN" | "USER" }): Promise<ReminderTask[]> {
  const mine = { OR: [{ assignedUserId: user.id }, { assignedUserId: null, schoolCase: { responsibleUserId: user.id } }] };
  const where: Prisma.TaskWhereInput =
    user.role === "ADMIN"
      ? OPEN_TASK_WHERE
      : { ...OPEN_TASK_WHERE, ...mine, taskType: { in: COLLEAGUE_REMINDER_TASKS } };
  const tasks = await prisma.task.findMany({
    where,
    include: { schoolCase: { select: { schoolName: true, responsibleUser: { select: { name: true } } } }, assignedUser: { select: { name: true } } },
  });
  return tasks.filter((t) => t.overrideDueDate || t.calculatedDueDate).map(toReminderTask);
}

/**
 * 嘗試取得寄送權：以 dedupeKey 唯一索引防止重複寄送。
 * 回傳 log id 表示取得寄送權；null 表示已寄送或其他程序處理中。
 */
async function claimNotification(args: {
  userId: string;
  type: NotificationType;
  dedupeKey: string;
  digestDate: ISODate;
  recipient: string;
  subject: string;
  itemCount: number;
  isTestMode: boolean;
  jobRunId: string;
}): Promise<string | null> {
  try {
    const created = await prisma.notificationLog.create({
      data: {
        userId: args.userId,
        type: args.type,
        dedupeKey: args.dedupeKey,
        digestDate: isoToDbDate(args.digestDate),
        recipient: args.recipient,
        subject: args.subject,
        status: "PENDING",
        attemptCount: 1,
        itemCount: args.itemCount,
        isTestMode: args.isTestMode,
        jobRunId: args.jobRunId,
      },
    });
    return created.id;
  } catch (err) {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2002") throw err;
  }
  // 已存在：僅失敗或中斷之紀錄可重試（以條件式更新確保只有一個程序取得）
  const existing = await prisma.notificationLog.findUnique({ where: { dedupeKey: args.dedupeKey } });
  if (!existing || existing.status === "SENT" || existing.status === "SKIPPED") return null;
  if (existing.attemptCount >= MAX_ATTEMPTS) return null;
  const staleBefore = new Date(Date.now() - STALE_PENDING_MS);
  const claimed = await prisma.notificationLog.updateMany({
    where: {
      id: existing.id,
      attemptCount: existing.attemptCount,
      OR: [{ status: "FAILED" }, { status: "PENDING", updatedAt: { lt: staleBefore } }],
    },
    data: {
      status: "PENDING",
      attemptCount: { increment: 1 },
      recipient: args.recipient,
      subject: args.subject,
      itemCount: args.itemCount,
      isTestMode: args.isTestMode,
      jobRunId: args.jobRunId,
      lastError: null,
    },
  });
  return claimed.count ? existing.id : null;
}

function safeError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.replace(/re_[A-Za-z0-9_]+/g, "re_[已遮蔽]").slice(0, 500);
}

export async function runDailyReminders(options: RunOptions = {}): Promise<RunSummary> {
  const now = options.now ?? new Date();
  const runDate = taipeiToday(now);
  const [bds, settings] = await Promise.all([loadBusinessDayService(), getEmailSettings()]);
  const jobRun = await prisma.jobRun.create({
    data: { jobName: DAILY_JOB_NAME, runDate: isoToDbDate(runDate), trigger: options.trigger ?? "CRON" },
  });

  const finish = async (status: RunSummary["status"], sent: number, failed: number, skipped: number, message: string): Promise<RunSummary> => {
    await prisma.jobRun.update({
      where: { id: jobRun.id },
      data: { status, finishedAt: new Date(), sentCount: sent, failedCount: failed, skippedCount: skipped, message },
    });
    logger.info("每日提醒排程完成", { jobRunId: jobRun.id, runDate, status, sent, failed, skipped });
    return { jobRunId: jobRun.id, runDate, status, sent, failed, skipped, message };
  };

  try {
    if (settings.skipNonBusinessDays && !options.force && !bds.isBusinessDay(runDate)) {
      return await finish("SUCCEEDED", 0, 0, 0, `${runDate} 為非工作天，依設定不寄送`);
    }
    if (settings.testMode && !settings.testRecipient) {
      return await finish("FAILED", 0, 0, 0, "測試模式已啟用但未設定測試收件人");
    }
    const mailer = options.mailer ?? createMailer();
    const users = await prisma.user.findMany({
      where: { isActive: true, ...(options.userIds ? { id: { in: options.userIds } } : {}) },
      include: { reminderPreference: true },
      orderBy: { createdAt: "asc" },
    });
    const appUrl = process.env.APP_URL ?? "http://localhost:3000";
    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const user of users) {
      const pref = user.reminderPreference ?? { emailEnabled: true, dailyDigestEnabled: true, leadBusinessDays: 3, overdueEnabled: true, managerDigestEnabled: false };
      // 管理員選擇「全部學校總表」時，改寄總表（已涵蓋自己負責的學校）
      const overview = user.role === "ADMIN" && pref.managerDigestEnabled;
      if (!pref.emailEnabled || (!pref.dailyDigestEnabled && !overview)) {
        skipped++;
        continue;
      }
      const type: NotificationType = overview ? "MANAGER_DIGEST" : "DAILY_DIGEST";
      const tasks = overview ? await loadAllTasks() : await loadUserTasks(user);
      const digest = buildDigest(tasks, pref, runDate, bds);
      const count = digestCount(digest);
      if (!count) {
        skipped++;
        continue;
      }
      const recipient = settings.testMode ? settings.testRecipient! : user.email;
      const email = renderDigestEmail({
        recipientName: user.name,
        recipientEmail: user.email,
        date: runDate,
        digest,
        appUrl,
        testMode: settings.testMode,
        originalRecipient: user.email,
        overview,
      });
      const dedupeKey = dedupeKeyFor(user.id, runDate, type);
      const logId = await claimNotification({
        userId: user.id,
        type,
        dedupeKey,
        digestDate: runDate,
        recipient,
        subject: email.subject,
        itemCount: count,
        isTestMode: settings.testMode,
        jobRunId: jobRun.id,
      });
      if (!logId) {
        skipped++;
        continue;
      }
      try {
        const result = await mailer.send({ to: recipient, subject: email.subject, html: email.html, text: email.text, idempotencyKey: dedupeKey });
        await prisma.notificationLog.update({ where: { id: logId }, data: { status: "SENT", sentAt: new Date(), providerMessageId: result.id ?? null } });
        sent++;
      } catch (err) {
        failed++;
        const message = safeError(err);
        await prisma.notificationLog.update({ where: { id: logId }, data: { status: "FAILED", lastError: message } });
        logger.error("每日提醒寄送失敗", { userId: user.id, error: message });
      }
    }
    const status = failed === 0 ? "SUCCEEDED" : sent > 0 ? "PARTIAL" : "FAILED";
    return await finish(status, sent, failed, skipped, `寄出 ${sent}、失敗 ${failed}、略過 ${skipped}`);
  } catch (err) {
    logger.error("每日提醒排程發生錯誤", { err });
    return await finish("FAILED", 0, 0, 0, safeError(err));
  }
}

/** 寄送測試信至測試收件人（管理員於設定頁使用） */
export async function sendTestEmail(to: string, mailer: Mailer = createMailer()) {
  const today = taipeiToday();
  return mailer.send({
    to,
    subject: "［測試］通學區案件期程暨發文管理系統 Email 設定測試",
    text: `這是一封測試信，寄送日期 ${today}。若您收到此信，表示 Email 設定正確。`,
    html: `<p>這是一封測試信，寄送日期 ${today}。</p><p>若您收到此信，表示 Email 設定正確。</p>`,
  });
}
