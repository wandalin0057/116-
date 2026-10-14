"use server";
import type { TaskStatus } from "@prisma/client";
import { requireUserForAction } from "@/lib/auth";
import { runAction } from "@/lib/action-result";
import { completeTask, setTaskOverride, updateTaskMeta, updateTaskStatus } from "@/server/tasks/task-service";

export async function completeTaskAction(taskId: string) {
  return runAction(async () => {
    await completeTask(await requireUserForAction(), taskId);
  }, "已標記完成");
}

export async function updateTaskStatusAction(taskId: string, status: TaskStatus) {
  return runAction(async () => {
    await updateTaskStatus(await requireUserForAction(), taskId, status);
  }, "工作狀態已更新");
}

export async function setTaskOverrideAction(taskId: string, input: { overrideDueDate: string; overrideReason?: string }) {
  return runAction(async () => setTaskOverride(await requireUserForAction(), taskId, input), input.overrideDueDate ? "已人工鎖定期限" : "已恢復系統計算期限");
}

export async function updateTaskMetaAction(taskId: string, input: { assignedUserId?: string | null; reminderEnabled?: boolean; description?: string | null }) {
  return runAction(async () => {
    await updateTaskMeta(await requireUserForAction(), taskId, input);
  }, "工作設定已更新");
}
