import type { Prisma, TaskStatus, TaskType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { addCalendarDays, dbDateToISOOrNull, isISODate, isoToDbDate, taipeiToday, type ISODate } from "@/lib/dates";
import { writeAudit } from "@/server/audit/audit";
import { assertTaskAccess, taskAccessWhere } from "@/server/auth/permissions";
import type { AuthUser } from "@/server/auth/types";
import { loadBusinessDayService } from "@/server/business-days/calendar-repository";
import { NotFoundError, ValidationError } from "@/server/errors";
import { TASK_CATEGORY, type TaskCategory } from "@/server/schedule/task-types";
import { syncCaseTasks } from "@/server/schedule/task-sync";
import { computeDueInfo, effectiveDueDate } from "./task-utils";

export const TASK_INCLUDE = {
  schoolCase: { select: { id: true, schoolName: true, projectCode: true, projectName: true, siteVisitUploadUrl: true, agencyEmail: true } },
  assignedUser: { select: { id: true, name: true } },
} satisfies Prisma.TaskInclude;

export type TaskWithRelations = Prisma.TaskGetPayload<{ include: typeof TASK_INCLUDE }>;

/** 期限（人工鎖定優先）落在區間內之條件 */
export function dueDateRangeWhere(from?: ISODate | null, to?: ISODate | null): Prisma.TaskWhereInput {
  const range: Prisma.DateTimeFilter = {};
  if (from) range.gte = isoToDbDate(from);
  if (to) range.lte = isoToDbDate(to);
  return {
    OR: [
      { overrideDueDate: range },
      { AND: [{ overrideDueDate: null }, { calculatedDueDate: range }] },
    ],
  };
}

export const OPEN_WHERE: Prisma.TaskWhereInput = { status: { in: ["NOT_STARTED", "IN_PROGRESS", "ON_HOLD"] } };

export interface TaskListQuery {
  q?: string;
  view?: "open" | "overdue" | "completed" | "all";
  status?: string;
  taskType?: string;
  category?: string;
  caseId?: string;
  projectName?: string;
  assignedUserId?: string;
  dueFrom?: string;
  dueTo?: string;
  sort?: "dueDate" | "schoolName" | "taskType" | "status" | "updatedAt";
  dir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export async function listTasks(user: AuthUser, query: TaskListQuery) {
  const today = taipeiToday();
  const filters: Prisma.TaskWhereInput[] = [taskAccessWhere(user)];
  const view = query.view ?? "open";
  if (view === "open") filters.push(OPEN_WHERE);
  if (view === "completed") filters.push({ status: "COMPLETED" });
  if (view === "overdue") filters.push(OPEN_WHERE, dueDateRangeWhere(null, addCalendarDays(today, -1)));
  if (query.status && ["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "ON_HOLD", "CANCELLED"].includes(query.status)) {
    filters.push({ status: query.status as TaskStatus });
  }
  if (query.taskType && query.taskType in TASK_CATEGORY) filters.push({ taskType: query.taskType as TaskType });
  if (query.category) {
    const types = (Object.keys(TASK_CATEGORY) as TaskType[]).filter((t) => TASK_CATEGORY[t] === (query.category as TaskCategory));
    if (types.length) filters.push({ taskType: { in: types } });
  }
  if (query.caseId) filters.push({ caseId: query.caseId });
  if (query.projectName) filters.push({ schoolCase: { projectName: query.projectName } });
  if (query.assignedUserId) filters.push({ assignedUserId: query.assignedUserId === "none" ? null : query.assignedUserId });
  if ((query.dueFrom && isISODate(query.dueFrom)) || (query.dueTo && isISODate(query.dueTo))) {
    filters.push(dueDateRangeWhere(isISODate(query.dueFrom ?? "") ? query.dueFrom : null, isISODate(query.dueTo ?? "") ? query.dueTo : null));
  }
  if (query.q) {
    const q = query.q.trim();
    filters.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { schoolCase: { schoolName: { contains: q, mode: "insensitive" } } },
        { schoolCase: { projectCode: { contains: q, mode: "insensitive" } } },
      ],
    });
  }

  const [bds, tasks] = await Promise.all([
    loadBusinessDayService(),
    prisma.task.findMany({ where: { AND: filters }, include: TASK_INCLUDE }),
  ]);
  const dir = query.dir === "desc" ? -1 : 1;
  const sort = query.sort ?? "dueDate";
  const rows = tasks.map((t) => ({ ...t, due: computeDueInfo(t, bds, today) }));
  rows.sort((a, b) => {
    let cmp = 0;
    if (sort === "dueDate") cmp = (a.due.dueDate ?? "9999").localeCompare(b.due.dueDate ?? "9999");
    else if (sort === "schoolName") cmp = a.schoolCase.schoolName.localeCompare(b.schoolCase.schoolName, "zh-Hant");
    else if (sort === "taskType") cmp = a.taskType.localeCompare(b.taskType);
    else if (sort === "status") cmp = a.status.localeCompare(b.status);
    else cmp = a.updatedAt.getTime() - b.updatedAt.getTime();
    return cmp * dir || (a.due.dueDate ?? "").localeCompare(b.due.dueDate ?? "");
  });
  const pageSize = Math.min(Math.max(query.pageSize ?? 20, 5), 200);
  const page = Math.max(query.page ?? 1, 1);
  return { total: rows.length, page, pageSize, items: rows.slice((page - 1) * pageSize, page * pageSize), today };
}

