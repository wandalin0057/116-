import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { createCase } from "@/server/cases/case-service";
import type { Mailer } from "@/server/reminders/mailer";
import { runDailyReminders } from "@/server/reminders/reminder-job";
import { caseInput, hasTestDb, makeUser, resetDatabase, seedBasics } from "../helpers/db";

function fakeMailer(fail = false): Mailer & { send: ReturnType<typeof vi.fn> } {
  return {
    name: "fake",
    send: vi.fn(async () => {
      if (fail) throw new Error("SMTP timeout");
      return { id: "msg-1" };
    }),
  };
}

// 2026-10-30（五）臺北 08:00 = UTC 00:00
const NOW = new Date("2026-10-30T00:00:00Z");

describe.skipIf(!hasTestDb)("12. 每日提醒排程", () => {
  beforeEach(async () => {
    await resetDatabase();
    await seedBasics();
    await prisma.systemSetting.create({ data: { key: "email", value: { testMode: false, testRecipient: null, skipNonBusinessDays: true } } });
  });

  it("同一日重複執行不重複寄信", async () => {
    const u = await makeUser("pm@example.com");
    await createCase(u, caseInput({ responsibleUserId: u.id }));
    const mailer = fakeMailer();
    const first = await runDailyReminders({ now: NOW, mailer, trigger: "MANUAL" });
    const second = await runDailyReminders({ now: NOW, mailer, trigger: "MANUAL" });
    expect(first.sent).toBe(1);
    expect(second.sent).toBe(0);
    expect(mailer.send).toHaveBeenCalledTimes(1);
    expect(await prisma.notificationLog.count()).toBe(1);
    const msg = mailer.send.mock.calls[0][0];
    expect(msg.to).toBe("pm@example.com");
    // 10/30 為事前規劃報告書創稿期限（今日到期）
    expect(msg.text).toContain("今日到期（1）");
    expect(await prisma.jobRun.count()).toBe(2);
  });

  it("寄送失敗會記錄並可安全重試", async () => {
    const u = await makeUser("pm@example.com");
    await createCase(u, caseInput({ responsibleUserId: u.id }));
    const r1 = await runDailyReminders({ now: NOW, mailer: fakeMailer(true) });
    expect(r1).toMatchObject({ status: "FAILED", failed: 1 });
    const log = await prisma.notificationLog.findFirstOrThrow();
    expect(log.status).toBe("FAILED");
    expect(log.lastError).toContain("SMTP timeout");
    const ok = fakeMailer();
    const r2 = await runDailyReminders({ now: NOW, mailer: ok });
    expect(r2.sent).toBe(1);
    const after = await prisma.notificationLog.findFirstOrThrow();
    expect(after).toMatchObject({ status: "SENT", attemptCount: 2 });
    // 成功後再執行不會再寄
    await runDailyReminders({ now: NOW, mailer: ok });
    expect(ok.send).toHaveBeenCalledTimes(1);
  });

  it("測試模式改寄測試收件人；使用者可關閉每日摘要", async () => {
    const u = await makeUser("pm@example.com");
    const v = await makeUser("off@example.com");
    await prisma.reminderPreference.update({ where: { userId: v.id }, data: { dailyDigestEnabled: false } });
    await createCase(u, caseInput({ responsibleUserId: u.id }));
    await createCase(v, caseInput({ responsibleUserId: v.id, projectCode: "TP-002" }));
    await prisma.systemSetting.update({ where: { key: "email" }, data: { value: { testMode: true, testRecipient: "qa@example.com", skipNonBusinessDays: true } } });
    const mailer = fakeMailer();
    await runDailyReminders({ now: NOW, mailer });
    expect(mailer.send).toHaveBeenCalledTimes(1);
    expect(mailer.send.mock.calls[0][0].to).toBe("qa@example.com");
    expect(mailer.send.mock.calls[0][0].subject).toContain("［測試］");
  });

  it("非工作天依設定不寄送（時區以臺北判定）", async () => {
    const u = await makeUser("pm@example.com");
    await createCase(u, caseInput({ responsibleUserId: u.id }));
    const mailer = fakeMailer();
    // UTC 2026-10-25 23:00 = 臺北 10/26（一）07:00，為光復節補假
    const r = await runDailyReminders({ now: new Date("2026-10-25T23:00:00Z"), mailer });
    expect(r.runDate).toBe("2026-10-26");
    expect(mailer.send).not.toHaveBeenCalled();
  });
});
