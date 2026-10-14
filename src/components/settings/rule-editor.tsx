"use client";
import type { TaskType } from "@prisma/client";
import { Eye, Loader2, Pencil } from "lucide-react";
import { useState } from "react";
import { previewRuleAction, updateRuleAction } from "@/app/actions/settings";
import { useAction } from "@/components/common/use-action";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ScheduleChange } from "@/server/schedule/schedule-calculator";
import { CaseDiffList } from "./calendar-admin";

export function RuleEditDialog({ rule, anchorLabel }: { rule: { taskType: TaskType; title: string; description: string; offsetBusinessDays: number; enabled: boolean }; anchorLabel: string }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ title: rule.title, description: rule.description, offsetBusinessDays: rule.offsetBusinessDays, enabled: rule.enabled });
  const [reason, setReason] = useState("");
  const [applyNow, setApplyNow] = useState(true);
  const [preview, setPreview] = useState<{ caseId: string; schoolName: string; projectCode: string; changes: ScheduleChange[] }[] | null>(null);
  const { run, pending } = useAction();
  const fixed = rule.taskType === "REVIEW_MEETING" || rule.taskType === "SITE_VISIT";
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setPreview(null); }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="xs">
          <Pencil />
          修改
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>修改期限規則</DialogTitle>
          <DialogDescription>基準：{anchorLabel}（D0）。負數為事件前、正數為事件後之第 N 個工作天。</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="r-title">工作名稱</Label>
            <Input id="r-title" value={v.title} onChange={(e) => setV((s) => ({ ...s, title: e.target.value }))} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="r-desc">說明</Label>
            <Input id="r-desc" value={v.description} onChange={(e) => setV((s) => ({ ...s, description: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="r-offset">工作天位移</Label>
            <Input id="r-offset" type="number" value={v.offsetBusinessDays} disabled={fixed} onChange={(e) => setV((s) => ({ ...s, offsetBusinessDays: Number(e.target.value) }))} />
          </div>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input type="checkbox" className="h-4 w-4" checked={v.enabled} onChange={(e) => setV((s) => ({ ...s, enabled: e.target.checked }))} />
            啟用此規則（停用後新案件不再產生此工作）
          </label>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="r-reason">修改原因（必填）</Label>
            <Input id="r-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" className="h-4 w-4" checked={applyNow} onChange={(e) => setApplyNow(e.target.checked)} />
            儲存後立即重新計算所有進行中案件（已完成與人工鎖定之工作不變更）
          </label>
        </div>
        {preview && (
          <div className="max-h-72 overflow-y-auto rounded-md border bg-slate-50 p-2">
            <CaseDiffList diffs={preview} />
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={() => run(() => previewRuleAction(rule.taskType, v), { refresh: false, onSuccess: (d) => d && setPreview(d) })}>
            <Eye />
            預覽差異
          </Button>
          <Button disabled={pending || !reason.trim()} onClick={() => run(() => updateRuleAction(rule.taskType, { ...v, reason, applyNow }), { onSuccess: () => setOpen(false) })}>
            {pending && <Loader2 className="animate-spin" />}
            儲存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
