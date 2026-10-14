import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatROCShort } from "@/lib/dates";
import type { ScheduleChange } from "@/server/schedule/schedule-calculator";
import { TASK_TYPE_LABELS } from "@/server/schedule/task-types";

const ACTION_LABEL: Record<ScheduleChange["action"], { label: string; variant: "info" | "success" | "muted" | "warning" | "danger" | "outline" }> = {
  CREATE: { label: "新建工作", variant: "success" },
  UPDATE: { label: "更新期限", variant: "info" },
  UNCHANGED: { label: "無變動", variant: "muted" },
  SKIP_COMPLETED: { label: "已完成，保留紀錄", variant: "muted" },
  SKIP_LOCKED: { label: "人工鎖定，不變更", variant: "warning" },
  CLEAR: { label: "清除期限", variant: "danger" },
};

export function ScheduleDiffTable({ changes, showUnchanged = false }: { changes: ScheduleChange[]; showUnchanged?: boolean }) {
  const rows = changes.filter((c) => showUnchanged || c.action !== "UNCHANGED");
  if (!rows.length) return <p className="py-3 text-sm text-muted-foreground">各項工作期限無變動。</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-slate-50 text-left text-xs text-slate-600">
            <th className="px-2 py-1.5">工作</th>
            <th className="px-2 py-1.5">原期限</th>
            <th className="px-2 py-1.5" />
            <th className="px-2 py-1.5">新期限</th>
            <th className="px-2 py-1.5">處理方式</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.taskType} className="border-b last:border-0">
              <td className="px-2 py-1.5">{TASK_TYPE_LABELS[c.taskType]}</td>
              <td className="whitespace-nowrap px-2 py-1.5 tabular text-slate-500">{c.previousDate ? formatROCShort(c.previousDate) : "—"}</td>
              <td className="px-1">
                <ArrowRight className="h-3 w-3 text-slate-400" />
              </td>
              <td className="whitespace-nowrap px-2 py-1.5 tabular font-medium">
                {c.newDate ? formatROCShort(c.newDate) : "—"}
                {c.estimated && c.newDate && (
                  <Badge variant="warning" className="ml-1">
                    暫估
                  </Badge>
                )}
              </td>
              <td className="px-2 py-1.5">
                <Badge variant={ACTION_LABEL[c.action].variant}>{ACTION_LABEL[c.action].label}</Badge>
                {c.action === "SKIP_LOCKED" && c.overrideDueDate && <span className="ml-1 text-xs text-muted-foreground">（維持 {formatROCShort(c.overrideDueDate, false)}）</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
