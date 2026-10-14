import { AppError, ValidationError } from "@/server/errors";
import { logger } from "@/lib/logger";

export type ActionResult<T = unknown> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; message: string; fieldErrors?: Record<string, string[] | undefined> };

/** Server Action 統一錯誤處理：業務錯誤回傳訊息，非預期錯誤記錄日誌並回傳一般訊息 */
export async function runAction<T>(fn: () => Promise<T>, successMessage?: string): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, message: successMessage, data };
  } catch (err) {
    if (err instanceof ValidationError) return { ok: false, message: err.message, fieldErrors: err.fieldErrors };
    if (err instanceof AppError) return { ok: false, message: err.message };
    // next/navigation 的 redirect/notFound 需往外拋出
    if (err && typeof err === "object" && "digest" in err && String((err as { digest: unknown }).digest).startsWith("NEXT_")) throw err;
    logger.error("Server Action 發生錯誤", { err });
    return { ok: false, message: "系統發生錯誤，請稍後再試" };
  }
}
