import { prisma } from "@/lib/db";
import { writeAudit } from "@/server/audit/audit";
import { assertAdmin } from "@/server/auth/permissions";
import type { AuthUser } from "@/server/auth/types";

/**
 * 資料備份（JSON 匯出）。
 * 為降低外洩風險：不含密碼雜湊、工作階段；附件下載密碼僅保留加密值。
 * 正式環境仍應搭配 PostgreSQL 每日備份（pg_dump 或 Render 自動備份）。
 */
export async function exportBackup(user: AuthUser | null) {
  if (user) assertAdmin(user);
  const [users, cases, members, tasks, histories, rules, meetings, siteVisits, documents, emailDrafts, templates, calendarYears, holidays, overrides, prefs, settings] =
    await Promise.all([
      prisma.user.findMany({ select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true, updatedAt: true } }),
      prisma.schoolCase.findMany(),
      prisma.caseMember.findMany(),
      prisma.task.findMany(),
      prisma.taskDueDateHistory.findMany(),
      prisma.deadlineRule.findMany(),
      prisma.meeting.findMany(),
      prisma.siteVisit.findMany(),
      prisma.officialDocument.findMany(),
      prisma.emailDraft.findMany(),
      prisma.documentTemplate.findMany(),
      prisma.calendarYear.findMany(),
      prisma.holidayCalendar.findMany(),
      prisma.businessDayOverride.findMany(),
      prisma.reminderPreference.findMany(),
      prisma.systemSetting.findMany(),
    ]);
  if (user) await writeAudit({ actorId: user.id, action: "BACKUP_EXPORT", entityType: "System", summary: "匯出資料備份（JSON）" });
  return {
    meta: { exportedAt: new Date().toISOString(), format: "school-zone-backup", version: 1, note: "不含密碼雜湊與工作階段；下載密碼為加密值" },
    users,
    schoolCases: cases,
    caseMembers: members,
    tasks,
    taskDueDateHistories: histories,
    deadlineRules: rules,
    meetings,
    siteVisits,
    officialDocuments: documents,
    emailDrafts,
    documentTemplates: templates,
    calendarYears,
    holidayCalendars: holidays,
    businessDayOverrides: overrides,
    reminderPreferences: prefs,
    systemSettings: settings,
  };
}
