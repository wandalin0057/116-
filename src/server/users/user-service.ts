import type { UserRole } from "@prisma/client";
import { z } from "zod";
import { signatureHtml as legacySignatureHtml, normalizeSignatureStyle, signatureStyleSchema } from "@/lib/signature";
import { SIGNATURE_HTML_MAX_CHARS, sanitizeSignatureHtml, signatureHtmlToText } from "@/server/signature/sanitize";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/server/audit/audit";
import { hashPassword, validatePasswordStrength, verifyPassword } from "@/server/auth/password";
import { assertAdmin } from "@/server/auth/permissions";
import { revokeUserSessions } from "@/server/auth/session";
import type { AuthUser } from "@/server/auth/types";
import { NotFoundError, ValidationError } from "@/server/errors";
import { getDefaultPasswordHash } from "./default-password";

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
  /** 一般使用者可留空：改用管理員設定之初始密碼 */
  password: z.string().optional(),
});

export async function createUser(actor: AuthUser | null, input: z.input<typeof createSchema>) {
  if (actor) assertAdmin(actor);
  const p = createSchema.safeParse(input);
  if (!p.success) throw new ValidationError(p.error.issues[0]?.message ?? "資料格式錯誤");
  const defaultHash = !p.data.password && p.data.role === "USER" ? await getDefaultPasswordHash() : null;
  if (!defaultHash) {
    if (!p.data.password) throw new ValidationError(p.data.role === "USER" ? "請輸入密碼，或先設定一般使用者初始密碼" : "管理員帳號請設定密碼");
    const pwErr = validatePasswordStrength(p.data.password);
    if (pwErr) throw new ValidationError(pwErr);
  }
  if (await prisma.user.findUnique({ where: { email: p.data.email } })) throw new ValidationError("此 Email 已有帳號");
  const user = await prisma.user.create({
    data: {
      email: p.data.email,
      name: p.data.name,
      role: p.data.role as UserRole,
      passwordHash: defaultHash ?? (await hashPassword(p.data.password!)),
      mustChangePassword: !!defaultHash,
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
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(newPassword), mustChangePassword: false, passwordChangedAt: new Date(), failedLoginCount: 0, lockedUntil: null } });
  await revokeUserSessions(userId);
  await writeAudit({ actorId: actor.id, action: "USER_PASSWORD_RESET", entityType: "User", entityId: userId, summary: "管理員重設使用者密碼" });
}

export async function changeOwnPassword(user: AuthUser, current: string, next: string) {
  const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await verifyPassword(current, row.passwordHash))) throw new ValidationError("目前密碼不正確");
  const err = validatePasswordStrength(next);
  if (err) throw new ValidationError(err);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next), mustChangePassword: false, passwordChangedAt: new Date() } });
  await writeAudit({ actorId: user.id, action: "USER_PASSWORD_CHANGE", entityType: "User", entityId: user.id, summary: "使用者變更密碼" });
}

const prefSchema = z.object({
  emailEnabled: z.boolean(),
  leadBusinessDays: z.coerce.number().int().min(0, "不可小於 0").max(20, "最多 20 個工作天"),
  overdueEnabled: z.boolean(),
  dailyDigestEnabled: z.boolean(),
  managerDigestEnabled: z.boolean().optional(),
});

export async function getReminderPreference(userId: string) {
  return (
    (await prisma.reminderPreference.findUnique({ where: { userId } })) ?? {
      emailEnabled: true,
      leadBusinessDays: 3,
      overdueEnabled: true,
      dailyDigestEnabled: true,
      managerDigestEnabled: false,
    }
  );
}

export async function updateReminderPreference(user: AuthUser, input: z.input<typeof prefSchema>) {
  const p = prefSchema.safeParse(input);
  if (!p.success) throw new ValidationError(p.error.issues[0]?.message ?? "資料格式錯誤");
  // 全部學校總表僅限管理員
  const data = { ...p.data, managerDigestEnabled: user.role === "ADMIN" ? p.data.managerDigestEnabled ?? false : false };
  await prisma.reminderPreference.upsert({ where: { userId: user.id }, create: { userId: user.id, ...data }, update: data });
  await writeAudit({ actorId: user.id, action: "REMINDER_PREF_UPDATE", entityType: "ReminderPreference", entityId: user.id, summary: "更新個人通知設定", changes: p.data });
}

