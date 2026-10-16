import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ForbiddenError, NotFoundError } from "@/server/errors";
import { isAdmin, type AuthUser } from "./types";
import { ADMIN_ONLY_TASKS } from "@/server/schedule/task-types";

/**
 * 伺服器端權限判斷。
 * 管理員：可存取所有案件。
 * 一般使用者：僅可存取自己負責或被授權（CaseMember）之案件；VIEWER 僅可檢視。
 */
export function caseAccessWhere(user: AuthUser): Prisma.SchoolCaseWhereInput {
  if (isAdmin(user)) return {};
  return { OR: [{ responsibleUserId: user.id }, { members: { some: { userId: user.id } } }] };
}

export function caseEditWhere(user: AuthUser): Prisma.SchoolCaseWhereInput {
  if (isAdmin(user)) return {};
  return { OR: [{ responsibleUserId: user.id }, { members: { some: { userId: user.id, role: "EDITOR" } } }] };
}

export function taskAccessWhere(user: AuthUser): Prisma.TaskWhereInput {
  return isAdmin(user) ? {} : { schoolCase: caseAccessWhere(user), taskType: { notIn: ADMIN_ONLY_TASKS } };
}

export type AccessLevel = "view" | "edit";

export async function assertCaseAccess(user: AuthUser, caseId: string, level: AccessLevel = "view") {
  const found = await prisma.schoolCase.findFirst({
    where: { AND: [{ id: caseId }, level === "edit" ? caseEditWhere(user) : caseAccessWhere(user)] },
    select: { id: true },
  });
  if (found) return;
  // 區分「不存在」與「無權限」，但不洩漏資料內容
  const exists = await prisma.schoolCase.count({ where: { id: caseId } });
  if (!exists) throw new NotFoundError("找不到此案件");
  throw new ForbiddenError(level === "edit" ? "您沒有編輯此案件的權限" : "您沒有檢視此案件的權限");
}

export async function canAccessCase(user: AuthUser, caseId: string, level: AccessLevel = "view") {
  try {
    await assertCaseAccess(user, caseId, level);
    return true;
  } catch {
    return false;
  }
}

export async function assertTaskAccess(user: AuthUser, taskId: string, level: AccessLevel = "view") {
  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { caseId: true, taskType: true } });
  if (!task || (!isAdmin(user) && ADMIN_ONLY_TASKS.includes(task.taskType))) throw new NotFoundError("找不到此工作");
  await assertCaseAccess(user, task.caseId, level);
  return task;
}

export function assertAdmin(user: AuthUser) {
  if (!isAdmin(user)) throw new ForbiddenError("此功能僅限管理員使用");
}

/** 標記完成與變更工作狀態僅限管理員（專案經理），其他人只能檢視進度 */
export function assertCanComplete(user: AuthUser): void {
  if (user.role !== "ADMIN") throw new ForbiddenError("只有管理員可以標記完成或變更工作狀態");
}
