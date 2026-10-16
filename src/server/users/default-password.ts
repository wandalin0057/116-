import { prisma } from "@/lib/db";
import { writeAudit } from "@/server/audit/audit";
import { hashPassword, validatePasswordStrength } from "@/server/auth/password";
import { assertAdmin } from "@/server/auth/permissions";
import { revokeUserSessions } from "@/server/auth/session";
import type { AuthUser } from "@/server/auth/types";
import { ValidationError } from "@/server/errors";

/**
 * 一般使用者初始密碼：由管理員於網站設定，只保存雜湊值（不寫入程式碼或紀錄）。
 * 新建立之一般使用者（含由學校案件自動建立之負責人帳號）預設使用此密碼，登入後提醒變更。
 */
const KEY = "defaultUserPassword";

export async function getDefaultPasswordHash(): Promise<string | null> {
  const row = await prisma.systemSetting.findUnique({ where: { key: KEY } });
  return (row?.value as { hash?: string } | null)?.hash ?? null;
}

export async function hasDefaultPassword(): Promise<boolean> {
  return !!(await getDefaultPasswordHash());
}

export async function setDefaultUserPassword(admin: AuthUser, password: string): Promise<void> {
  assertAdmin(admin);
  const err = validatePasswordStrength(password);
  if (err) throw new ValidationError(err);
  const value = { hash: await hashPassword(password), updatedAt: new Date().toISOString() };
  await prisma.systemSetting.upsert({ where: { key: KEY }, create: { key: KEY, value, updatedById: admin.id }, update: { value, updatedById: admin.id } });
  await writeAudit({ actorId: admin.id, action: "DEFAULT_PASSWORD_SET", entityType: "SystemSetting", entityId: KEY, summary: "設定一般使用者初始密碼" });
}

/** 將所有啟用中的一般使用者密碼重設為初始密碼（管理員不受影響），並使其重新登入 */
export async function applyDefaultPasswordToUsers(admin: AuthUser): Promise<number> {
  assertAdmin(admin);
  const hash = await getDefaultPasswordHash();
  if (!hash) throw new ValidationError("請先設定一般使用者初始密碼");
  const users = await prisma.user.findMany({ where: { role: "USER", isActive: true }, select: { id: true } });
  await prisma.user.updateMany({
    where: { id: { in: users.map((u) => u.id) } },
    data: { passwordHash: hash, mustChangePassword: true, passwordChangedAt: new Date(), failedLoginCount: 0, lockedUntil: null },
  });
  for (const u of users) await revokeUserSessions(u.id);
  await writeAudit({ actorId: admin.id, action: "DEFAULT_PASSWORD_APPLY", entityType: "User", summary: `將 ${users.length} 位一般使用者密碼重設為初始密碼` });
  return users.length;
}