export async function updateEmailSignature(user: AuthUser, signature: string) {
  const value = signature.replace(/\r\n/g, "\n").trim();
  if (value.length > 1000) throw new ValidationError("簽名檔不可超過 1000 字");
  await prisma.user.update({ where: { id: user.id }, data: { emailSignature: value || null } });
  await writeAudit({ actorId: user.id, action: "USER_SIGNATURE_UPDATE", entityType: "User", entityId: user.id, summary: "更新 Email 簽名檔" });
}

const SIGNATURE_IMAGE_RE = /^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/;
/** 簽名圖片上限（data URL 字元數，約 300KB 圖檔） */
export const SIGNATURE_IMAGE_MAX_CHARS = 400_000;

/** 設定或移除 Email 簽名圖片（null 表示移除） */
export async function updateSignatureImage(user: AuthUser, dataUrl: string | null) {
  if (dataUrl !== null) {
    if (!SIGNATURE_IMAGE_RE.test(dataUrl)) throw new ValidationError("圖片格式不支援，請使用 PNG、JPG、GIF 或 WebP");
    if (dataUrl.length > SIGNATURE_IMAGE_MAX_CHARS) throw new ValidationError("圖片太大，請使用較小的圖片（約 300KB 以內）");
  }
  await prisma.user.update({ where: { id: user.id }, data: { signatureImage: dataUrl } });
  await writeAudit({ actorId: user.id, action: "USER_SIGNATURE_IMAGE", entityType: "User", entityId: user.id, summary: dataUrl ? "設定 Email 簽名圖片" : "移除 Email 簽名圖片" });
}

/** 一次儲存簽名檔文字、圖片與樣式 */
export async function saveSignature(user: AuthUser, input: { text: string; image: string | null; style: unknown }) {
  const text = input.text.replace(/\r\n/g, "\n").trim();
  if (text.length > 1000) throw new ValidationError("簽名檔不可超過 1000 字");
  if (input.image !== null) {
    if (!SIGNATURE_IMAGE_RE.test(input.image)) throw new ValidationError("圖片格式不支援，請使用 PNG、JPG、GIF 或 WebP");
    if (input.image.length > SIGNATURE_IMAGE_MAX_CHARS) throw new ValidationError("圖片太大，請使用較小的圖片（約 300KB 以內）");
  }
  const style = signatureStyleSchema.safeParse(input.style);
  if (!style.success) throw new ValidationError(style.error.issues[0]?.message ?? "簽名檔樣式設定錯誤");
  await prisma.user.update({
    where: { id: user.id },
    data: { emailSignature: text || null, signatureImage: input.image, signatureStyle: style.data },
  });
  await writeAudit({ actorId: user.id, action: "USER_SIGNATURE_UPDATE", entityType: "User", entityId: user.id, summary: "更新 Email 簽名檔（文字、圖片、樣式）" });
}

/** 儲存格式化簽名檔（HTML 經白名單過濾；同時保存純文字版本） */
export async function saveSignatureHtml(user: AuthUser, rawHtml: string) {
  if (rawHtml.length > SIGNATURE_HTML_MAX_CHARS) throw new ValidationError("簽名檔太大（多半是圖片過大），請換較小的圖片");
  const html = sanitizeSignatureHtml(rawHtml);
  const text = signatureHtmlToText(html);
  const empty = !text && !html.includes("<img");
  await prisma.user.update({
    where: { id: user.id },
    data: { signatureHtml: empty ? null : html, emailSignature: text || null },
  });
  await writeAudit({ actorId: user.id, action: "USER_SIGNATURE_UPDATE", entityType: "User", entityId: user.id, summary: "更新 Email 簽名檔" });
  return html;
}

/** 使用者簽名檔的 HTML（新版格式化簽名；舊版設定自動轉換） */
export function resolveSignatureHtml(u: { signatureHtml: string | null; emailSignature: string | null; signatureImage: string | null; signatureStyle: unknown }): string {
  if (u.signatureHtml) return sanitizeSignatureHtml(u.signatureHtml);
  if (!u.emailSignature && !u.signatureImage) return "";
  return legacySignatureHtml({ text: u.emailSignature ?? "", image: u.signatureImage, style: normalizeSignatureStyle(u.signatureStyle) });
}

/** 取得使用者簽名檔（Email 草稿使用） */
export async function getSignature(userId: string): Promise<{ html: string; text: string } | null> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { emailSignature: true, signatureImage: true, signatureStyle: true, signatureHtml: true, name: true },
  });
  if (!u) return null;
  const html = resolveSignatureHtml(u);
  return { html: html || escapeHtmlText(u.name), text: u.emailSignature?.trim() || u.name };
}

const escapeHtmlText = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
