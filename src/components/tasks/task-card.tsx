import type { TaskStatus, TaskType } from "@prisma/client";
import { User } from "lucide-react";
import { cn } from "@/lib/utils";
import { DueDateText, TaskStatusBadge, TaskTypeBadge } from "./badges";
import { TaskActions } from "./task-actions";

export interface TaskCardData {
  id: string;
  caseId: string;
  title: string;
  taskType: TaskType;
  status: TaskStatus;
  schoolName: string;
  assignedName: string | null;
  dueDate: string | null;
  remaining: number | null;
  isOverdue: boolean;
  estimated: boolean;
  locked: boolean;
  uploadUrl?: string | null;
}

export function TaskCard({ task }: { task: TaskCardData }) {
  return (
    <div className={cn("rounded-md border bg-white p-3", task.isOverdue && "border-red-200 bg-red-50/40")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-900">{task.schoolName}</p>
          <p className="text-sm text-slate-600">{task.title}</p>
        </div>
        <TaskStatusBadge status={task.status} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <TaskTypeBadge taskType={task.taskType} />
        <DueDateText dueDate={task.dueDate} remaining={task.remaining} status={task.status} estimated={task.estimated} locked={task.locked} />
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <User className="h-3 w-3" />
          {task.assignedName ?? "未指派"}
        </span>
      </div>
      <div className="mt-2">
        <TaskActions taskId={task.id} caseId={task.caseId} taskType={task.taskType} status={task.status} title={task.title} uploadUrl={task.uploadUrl} compact />
      </div>
    </div>
  );
}

/** 將服務層工作資料轉為卡片資料 */
export function toTaskCard(t: {
  id: string;
  caseId: string;
  title: string;
  taskType: TaskType;
  status: TaskStatus;
  dueDateEstimated: boolean;
  schoolCase: { schoolName: string; siteVisitUploadUrl?: string | null };
  assignedUser: { name: string } | null;
  due: { dueDate: string | null; remainingBusinessDays: number | null; isOverdue: boolean; isLocked: boolean };
}): TaskCardData {
  return {
    id: t.id,
    caseId: t.caseId,
    title: t.title,
    taskType: t.taskType,
    status: t.status,
    schoolName: t.schoolCase.schoolName,
    assignedName: t.assignedUser?.name ?? null,
    dueDate: t.due.dueDate,
    remaining: t.due.remainingBusinessDays,
    isOverdue: t.due.isOverdue,
    estimated: t.dueDateEstimated,
    locked: t.due.isLocked,
    uploadUrl: t.schoolCase.siteVisitUploadUrl,
  };
}
