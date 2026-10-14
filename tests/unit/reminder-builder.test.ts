import { describe, expect, it } from "vitest";
import { buildDigest, renderDigestEmail, type ReminderTask } from "@/server/reminders/reminder-builder";
import { buildIcs } from "@/server/calendar/ics";
import { redact } from "@/lib/logger";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { bds2026 } from "../helpers/calendar";

const bds = bds2026();
const task = (id: string, dueDate: string): ReminderTask => ({ id, caseId: "c1", schoolName: "仁愛國小", title: id, taskType: "PRE_REPORT_DISPATCH", dueDate, estimated: false });

describe("每日提醒內容", () => {
  it("分類今日到期、未來 N 工作天內、已逾期", () => {
    // 2026-10-22（四）；未來 3 工作天：10/23、10/27、10/28（10/26 補假）
    const tasks = [task("today", "2026-10-22"), task("in1", "2026-10-23"), task("in3", "2026-10-28"), task("in4", "2026-10-29"), task("late", "2026-10-20")];
    const d = buildDigest(tasks, { leadBusinessDays: 3, overdueEnabled: true }, "2026-10-22", bds);
    expect(d.dueToday.map((t) => t.id)).toEqual(["today"]);
    expect(d.upcoming.map((t) => t.id)).toEqual(["in1", "in3"]);
    expect(d.overdue.map((t) => t.id)).toEqual(["late"]);
    expect(d.overdue[0].remainingBusinessDays).toBe(-2);
  });

  it("可關閉逾期通知", () => {
    const d = buildDigest([task("late", "2026-10-20")], { leadBusinessDays: 3, overdueEnabled: false }, "2026-10-22", bds);
    expect(d.overdue).toHaveLength(0);
  });

  it("Email 內容包含收件人、日期、清單與案件連結", () => {
    const d = buildDigest([task("today", "2026-10-22")], { leadBusinessDays: 3, overdueEnabled: true }, "2026-10-22", bds);
    const mail = renderDigestEmail({ recipientName: "陳工程師", recipientEmail: "chen@example.com", date: "2026-10-22", digest: d, appUrl: "https://app.example.com", testMode: false });
    expect(mail.subject).toContain("115年10月22日");
    expect(mail.html).toContain("陳工程師");
    expect(mail.html).toContain("https://app.example.com/cases/c1");
    expect(mail.text).toContain("今日到期（1）");
  });
});

describe("ICS 匯出", () => {
  it("產生全天與定時事件，並正確跳脫文字", () => {
    const ics = buildIcs(
      [
        { uid: "a@x", date: "2026-10-22", summary: "發文, 測試", description: "第一行\n第二行" },
        { uid: "b@x", date: "2026-10-23", start: new Date("2026-10-23T06:00:00Z"), summary: "審查會議" },
      ],
      { calendarName: "通學區", now: new Date("2026-10-01T00:00:00Z") },
    );
    expect(ics).toContain("DTSTART;VALUE=DATE:20261022");
    expect(ics).toContain("DTEND;VALUE=DATE:20261023");
    expect(ics).toContain("DTSTART:20261023T060000Z");
    expect(ics).toContain("SUMMARY:發文\\, 測試");
    expect(ics).toContain("第一行\\n第二行");
  });
});

describe("敏感資料保護", () => {
  it("日誌遮蔽密碼與金鑰", () => {
    const out = redact({ password: "x", attachmentPassword: "y", apiKey: "re_abcdefghijk", nested: { RESEND_API_KEY: "k" }, note: "token re_123456789abc" }) as Record<string, unknown>;
    expect(out.password).toBe("[已遮蔽]");
    expect(out.attachmentPassword).toBe("[已遮蔽]");
    expect(JSON.stringify(out)).not.toContain("re_123456789abc");
  });

  it("下載密碼以 AES-GCM 加密儲存", () => {
    const enc = encryptSecret("pw1234")!;
    expect(enc).not.toContain("pw1234");
    expect(decryptSecret(enc)).toBe("pw1234");
  });
});
