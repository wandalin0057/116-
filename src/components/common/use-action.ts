"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/action-result";

/** 執行 Server Action 並顯示成功／失敗提示 */
export function useAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const run = <T,>(fn: () => Promise<ActionResult<T>>, opts: { onSuccess?: (data: T | undefined) => void; refresh?: boolean; successMessage?: string } = {}) =>
    new Promise<ActionResult<T>>((resolve) => {
      startTransition(async () => {
        try {
          const res = await fn();
          if (res.ok) {
            const msg = opts.successMessage ?? res.message;
            if (msg) toast.success(msg);
            opts.onSuccess?.(res.data);
            if (opts.refresh !== false) router.refresh();
          } else {
            toast.error(res.message);
          }
          resolve(res);
        } catch {
          toast.error("連線失敗，請稍後再試");
          resolve({ ok: false, message: "連線失敗" });
        }
      });
    });
  return { run, pending };
}
