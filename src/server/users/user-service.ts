import type { UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/server/audit/audit";
import { hashPassword, validatePasswordStrength, verifyPassword } from "@/server/auth/password";
import { assertAdmin } from "@/server/auth/permissions";
import { revokeUserSessions } from "@/server/auth/session";
import type { AuthUser } from "@/server/auth/types";
import { NotFoundError, ValidationError } from "@/server/errors";

export const USER_PUBLIC_SELECT = { id: true, email: true, name: true, role: true, isActive: true, lastLoginAt: true, createdAt: true } as const;

export async function listUsers(opts: { includeInactive?: boolean } = {}) {
  return prisma.user.findMany({
    where: opts.includeInactive ? {} : { isActive: true },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: USER_PUBLIC_SELECT,
  });
}

const createSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email 格式錯誤"),
  name: z.string().trim().min(1, "請輸入姓名").max(50),
  role: z.enum(["ADMIN", "USER"]),
  password: z.string(),
});

export async function createUser(actor: AuthUser | null, input: z.input<typeof createSchema>) {
  if (actor) assertAdmin(actor);
  const p = createSchema.safeParse(input);
  if (!p.success) throw new ValidationError(p.error.issues[0]?.message ?? "資料格式錯誤");
  const pwErr = validatePasswordStrength(p.data.password);
  if (pwErr) throw new ValidationError(pwErr);
  if (await prisma.user.findUnique({ where: { email: p.data.email } })) throw new ValidationError("此 Email 已有帳號");
  const user = await prisma.user.create({
    data: {
      email: p.data.email,
      name: p.data.name,
      role: p.data.role as UserRole,
      passwordHash: await hashPassword(p.data.password),
      passwordChangedAt: new Date(),
      reminderPreference: { create: {} },
    },
    select: USER_PUBLIC_SELECT,
  });
  await writeAudit({ actorId: actor?.id ?? null, action: "USER_CREATE", entityType: "User", entityId: user.id, summary: `新增使用者 ${user.name}（${user.role === "ADMIN" ? "管理員" : "一般使用者"}）` });
  return user;
}

const updateSchema = z.object({
  name: z.string().trim().min(1).max(50),
  role: z.enum(["ADMIN", "USER"]),
  isActive: z.boolean(),
});

export async function updateUser(actor: AuthUser, userId: string, input: z.input<typeof updateSchema>) {
  assertAdmin(actor);
  const p = updateSchema.safeParse(input);
  if (!p.success) throw new ValidationError(p.error.issues[0]?.message ?? "資料格式錯誤");
  const before = await prisma.user.findUnique({ where: { id: userId } });
  if (!before) throw new NotFoundError("找不到使用者");
  if (actor.id === userId && (!p.data.isActive || p.data.role !== "ADMIN")) throw new ValidationError("不可停用自己或移除自己的管理員權限");
  if (before.role === "ADMIN" && (p.data.role !== "ADMIN" || !p.data.isActive)) {
    const admins = await prisma.user.count({ where: { role: "ADMIN", isActive: true } });
    if (admins <= 1) throw new ValidationError("系統至少需保留一位啟用中的管理員");
  }
  const user = await prisma.user.update({ where: { id: userId }, data: p.data, select: USER_PUBLIC_SELECT });
  if (!p.data.isActive) await revokeUserSessions(userId);
  await writeAudit({
    actorId: actor.id,
    action: !p.data.isActive && before.isActive ? "USER_DEACTIVATE" : "USER_UPDATE",
    entityType: "User",
    entityId: userId,
    summary: `${!p.data.isActive && before.isActive ? "停用" : "更新"}使用者 ${user.name}`,
    changes: { role: { from: before.role, to: p.data.role }, isActive: { from: before.isActive, to: p.data.isActive } },
  });
  return user;
}

export async function resetUserPassword(actor: AuthUser, userId: string, newPassword: string) {
  assertAdmin(actor);
  const err = validatePasswordStrength(newPassword);
  if (err) throw new ValidationError(err);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(newPassword), passwordChangedAt: new Date(), failedLoginCount: 0, lockedUntil: null } });
  await revokeUserSessions(userId);
  await writeAudit({ actorId: actor.id, action: "USER_PASSWORD_RESET", entityType: "User", entityId: userId, summary: "管理員重設使用者密碼" });
}

export async function changeOwnPassword(user: AuthUser, current: string, next: string) {
  const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await verifyPassword(current, row.passwordHash))) throw new ValidationError("目前密碼不正確");
  const err = validatePasswordStrength(next);
  if (err) throw new ValidationError(err);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next), passwordChangedAt: new Date() } });
  await writeAudit({ actorId: user.id, action: "USER_PASSWORD_CHANGE", entityType: "User", entityId: user.id, summary: "使用者變更密碼" });
}

const prefSchema = z.object({
  emailEnabled: z.boolean(),
  leadBusinessDays: z.coerce.number().int().min(0, "不可小於 0").max(20, "最多 20 個工作天"),
  overdueEnabled: z.boolean(),
  dailyDigestEnabled: z.boolean(),
});

export async function getReminderPreference(userId: string) {
  return (
    (await prisma.reminderPreference.findUnique({ where: { userId } })) ?? {
      emailEnabled: true,
      leadBusinessDays: 3,
      overdueEnabled: true,
      dailyDigestEnabled: true,
    }
  );
}

export async function updateReminderPreference(user: AuthUser, input: z.input<typeof prefSchema>) {
  const p = prefSchema.safeParse(input);
  if (!p.success) throw new ValidationError(p.error.issues[0]?.message ?? "資料格式錯誤");
  await prisma.reminderPreference.upsert({ where: { userId: user.id }, create: { userId: user.id, ...p.data }, update: p.data });
  await writeAudit({ actorId: user.id, action: "REMINDER_PREF_UPDATE", entityType: "ReminderPreference", entityId: user.id, summary: "更新個人通知設定", changes: p.data });
}
