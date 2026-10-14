import { prisma } from "@/lib/db";
import { writeAudit } from "@/server/audit/audit";
import { verifyPassword } from "./password";
import { createSession } from "./session";

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

export type LoginResult =
  | { ok: true; token: string; expiresAt: Date; userId: string }
  | { ok: false; message: string };

export async function authenticate(
  emailRaw: string,
  password: string,
  meta: { ipAddress?: string | null; userAgent?: string | null } = {},
): Promise<LoginResult> {
  const email = emailRaw.trim().toLowerCase();
  const generic = "帳號或密碼錯誤";
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    await verifyPassword(password, null);
    return { ok: false, message: generic };
  }
  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    return { ok: false, message: `登入失敗次數過多，帳號暫時鎖定至 ${user.lockedUntil.toLocaleTimeString("zh-TW", { timeZone: "Asia/Taipei", hour: "2-digit", minute: "2-digit" })}` };
  }
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid || !user.isActive) {
    const failed = user.failedLoginCount + 1;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: failed >= MAX_FAILED ? 0 : failed,
        lockedUntil: failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
      },
    });
    await writeAudit({ actorId: user.id, action: "LOGIN_FAILED", entityType: "User", entityId: user.id, summary: "登入失敗", ipAddress: meta.ipAddress });
    return { ok: false, message: !user.isActive && valid ? "此帳號已停用，請聯絡管理員" : generic };
  }
  await prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() } });
  const { token, expiresAt } = await createSession(user.id, meta);
  await writeAudit({ actorId: user.id, action: "LOGIN", entityType: "User", entityId: user.id, summary: "登入系統", ipAddress: meta.ipAddress });
  return { ok: true, token, expiresAt, userId: user.id };
}
