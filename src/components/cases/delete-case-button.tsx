"use client";
import { Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteCaseAction } from "@/app/actions/cases";
import { useAction } from "@/components/common/use-action";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** 刪除學校案件（管理員）：含公文或 Email 草稿時需輸入案件編號確認 */
export function DeleteCaseButton({
  caseId,
  schoolName,
  projectCode,
  counts,
  redirectTo,
  size = "xs",
}: {
  caseId: string;
  schoolName: string;
  projectCode: string;
  counts: { tasks: number; documents: number; emails: number };
  redirectTo?: string;
  size?: "xs" | "sm" | "default";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const { run, pending } = useAction();
  const needCode = counts.documents > 0 || counts.emails > 0;
  const ok = !needCode || code.trim() === projectCode;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setCode("");
      }}
    >
      <DialogTrigger asChild>
        <Button variant={size === "default" ? "outline" : "ghost"} size={size} className="text-red-700 hover:bg-red-50 hover:text-red-800">
          <Trash2 />
          刪除
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>確定刪除「{schoolName}」？</DialogTitle>
          <DialogDescription>刪除後無法復原。以下資料會一併刪除：</DialogDescription>
        </DialogHeader>
        <ul className="list-inside list-disc space-y-1 text-sm">
          <li>案件資料、會議與會勘紀錄</li>
          <li>工作 {counts.tasks} 項（含期限異動紀錄）</li>
          <li className={counts.documents ? "font-medium text-red-700" : undefined}>公文 {counts.documents} 份</li>
          <li className={counts.emails ? "font-medium text-red-700" : undefined}>Email 草稿 {counts.emails} 份</li>
        </ul>
        <p className="text-xs text-muted-foreground">若只是不再執行，建議到「編輯案件」把狀態改為「已取消」，資料會保留。刪除紀錄會留在「操作紀錄」。</p>
        {needCode && (
          <div className="space-y-1.5">
            <Label htmlFor={`del-${caseId}`}>
              請輸入案件編號 <span className="font-mono font-semibold">{projectCode}</span> 以確認
            </Label>
            <Input id={`del-${caseId}`} value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" placeholder={projectCode} />
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            取消
          </Button>
          <Button
            variant="destructive"
            disabled={!ok || pending}
            onClick={() =>
              run(() => deleteCaseAction(caseId, code), {
                onSuccess: () => {
                  setOpen(false);
                  if (redirectTo) router.push(redirectTo);
                },
              })
            }
          >
            {pending && <Loader2 className="animate-spin" />}
            永久刪除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
