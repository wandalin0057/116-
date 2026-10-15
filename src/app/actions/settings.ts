"use server";
import type { TaskType, TemplateType } from "@prisma/client";
import { requireAdminForAction, requireUserForAction } from "@/lib/auth";
import { runAction } from "@/lib/action-result";
import {
  addBusinessDayOverride,
  applyCalendarImport,
  applyRecalculation,
  previewCalendarImport,
  previewRecalculation,
  removeBusinessDayOverride,
} from "@/server/business-days/calendar-admin-service";
import { runDailyReminders, sendTestEmail } from "@/server/reminders/reminder-job";
import { previewRuleChange, updateRule, type RuleInput } from "@/server/schedule/rule-service";
import { getEmailSettings, updateEmailSettings } from "@/server/settings/settings-service";
import { activateTemplateVersion, saveTemplateVersion } from "@/server/templates/template-service";
import { ValidationError } from "@/server/errors";
import { writeAudit } from "@/server/audit/audit";
import {
  changeOwnPassword,
  createUser,
  resetUserPassword,
  updateReminderPreference,
  updateUser,
} from "@/server/users/user-service";

// ── 使用者 ──
export async function createUserAction(input: { email: string; name: string; role: "ADMIN" | "USER"; password: string }) {
  return runAction(async () => {
    await createUser(await requireAdminForAction(), input);
  }, "使用者已建立");
}
export async function updateUserAction(id: string, input: { name: string; role: "ADMIN" | "USER"; isActive: boolean }) {
  return runAction(async () => {
    await updateUser(await requireAdminForAction(), id, input);
  }, "使用者已更新");
}
export async function resetUserPasswordAction(id: string, password: string) {
  return runAction(async () => resetUserPassword(await requireAdminForAction(), id, password), "密碼已重設，該使用者需重新登入");
}
export async function changeOwnPasswordAction(current: string, next: string) {
  return runAction(async () => changeOwnPassword(await requireUserForAction(), current, next), "密碼已變更");
}

// ── 通知 ──
export async function updateReminderPreferenceAction(input: { emailEnabled: boolean; leadBusinessDays: number; overdueEnabled: boolean; dailyDigestEnabled: boolean; managerDigestEnabled?: boolean }) {
  return runAction(async () => updateReminderPreference(await requireUserForAction(), input), "通知設定已儲存");
}
export async function updateEmailSettingsAction(input: { testMode: boolean; testRecipient?: string; skipNonBusinessDays: boolean }) {
  return runAction(async () => updateEmailSettings(await requireAdminForAction(), input), "Email 設定已儲存");
}
export async function sendTestEmailAction(to: string) {
  return runAction(async () => {
    const admin = await requireAdminForAction();
    const settings = await getEmailSettings();
    const recipient = to.trim() || settings.testRecipient;
    if (!recipient) throw new ValidationError("請輸入測試收件人");
    if (settings.provider === "console") {
      throw new ValidationError("網站目前未設定寄信服務（EMAIL_PROVIDER=console），不會實際寄出。免費版請改用 GitHub「每日提醒」排程手動執行測試。");
    }
    await sendTestEmail(recipient);
    await writeAudit({ actorId: admin.id, action: "EMAIL_TEST_SEND", entityType: "SystemSetting", summary: `寄送測試信至 ${recipient}` });
  }, "測試信已送出，請至收件匣確認");
}
export async function runRemindersNowAction(force: boolean) {
  return runAction(async () => {
    const admin = await requireAdminForAction();
    const summary = await runDailyReminders({ trigger: "MANUAL", force });
    await writeAudit({ actorId: admin.id, action: "REMINDER_RUN_MANUAL", entityType: "JobRun", entityId: summary.jobRunId, summary: `手動執行每日提醒：${summary.message}` });
    return summary;
  });
}

// ── 工作日曆 ──
export async function previewCalendarImportAction(fileName: string, text: string, declaredComplete: boolean) {
  return runAction(async () => previewCalendarImport(await requireAdminForAction(), fileName, text, declaredComplete));
}
export async function applyCalendarImportAction(args: { fileName: string; text: string; declaredComplete: boolean; source: string; reason: string }) {
  return runAction(async () => {
    const parsed = await applyCalendarImport(await requireAdminForAction(), args);
    return { years: parsed.years.map((y) => y.year) };
  }, "辦公日曆已匯入，請至「期限重新計算」檢視並套用差異");
}
export async function addOverrideAction(input: { date: string; kind: "HOLIDAY" | "MAKEUP_WORKDAY"; reason: string }) {
  return runAction(async () => {
    await addBusinessDayOverride(await requireAdminForAction(), input);
  }, "已新增工作天調整，請至「期限重新計算」套用");
}
export async function removeOverrideAction(id: string, reason: string) {
  return runAction(async () => removeBusinessDayOverride(await requireAdminForAction(), id, reason), "已刪除工作天調整");
}
export async function previewRecalculationAction() {
  return runAction(async () => {
    await requireAdminForAction();
    return previewRecalculation();
  });
}
export async function applyRecalculationAction(reason: string) {
  return runAction(async () => {
    if (!reason.trim()) throw new ValidationError("請填寫重新計算原因");
    return applyRecalculation(await requireAdminForAction(), reason);
  }, "期限已重新計算");
}

// ── 範本 ──
export async function saveTemplateAction(type: TemplateType, input: { name: string; subject: string; body: string; changeNote?: string }) {
  return runAction(async () => {
    const t = await saveTemplateVersion(await requireAdminForAction(), type, input);
    return { version: t.version };
  }, "範本已儲存為新版本");
}
export async function activateTemplateAction(id: string) {
  return runAction(async () => activateTemplateVersion(await requireAdminForAction(), id), "已切換範本版本");
}

// ── 期限規則 ──
export async function previewRuleAction(taskType: TaskType, input: RuleInput) {
  return runAction(async () => previewRuleChange(await requireAdminForAction(), taskType, input));
}
export async function updateRuleAction(taskType: TaskType, input: RuleInput & { applyNow?: boolean; reason: string }) {
  return runAction(async () => updateRule(await requireAdminForAction(), taskType, input), "期限規則已更新");
}
