import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/server/audit/audit";
import { assertAdmin } from "@/server/auth/permissions";
import type { AuthUser } from "@/server/auth/types";
import { ValidationError } from "@/server/errors";

export interface EmailSettings {
  provider: string;
  from: string;
  /** 測試模式：所有通知改寄測試收件人 */
  testMode: boolean;
  testRecipient: string | null;
  /** 非工作天（週末、國定假日）不寄送每日提醒 */
  skipNonBusinessDays: boolean;
  /** 金鑰是否已設定（僅回傳是否設定，不回傳內容） */
  providerConfigured: boolean;
}

const KEY = "email";

const storedSchema = z.object({
  testMode: z.boolean().optional(),
  testRecipient: z.string().nullable().optional(),
  skipNonBusinessDays: z.boolean().optional(),
});

export async function getEmailSettings(): Promise<EmailSettings> {
  const row = await prisma.systemSetting.findUnique({ where: { key: KEY } });
  const stored = storedSchema.safeParse(row?.value ?? {});
  const s = stored.success ? stored.data : {};
  const provider = process.env.EMAIL_PROVIDER ?? "console";
  const envTestMode = process.env.EMAIL_TEST_MODE === undefined || process.env.EMAIL_TEST_MODE === "" ? true : ["true", "1"].includes(process.env.EMAIL_TEST_MODE);
  return {
    provider,
    from: process.env.EMAIL_FROM ?? "",
    testMode: s.testMode ?? envTestMode,
    testRecipient: s.testRecipient ?? process.env.EMAIL_TEST_RECIPIENT ?? null,
    skipNonBusinessDays: s.skipNonBusinessDays ?? process.env.REMINDER_SKIP_NON_BUSINESS_DAYS !== "false",
    providerConfigured:
      provider === "console" ||
      (provider === "resend" && !!process.env.RESEND_API_KEY) ||
      (provider === "smtp" && !!process.env.SMTP_HOST),
  };
}

const updateSchema = z.object({
  testMode: z.boolean(),
  testRecipient: z.string().trim().email("測試收件人 Email 格式錯誤").or(z.literal("")).optional(),
  skipNonBusinessDays: z.boolean(),
});

export async function updateEmailSettings(user: AuthUser, input: z.input<typeof updateSchema>) {
  assertAdmin(user);
  const p = updateSchema.safeParse(input);
  if (!p.success) throw new ValidationError(p.error.issues[0]?.message ?? "資料格式錯誤");
  if (p.data.testMode && !p.data.testRecipient) throw new ValidationError("啟用測試模式時須設定測試收件人");
  const value = { testMode: p.data.testMode, testRecipient: p.data.testRecipient || null, skipNonBusinessDays: p.data.skipNonBusinessDays } satisfies Prisma.InputJsonValue;
  await prisma.systemSetting.upsert({ where: { key: KEY }, create: { key: KEY, value, updatedById: user.id }, update: { value, updatedById: user.id } });
  await writeAudit({ actorId: user.id, action: "EMAIL_SETTINGS_UPDATE", entityType: "SystemSetting", entityId: KEY, summary: `更新 Email 設定（測試模式：${p.data.testMode ? "開" : "關"}）`, changes: value });
}
