"use server";
import type { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserForAction } from "@/lib/auth";
import { runAction } from "@/lib/action-result";
import { assertCaseAccess } from "@/server/auth/permissions";
import {
  cancelEmailDraft,
  confirmEmailSent,
  createEmailDraft,
  deleteEmailDraft,
  updateEmailDraft,
  type emailDraftUpdateSchema,
  type EmailTemplateType,
} from "@/server/emails/email-draft-service";

export async function openOrCreateEmailDraftAction(caseId: string, templateType: EmailTemplateType, taskId?: string | null) {
  return runAction(async () => {
    const user = await requireUserForAction();
    await assertCaseAccess(user, caseId, "view");
    const existing = await prisma.emailDraft.findFirst({ where: { caseId, templateType, status: "DRAFT" }, orderBy: { createdAt: "desc" }, select: { id: true } });
    if (existing) return { id: existing.id };
    return { id: (await createEmailDraft(user, { caseId, templateType, taskId })).id };
  });
}

export async function createEmailDraftAction(caseId: string, templateType: EmailTemplateType) {
  return runAction(async () => ({ id: (await createEmailDraft(await requireUserForAction(), { caseId, templateType })).id }), "已建立 Email 草稿");
}

export async function updateEmailDraftAction(id: string, input: z.input<typeof emailDraftUpdateSchema>) {
  return runAction(async () => {
    await updateEmailDraft(await requireUserForAction(), id, input);
  }, "草稿已儲存（尚未寄出）");
}

export async function confirmEmailSentAction(id: string) {
  return runAction(async () => confirmEmailSent(await requireUserForAction(), id, { confirmed: true }), "已標記為已寄出，對應工作已完成");
}

export async function deleteEmailDraftAction(id: string) {
  return runAction(async () => deleteEmailDraft(await requireUserForAction(), id), "Email 草稿已刪除");
}

export async function cancelEmailDraftAction(id: string) {
  return runAction(async () => cancelEmailDraft(await requireUserForAction(), id), "Email 草稿已作廢");
}