export async function getTask(user: AuthUser, taskId: string) {
  await assertTaskAccess(user, taskId, "view");
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { ...TASK_INCLUDE, histories: { orderBy: { createdAt: "desc" }, include: { changedBy: { select: { name: true } } } } },
  });
  if (!task) throw new NotFoundError("找不到此工作");
  const bds = await loadBusinessDayService();
  return { ...task, due: computeDueInfo(task, bds, taipeiToday()) };
}

/** 標記完成（每一項工作獨立完成；創稿完成不代表發文完成） */
export async function completeTask(user: AuthUser, taskId: string, completedAt: Date = new Date()) {
  await assertTaskAccess(user, taskId, "edit");
  const task = await prisma.task.update({
    where: { id: taskId },
    data: { status: "COMPLETED", actualCompletedAt: completedAt },
    include: { schoolCase: { select: { schoolName: true } } },
  });
  await writeAudit({ actorId: user.id, action: "TASK_COMPLETE", entityType: "Task", entityId: taskId, summary: `完成工作：${task.schoolCase.schoolName} ${task.title}` });
  return task;
}

export async function updateTaskStatus(user: AuthUser, taskId: string, status: TaskStatus) {
  await assertTaskAccess(user, taskId, "edit");
  const before = await prisma.task.findUniqueOrThrow({ where: { id: taskId } });
  const task = await prisma.task.update({
    where: { id: taskId },
    data: {
      status,
      actualCompletedAt: status === "COMPLETED" ? before.actualCompletedAt ?? new Date() : null,
    },
  });
  await writeAudit({ actorId: user.id, action: "TASK_STATUS", entityType: "Task", entityId: taskId, summary: `工作狀態：${before.status} → ${status}`, changes: { from: before.status, to: status } });
  if (before.status === "COMPLETED" && status !== "COMPLETED") {
    // 使用者手動重新開啟時，期限依最新規則重新計算
    await syncCaseTasks(task.caseId, { actorId: user.id, source: "MANUAL_RECALC", reason: "重新開啟工作" });
  }
  return task;
}

const overrideSchema = z.object({
  overrideDueDate: z.string().refine((v) => v === "" || isISODate(v), "日期格式錯誤"),
  overrideReason: z.string().trim().max(500).optional(),
});

/** 人工鎖定期限（需填寫原因）；清除鎖定後依規則重新計算 */
export async function setTaskOverride(user: AuthUser, taskId: string, input: { overrideDueDate: string; overrideReason?: string }) {
  await assertTaskAccess(user, taskId, "edit");
  const p = overrideSchema.parse(input);
  const before = await prisma.task.findUniqueOrThrow({ where: { id: taskId } });
  if (p.overrideDueDate && !p.overrideReason) throw new ValidationError("人工調整期限需填寫原因");
  const newOverride = p.overrideDueDate ? isoToDbDate(p.overrideDueDate) : null;
  await prisma.$transaction(async (tx) => {
    await tx.task.update({
      where: { id: taskId },
      data: { overrideDueDate: newOverride, overrideReason: p.overrideDueDate ? p.overrideReason : null },
    });
    await tx.taskDueDateHistory.create({
      data: {
        taskId,
        previousDate: before.overrideDueDate ?? before.calculatedDueDate,
        newDate: newOverride ?? before.calculatedDueDate,
        changeSource: "MANUAL_OVERRIDE",
        reason: p.overrideDueDate ? p.overrideReason : "解除人工鎖定，恢復系統計算期限",
        changedById: user.id,
      },
    });
    await writeAudit(
      {
        actorId: user.id,
        action: "TASK_OVERRIDE",
        entityType: "Task",
        entityId: taskId,
        summary: p.overrideDueDate ? `人工鎖定期限 ${p.overrideDueDate}：${p.overrideReason}` : "解除人工鎖定期限",
        changes: { from: dbDateToISOOrNull(before.overrideDueDate), to: p.overrideDueDate || null },
      },
      tx,
    );
  });
  // 依附於此工作之期限（例如發文前一日創稿）需重新計算
  await syncCaseTasks(before.caseId, { actorId: user.id, source: "MANUAL_RECALC", reason: "人工調整期限連動" });
}

const taskUpdateSchema = z.object({
  assignedUserId: z.string().nullable().optional(),
  reminderEnabled: z.boolean().optional(),
  description: z.string().max(2000).nullable().optional(),
});

export async function updateTaskMeta(user: AuthUser, taskId: string, input: z.input<typeof taskUpdateSchema>) {
  await assertTaskAccess(user, taskId, "edit");
  const p = taskUpdateSchema.parse(input);
  if (p.assignedUserId) {
    const u = await prisma.user.findUnique({ where: { id: p.assignedUserId } });
    if (!u?.isActive) throw new ValidationError("指派對象不存在或已停用");
  }
  const task = await prisma.task.update({ where: { id: taskId }, data: p });
  await writeAudit({ actorId: user.id, action: "TASK_UPDATE", entityType: "Task", entityId: taskId, summary: `更新工作設定：${task.title}`, changes: p });
  return task;
}

export { effectiveDueDate };
