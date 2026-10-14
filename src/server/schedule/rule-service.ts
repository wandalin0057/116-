import type { TaskType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/server/audit/audit";
import { assertAdmin } from "@/server/auth/permissions";
import type { AuthUser } from "@/server/auth/types";
import { ValidationError } from "@/server/errors";
import { applyRecalculation } from "@/server/business-days/calendar-admin-service";
import { computeAllScheduleChanges, loadDeadlineRules } from "./task-sync";
import type { DeadlineRuleDef } from "./deadline-rules";

const ruleSchema = z.object({
  title: z.string().trim().min(1, "請輸入工作名稱").max(100),
  description: z.string().trim().max(500).optional(),
  offsetBusinessDays: z.coerce.number().int("工作天數需為整數").min(-60, "最多前 60 個工作天").max(120, "最多後 120 個工作天"),
  enabled: z.boolean(),
});

export type RuleInput = z.input<typeof ruleSchema>;

function mergeRule(rules: DeadlineRuleDef[], taskType: TaskType, input: RuleInput): DeadlineRuleDef[] {
  const p = ruleSchema.safeParse(input);
  if (!p.success) throw new ValidationError(p.error.issues[0]?.message ?? "資料格式錯誤");
  const anchorIsEvent = rules.find((r) => r.taskType === taskType);
  if (!anchorIsEvent) throw new ValidationError("找不到此期限規則");
  if ((taskType === "REVIEW_MEETING" || taskType === "SITE_VISIT") && p.data.offsetBusinessDays !== 0) {
    throw new ValidationError("會議／會勘當日工作之位移必須為 0");
  }
  return rules.map((r) => (r.taskType === taskType ? { ...r, ...p.data, description: p.data.description ?? "" } : r));
}

export async function previewRuleChange(user: AuthUser, taskType: TaskType, input: RuleInput) {
  assertAdmin(user);
  const rules = mergeRule(await loadDeadlineRules(), taskType, input);
  const all = await computeAllScheduleChanges({ rules });
  return all.map((d) => ({ ...d, changes: d.changes.filter((c) => c.action === "UPDATE" || c.action === "CREATE" || c.action === "CLEAR") })).filter((d) => d.changes.length);
}

export async function updateRule(user: AuthUser, taskType: TaskType, input: RuleInput & { applyNow?: boolean; reason: string }) {
  assertAdmin(user);
  if (!input.reason?.trim()) throw new ValidationError("請填寫修改原因");
  const current = await loadDeadlineRules();
  const merged = mergeRule(current, taskType, input).find((r) => r.taskType === taskType)!;
  const before = current.find((r) => r.taskType === taskType)!;
  await prisma.deadlineRule.upsert({
    where: { taskType },
    create: { ...merged, updatedById: user.id },
    update: { title: merged.title, description: merged.description, offsetBusinessDays: merged.offsetBusinessDays, enabled: merged.enabled, updatedById: user.id },
  });
  await writeAudit({
    actorId: user.id,
    action: "DEADLINE_RULE_UPDATE",
    entityType: "DeadlineRule",
    entityId: taskType,
    summary: `修改期限規則「${merged.title}」：${before.offsetBusinessDays} → ${merged.offsetBusinessDays} 工作天，原因：${input.reason}`,
    changes: { before, after: merged },
  });
  if (input.applyNow) return applyRecalculation(user, `期限規則修改：${input.reason}`, "RULE_CHANGE");
  return null;
}
