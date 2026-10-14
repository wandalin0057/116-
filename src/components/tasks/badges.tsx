import { Lock } from "lucide-react";
import type { TaskStatus, TaskType } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { formatROCShort } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { TASK_CATEGORY, TASK_COLORS, TASK_STATUS_LABELS, TASK_TYPE_LABELS } from "@/server/schedule/task-types";

const STATUS_VARIANT: Record<TaskStatus, "muted" | "info" | "success" | "warning" | "outline"> = {
  NOT_STARTED: "outline",
  IN_PROGRESS: "info",
  COMPLETED: "success",
  ON_HOLD: "warning",
  CANCELLED: "muted",
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{TASK_STATUS_LABELS[status]}</Badge>;
}

export function TaskTypeBadge({ taskType }: { taskType: TaskType }) {
  const c = TASK_COLORS[TASK_CATEGORY[taskType]];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium", c.bg, c.text, c.border)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", c.dot)} />
      {TASK_TYPE_LABELS[taskType]}
    </span>
  );
}

export function DueDateText({
  dueDate,
  remaining,
  status,
  estimated,
  locked,
}: {
  dueDate: string | null;
  remaining: number | null;
  status: TaskStatus;
  estimated?: boolean;
  locked?: boolean;
}) {
  if (!dueDate) return <span className="text-muted-foreground">待排定</span>;
  const closed = status === "COMPLETED" || status === "CANCELLED";
  let tone = "text-slate-700";
  let label = "";
  if (!closed && remaining !== null) {
    if (remaining < 0) {
      tone = "text-red-700 font-semibold";
      label = `逾期 ${Math.abs(remaining)} 工作天`;
    } else if (remaining === 0) {
      tone = dueDate ? "text-amber-700 font-semibold" : tone;
      label = "今日到期";
    } else {
      tone = remaining <= 3 ? "text-blue-700 font-medium" : "text-slate-700";
      label = `剩 ${remaining} 工作天`;
    }
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5">
      <span className="tabular">{formatROCShort(dueDate)}</span>
      {locked && (
        <span title="已人工鎖定期限" className="inline-flex items-center text-slate-500">
          <Lock className="h-3 w-3" />
        </span>
      )}
      {estimated && !locked && (
        <Badge variant="warning" title="該年度尚未取得完整官方辦公日曆">
          暫估
        </Badge>
      )}
      {label && <span className={cn("text-xs", tone)}>{label}</span>}
    </span>
  );
}
