"use client";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { ActionResult } from "@/lib/action-result";
import { useAction } from "./use-action";

interface Props extends Omit<ButtonProps, "onClick"> {
  action: () => Promise<ActionResult<unknown>>;
  confirm?: { title: string; description?: string; confirmLabel?: string; destructive?: boolean };
  onDone?: () => void;
}

/** 執行 Server Action 的按鈕；可選擇先顯示確認對話框 */
export function ActionButton({ action, confirm, onDone, children, disabled, ...props }: Props) {
  const { run, pending } = useAction();
  const [open, setOpen] = useState(false);
  const exec = () => run(action, { onSuccess: () => onDone?.() }).then(() => setOpen(false));
  return (
    <>
      <Button {...props} disabled={disabled || pending} onClick={() => (confirm ? setOpen(true) : exec())}>
        {pending && <Loader2 className="animate-spin" />}
        {children}
      </Button>
      {confirm && (
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogContent>
            <AlertDialogTitle>{confirm.title}</AlertDialogTitle>
            {confirm.description && <AlertDialogDescription>{confirm.description}</AlertDialogDescription>}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending}>取消</AlertDialogCancel>
              <Button variant={confirm.destructive ? "destructive" : "default"} disabled={pending} onClick={exec}>
                {pending && <Loader2 className="animate-spin" />}
                {confirm.confirmLabel ?? "確認"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
