import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logger, redact } from "@/lib/logger";

export interface AuditInput {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  changes?: Record<string, unknown> | null;
  ipAddress?: string | null;
}

/** 寫入操作紀錄（敏感欄位自動遮蔽）。紀錄失敗不影響主要操作。 */
export async function writeAudit(input: AuditInput, db: Prisma.TransactionClient | typeof prisma = prisma) {
  try {
    await db.auditLog.create({
      data: {
        actorId: input.actorId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        summary: input.summary.slice(0, 500),
        changes: input.changes ? (redact(input.changes) as Prisma.InputJsonValue) : undefined,
        ipAddress: input.ipAddress ?? null,
      },
    });
  } catch (err) {
    logger.error("寫入操作紀錄失敗", { err, action: input.action });
  }
}

/** 比較前後值，僅保留有變動之欄位 */
export function diffFields<T extends Record<string, unknown>>(before: T, after: Partial<T>): Record<string, { from: unknown; to: unknown }> {
  const out: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(after)) {
    const a = before[key];
    const b = after[key];
    const norm = (v: unknown) => (v instanceof Date ? v.toISOString() : v ?? null);
    if (JSON.stringify(norm(a)) !== JSON.stringify(norm(b))) out[key] = { from: norm(a), to: norm(b) };
  }
  return out;
}
