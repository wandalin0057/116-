"use client";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
      <h2 className="text-lg font-semibold">頁面發生錯誤</h2>
      <p className="text-sm text-muted-foreground">請稍後再試；若問題持續，請將錯誤代碼提供給管理員：{error.digest ?? "—"}</p>
      <Button onClick={reset}>重新載入</Button>
    </div>
  );
}
