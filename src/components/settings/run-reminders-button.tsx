"use client";
import { Loader2, PlayCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { runRemindersNowAction } from "@/app/actions/settings";
import { useAction } from "@/components/common/use-action";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function RunRemindersButton({ testMode }: { testMode: boolean }) {
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
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4" checked={force} onChange={(e) => setForce(e.target.checked)} />
          今日為非工作天時仍執行
        </label>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button
            disabled={pending}
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
