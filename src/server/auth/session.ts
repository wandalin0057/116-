import { prisma } from "@/lib/db";
import { hashSessionToken, randomToken } from "@/lib/crypto";
import type { AuthUser } from "./types";

export const SESSION_COOKIE = "szm_session";

function maxAgeMs() {
  const hours = Number(process.env.SESSION_MAX_AGE_HOURS ?? 12) || 12;
  return hours * 3600_000;
}

export async function createSession(userId: string, meta: { ipAddress?: string | null; userAgent?: string | null } = {}) {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + maxAgeMs());
  await prisma.session.create({
    data: {
      tokenHash: hashSessionToken(token),
      userId,
      expiresAt,
      ipAddress: meta.ipAddress?.slice(0, 64) ?? null,
      userAgent: meta.userAgent?.slice(0, 256) ?? null,
    },
  });
  return { token, expiresAt };
}

/** 驗證工作階段；過期、使用者停用則失效。剩餘時間不足一半時自動延長（滑動到期）。 */
export async function validateSessionToken(token: string | undefined | null): Promise<{ user: AuthUser; sessionId: string; expiresAt: Date } | null> {
  if (!token || token.length > 200) return null;
  const session = await prisma.session.findUnique({ where: { tokenHash: hashSessionToken(token) }, include: { user: true } });
  if (!session) return null;
  const now = Date.now();
  if (session.expiresAt.getTime() <= now || !session.user.isActive) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  let expiresAt = session.expiresAt;
  if (session.expiresAt.getTime() - now < maxAgeMs() / 2) {
    expiresAt = new Date(now + maxAgeMs());
    await prisma.session.update({ where: { id: session.id }, data: { expiresAt, lastSeenAt: new Date() } });
  }
  const { user } = session;
  return { user: { id: user.id, email: user.email, name: user.name, role: user.role }, sessionId: session.id, expiresAt };
}

export async function revokeSessionToken(token: string) {
  await prisma.session.deleteMany({ where: { tokenHash: hashSessionToken(token) } });
}

export async function revokeUserSessions(userId: string) {
  await prisma.session.deleteMany({ where: { userId } });
}

export async function purgeExpiredSessions() {
  await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}
