"use client";
import { useCanComplete } from "@/components/layout/viewer-context";
import type { TaskStatus } from "@prisma/client";
import { Loader2, Settings2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { setTaskOverrideAction, updateTaskMetaAction, updateTaskStatusAction } from "@/app/actions/tasks";
import { useAction } from "@/components/common/use-action";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatROCShort } from "@/lib/dates";
import { TASK_STATUS_LABELS } from "@/server/schedule/task-types";

export function TaskEditDialog({
  task,
  users,
}: {
  task: {
    id: string;
    title: string;
    status: TaskStatus;
    calculatedDueDate: string | null;
    overrideDueDate: string | null;
    overrideReason: string | null;
    assignedUserId: string | null;
    reminderEnabled: boolean;
  };
  users: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const canComplete = useCanComplete();
  const [override, setOverride] = useState(task.overrideDueDate ?? "");
  const [reason, setReason] = useState(task.overrideReason ?? "");
  const [assignee, setAssignee] = useState(task.assignedUserId ?? "");
  const [reminder, setReminder] = useState(task.reminderEnabled);
  const { run, pending } = useAction();
  const router = useRouter();

  const save = async () => {
    if (status !== task.status) {
      const r = await run(() => updateTaskStatusAction(task.id, status), { refresh: false });
      if (!r.ok) return;
    }
    if (override !== (task.overrideDueDate ?? "") || (override && reason !== (task.overrideReason ?? ""))) {
      const r = await run(() => setTaskOverrideAction(task.id, { overrideDueDate: override, overrideReason: reason }), { refresh: false });
      if (!r.ok) return;
    }
    if (assignee !== (task.assignedUserId ?? "") || reminder !== task.reminderEnabled) {
      const r = await run(() => updateTaskMetaAction(task.id, { assignedUserId: assignee || null, reminderEnabled: reminder }), { refresh: false });
      if (!r.ok) return;
    }
    setOpen(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="xs" aria-label="調整工作">
          <Settings2 />
          調整
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>調整工作：{task.title}</DialogTitle>
          <DialogDescription>系統計算期限：{task.calculatedDueDate ? formatROCShort(task.calculatedDueDate) : "待排定"}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="t-status">狀態</Label>
            <Select id="t-status" value={status} disabled={!canComplete} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
              {Object.entries(TASK_STATUS_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </Select>
            {!canComplete && <p className="text-xs text-muted-foreground">工作狀態僅管理員可以變更。</p>}
            {task.status === "COMPLETED" && status !== "COMPLETED" && <p className="text-xs text-amber-700">重新開啟後，期限將依最新規則重新計算。</p>}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="t-override">人工鎖定期限</Label>
              <Input id="t-override" type="date" value={override} onChange={(e) => setOverride(e.target.value)} />
              <p className="text-xs text-muted-foreground">鎖定後不受日期變更影響；清空即恢復系統計算。</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-reason">鎖定原因{override && <span className="text-red-600">*</span>}</Label>
              <Input id="t-reason" value={reason} onChange={(e) => setReason(e.target.value)} disabled={!override} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-assignee">負責人</Label>
            <Select id="t-assignee" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              <option value="">未指派（由案件負責人接收提醒）</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4" checked={reminder} onChange={(e) => setReminder(e.target.checked)} />
            納入每日提醒
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button onClick={() => void save()} disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            儲存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
