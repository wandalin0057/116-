import type { TaskType } from "@prisma/client";
import { formatROC, formatROCShort, type ISODate } from "@/lib/dates";
import type { BusinessDayService } from "@/server/business-days/business-day-service";
import { TASK_TYPE_LABELS } from "@/server/schedule/task-types";

/** 每日提醒內容組成（純函式） */
export interface ReminderTask {
  id: string;
  caseId: string;
  schoolName: string;
  title: string;
  taskType: TaskType;
  dueDate: ISODate;
  estimated: boolean;
}

export interface ReminderPrefs {
  leadBusinessDays: number;
  overdueEnabled: boolean;
}

export interface DigestItem extends ReminderTask {
  remainingBusinessDays: number;
}

export interface Digest {
  dueToday: DigestItem[];
  upcoming: DigestItem[];
  overdue: DigestItem[];
}

export function buildDigest(tasks: ReminderTask[], prefs: ReminderPrefs, today: ISODate, bds: BusinessDayService): Digest {
  const digest: Digest = { dueToday: [], upcoming: [], overdue: [] };
  const lead = Math.max(0, Math.min(prefs.leadBusinessDays, 30));
  for (const t of tasks) {
    const remaining = bds.businessDaysBetween(today, t.dueDate);
    const item = { ...t, remainingBusinessDays: remaining };
    if (t.dueDate === today) digest.dueToday.push(item);
    else if (t.dueDate > today && remaining <= lead) digest.upcoming.push(item);
    else if (t.dueDate < today && prefs.overdueEnabled) digest.overdue.push(item);
  }
  const byDate = (a: DigestItem, b: DigestItem) => a.dueDate.localeCompare(b.dueDate) || a.schoolName.localeCompare(b.schoolName, "zh-Hant");
  digest.dueToday.sort(byDate);
  digest.upcoming.sort(byDate);
  digest.overdue.sort(byDate);
  return digest;
}

export const digestCount = (d: Digest) => d.dueToday.length + d.upcoming.length + d.overdue.length;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function renderDigestEmail(args: { recipientName: string; recipientEmail: string; date: ISODate; digest: Digest; appUrl: string; testMode: boolean; originalRecipient?: string }) {
  const { digest, appUrl } = args;
  const base = appUrl.replace(/\/$/, "");
  const subject = `${args.testMode ? "［測試］" : ""}【通學區案件】${formatROC(args.date)} 每日工作提醒（今日 ${digest.dueToday.length}、即將到期 ${digest.upcoming.length}、逾期 ${digest.overdue.length}）`;

  const section = (title: string, color: string, items: DigestItem[], remainLabel: (i: DigestItem) => string) => {
    if (!items.length) return `<h3 style="color:${color};margin:20px 0 6px">${title}（0）</h3><p style="color:#64748b;margin:0">無</p>`;
    const rows = items
      .map(
        (i) => `<tr>
<td style="padding:6px 8px;border-bottom:1px solid #e2e8f0">${esc(i.schoolName)}</td>
<td style="padding:6px 8px;border-bottom:1px solid #e2e8f0">${esc(TASK_TYPE_LABELS[i.taskType])}<br><span style="color:#64748b;font-size:12px">${esc(i.title)}</span></td>
<td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;white-space:nowrap">${formatROCShort(i.dueDate)}${i.estimated ? "（暫估）" : ""}</td>
<td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;white-space:nowrap">${remainLabel(i)}</td>
<td style="padding:6px 8px;border-bottom:1px solid #e2e8f0"><a href="${base}/cases/${i.caseId}">查看案件</a></td>
</tr>`,
      )
      .join("");
    return `<h3 style="color:${color};margin:20px 0 6px">${title}（${items.length}）</h3>
<table style="border-collapse:collapse;width:100%;font-size:14px"><thead><tr style="background:#f1f5f9;text-align:left">
<th style="padding:6px 8px">學校</th><th style="padding:6px 8px">工作</th><th style="padding:6px 8px">期限</th><th style="padding:6px 8px">剩餘工作天</th><th style="padding:6px 8px">連結</th>
</tr></thead><tbody>${rows}</tbody></table>`;
  };

  const testBanner = args.testMode
    ? `<p style="background:#fef3c7;border:1px solid #f59e0b;padding:8px;border-radius:6px">測試模式：此信原應寄給 ${esc(args.originalRecipient ?? "")}，已改寄測試收件人。</p>`
    : "";

  const html = `<div style="font-family:'Noto Sans TC','Microsoft JhengHei',sans-serif;color:#0f172a;max-width:760px">
${testBanner}
<h2 style="color:#1e3a8a;margin:0 0 4px">每日工作提醒</h2>
<p style="margin:0 0 4px">收件人：${esc(args.recipientName)}（${esc(args.recipientEmail)}）</p>
<p style="margin:0 0 12px">日期：${formatROC(args.date)}</p>
${section("今日到期", "#b45309", digest.dueToday, () => "今日")}
${section("即將到期", "#1d4ed8", digest.upcoming, (i) => `${i.remainingBusinessDays} 個工作天`)}
${section("已逾期", "#b91c1c", digest.overdue, (i) => `逾期 ${Math.abs(i.remainingBusinessDays)} 個工作天`)}
<p style="margin-top:20px"><a href="${base}/" style="background:#1e3a8a;color:#fff;padding:8px 14px;border-radius:6px;text-decoration:none">開啟系統儀表板</a></p>
<p style="color:#94a3b8;font-size:12px;margin-top:16px">此信由通學區案件期程暨發文管理系統自動寄送；可於系統「通知設定」調整提醒方式。</p>
</div>`;

  const line = (i: DigestItem, extra: string) => `- ${i.schoolName}｜${TASK_TYPE_LABELS[i.taskType]}｜${formatROCShort(i.dueDate)}${i.estimated ? "（暫估）" : ""}｜${extra}｜${base}/cases/${i.caseId}`;
  const text = [
    args.testMode ? `［測試模式］原收件人：${args.originalRecipient ?? ""}` : "",
    `收件人：${args.recipientName}（${args.recipientEmail}）`,
    `日期：${formatROC(args.date)}`,
    "",
    `■ 今日到期（${digest.dueToday.length}）`,
    ...digest.dueToday.map((i) => line(i, "今日")),
    "",
    `■ 即將到期（${digest.upcoming.length}）`,
    ...digest.upcoming.map((i) => line(i, `${i.remainingBusinessDays} 個工作天`)),
    "",
    `■ 已逾期（${digest.overdue.length}）`,
    ...digest.overdue.map((i) => line(i, `逾期 ${Math.abs(i.remainingBusinessDays)} 個工作天`)),
    "",
    `系統連結：${base}/`,
  ]
    .filter((l, idx) => idx !== 0 || l)
    .join("\n");

  return { subject, html, text };
}
