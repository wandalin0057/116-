"use client";
import { Loader2, PlayCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { runRemindersNowAction } from "@/app/actions/settings";
import { useAction } from "@/components/common/use-action";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function RunRemindersButton({ testMode, canSend, actionsUrl }: { testMode: boolean; canSend: boolean; actionsUrl: string | null }) {
  const [open, setOpen] = useState(false);
  const [force, setForce] = useState(false);
  const { run, pending } = useAction();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <PlayCircle />
          立即執行每日提醒
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>立即執行每日提醒？</DialogTitle>
          <DialogDescription>
            今日已成功寄出之提醒不會重複寄送；失敗者將重新嘗試。
            {testMode ? "目前為測試模式，所有提醒將寄至測試收件人。" : "目前為正式模式，提醒將寄給各使用者。"}
          </DialogDescription>
        </DialogHeader>
        {!canSend && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-medium">網站本身無法寄信（Render 免費方案封鎖寄信），每日提醒由 GitHub 排程以 Gmail 寄出。</p>
            <p className="mt-1">要立即寄送：到 GitHub 儲存庫 → Actions →「每日提醒」→ 右側「Run workflow」→ 綠色「Run workflow」。</p>
            {actionsUrl && (
              <a href={actionsUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block font-medium text-blue-700 underline">
                開啟 GitHub「每日提醒」頁面
              </a>
            )}
          </div>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4" checked={force} onChange={(e) => setForce(e.target.checked)} />
          今日為非工作天時仍執行
        </label>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button
            disabled={pending || !canSend}
            onClick={() =>
              run(() => runRemindersNowAction(force), {
                onSuccess: (s) => {
                  setOpen(false);
                  if (s) toast[s.status === "FAILED" ? "error" : "success"](`執行結果：${s.message}`);
                },
              })
            }
          >
            {pending && <Loader2 className="animate-spin" />}
            執行
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
