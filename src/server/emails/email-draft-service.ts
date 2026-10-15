import type { EmailDraftStatus, Prisma, TaskType, TemplateType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { parseTaipeiDateTime } from "@/lib/dates";
import { writeAudit } from "@/server/audit/audit";
import { assertCaseAccess, caseAccessWhere } from "@/server/auth/permissions";
import type { AuthUser } from "@/server/auth/types";
import { buildEmailVariables } from "@/server/documents/document-variables";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/errors";
import { isAdmin } from "@/server/auth/types";
import { orderBy } from "@/server/query-utils";
import { renderTemplate } from "@/server/templates/template-renderer";
import { getActiveTemplate } from "@/server/templates/template-service";

/**
 * Email 草稿管理。
 * 第一版「不自動寄送」含正式附件之業務信件：本模組不呼叫任何寄信服務，
 * 僅產生草稿供使用者複製或以郵件程式開啟，由使用者自行寄出後再確認標記完成。
 */

export type EmailTemplateType = Extract<TemplateType, "REVIEW_SLIDES_EMAIL" | "REVIEW_MINUTES_EMAIL" | "SITE_VISIT_MINUTES_EMAIL">;

export const EMAIL_TASK: Record<EmailTemplateType, TaskType> = {
  REVIEW_SLIDES_EMAIL: "REVIEW_SLIDES_EMAIL",
  REVIEW_MINUTES_EMAIL: "REVIEW_MINUTES_EMAIL",
  SITE_VISIT_MINUTES_EMAIL: "SITE_VISIT_MINUTES_EMAIL",
};

export const EMAIL_DRAFT_STATUS_LABELS: Record<EmailDraftStatus, string> = {
  DRAFT: "草稿（未寄出）",
  CONFIRMED_SENT: "已確認寄出",
  CANCELLED: "作廢",
};

function defaultAttachmentNames(type: EmailTemplateType, schoolName: string) {
  switch (type) {
    case "REVIEW_SLIDES_EMAIL":
      return `${schoolName}審查會議簡報.pdf`;
    case "REVIEW_MINUTES_EMAIL":
      return `${schoolName}審查會議紀錄.pdf`;
    case "SITE_VISIT_MINUTES_EMAIL":
      return `${schoolName}會勘紀錄.pdf`;
  }
}

export async function createEmailDraft(user: AuthUser, input: { caseId: string; templateType: EmailTemplateType; taskId?: string | null }) {
  await assertCaseAccess(user, input.caseId, "edit");
  if (!(input.templateType in EMAIL_TASK)) throw new ValidationError("Email 範本類型錯誤");
  const schoolCase = await prisma.schoolCase.findUniqueOrThrow({ where: { id: input.caseId } });
  const sender = await prisma.user.findUnique({ where: { id: user.id }, select: { name: true } });
  const template = await getActiveTemplate(input.templateType);
  const isSiteVisit = input.templateType === "SITE_VISIT_MINUTES_EMAIL";
  const eventDateTime = isSiteVisit ? schoolCase.siteVisitDateTime : schoolCase.reviewMeetingDateTime;
  const attachmentNames = defaultAttachmentNames(input.templateType, schoolCase.schoolName);
  const vars = buildEmailVariables({
    schoolCase,
    eventDateTime,
    eventLocation: isSiteVisit ? schoolCase.siteVisitLocation : schoolCase.reviewMeetingLocation,
    attachmentNames,
    companyName: process.env.COMPANY_NAME,
    senderName: sender?.name,
  });
  const taskId =
    input.taskId ??
    (await prisma.task.findUnique({ where: { caseId_taskType: { caseId: input.caseId, taskType: EMAIL_TASK[input.templateType] } }, select: { id: true } }))?.id ??
    null;
  const draft = await prisma.emailDraft.create({
    data: {
      caseId: input.caseId,
      taskId,
      templateId: template.id,
      templateType: input.templateType,
      toRecipients: schoolCase.agencyEmail ?? "",
      subject: renderTemplate(template.subject, vars).text,
      body: renderTemplate(template.body, vars).text,
      attachmentNames,
      eventDateTime,
      status: "DRAFT",
      createdById: user.id,
    },
  });
  await writeAudit({ actorId: user.id, action: "EMAIL_DRAFT_CREATE", entityType: "EmailDraft", entityId: draft.id, summary: `建立 Email 草稿：${schoolCase.schoolName}` });
  return draft;
}

const emailListSchema = z
  .string()
  .trim()
  .refine(
    (v) => !v || v.split(/[,;，；\s]+/).filter(Boolean).every((e) => z.string().email().safeParse(e).success),
    "Email 格式錯誤（多筆請以逗號分隔）",
  );

export const emailDraftUpdateSchema = z.object({
  toRecipients: emailListSchema,
  ccRecipients: emailListSchema.optional(),
  subject: z.string().trim().min(1, "請輸入主旨").max(500),
  body: z.string().trim().min(1, "請輸入內文").max(20000),
  attachmentNames: z.string().trim().max(1000).optional(),
  eventDateTime: z.string().optional(),
});

export async function updateEmailDraft(user: AuthUser, id: string, input: z.input<typeof emailDraftUpdateSchema>) {
  const draft = await prisma.emailDraft.findUnique({ where: { id } });
  if (!draft) throw new NotFoundError("找不到 Email 草稿");
  await assertCaseAccess(user, draft.caseId, "edit");
  if (draft.status !== "DRAFT") throw new ValidationError("已確認寄出或作廢之草稿不可修改");
  const parsed = emailDraftUpdateSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "資料格式錯誤");
  const p = parsed.data;
  const updated = await prisma.emailDraft.update({
    where: { id },
    data: {
      toRecipients: p.toRecipients,
      ccRecipients: p.ccRecipients || null,
      subject: p.subject,
      body: p.body,
      attachmentNames: p.attachmentNames || null,
      eventDateTime: p.eventDateTime ? parseTaipeiDateTime(p.eventDateTime) : draft.eventDateTime,
      // 儲存草稿永遠維持 DRAFT 狀態，不會寄出
      status: "DRAFT",
    },
  });
  await writeAudit({ actorId: user.id, action: "EMAIL_DRAFT_UPDATE", entityType: "EmailDraft", entityId: id, summary: "儲存 Email 草稿" });
  return updated;
}

/** 使用者確認已自行寄出後，標記完成並同步完成對應工作 */
export async function confirmEmailSent(user: AuthUser, id: string, input: { confirmed: boolean }) {
  if (input.confirmed !== true) throw new ValidationError("請先確認已由您自行寄出此 Email");
  const draft = await prisma.emailDraft.findUnique({ where: { id } });
  if (!draft) throw new NotFoundError("找不到 Email 草稿");
  await assertCaseAccess(user, draft.caseId, "edit");
  if (draft.status !== "DRAFT") throw new ValidationError("此草稿已確認或作廢");
  if (!draft.toRecipients.trim()) throw new ValidationError("請先填寫收件人");
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.emailDraft.update({ where: { id }, data: { status: "CONFIRMED_SENT", confirmedSentAt: now, confirmedById: user.id } });
    const taskType = EMAIL_TASK[draft.templateType as EmailTemplateType];
    if (taskType) {
      await tx.task.updateMany({ where: { caseId: draft.caseId, taskType, status: { notIn: ["COMPLETED", "CANCELLED"] } }, data: { status: "COMPLETED", actualCompletedAt: now } });
    }
    await writeAudit({ actorId: user.id, action: "EMAIL_CONFIRMED_SENT", entityType: "EmailDraft", entityId: id, summary: "使用者確認已寄出 Email" }, tx);
  });
}

export async function cancelEmailDraft(user: AuthUser, id: string) {
  const draft = await prisma.emailDraft.findUnique({ where: { id } });
  if (!draft) throw new NotFoundError("找不到 Email 草稿");
  await assertCaseAccess(user, draft.caseId, "edit");
  if (draft.status === "CONFIRMED_SENT") throw new ValidationError("已確認寄出之草稿不可作廢");
  await prisma.emailDraft.update({ where: { id }, data: { status: "CANCELLED" } });
  await writeAudit({ actorId: user.id, action: "EMAIL_DRAFT_CANCEL", entityType: "EmailDraft", entityId: id, summary: "Email 草稿作廢" });
}

/**
 * 永久刪除 Email 草稿。已確認寄出者屬工作紀錄，僅管理員可刪除。
 * 刪除不會改變對應工作的完成狀態；操作紀錄保留主旨與收件人。
 */
export async function deleteEmailDraft(user: AuthUser, id: string) {
  const draft = await prisma.emailDraft.findUnique({ where: { id }, include: { schoolCase: { select: { schoolName: true } } } });
  if (!draft) throw new NotFoundError("找不到 Email 草稿");
  await assertCaseAccess(user, draft.caseId, "edit");
  if (draft.status === "CONFIRMED_SENT" && !isAdmin(user)) throw new ForbiddenError("已確認寄出之 Email 僅管理員可刪除");
  await prisma.emailDraft.delete({ where: { id } });
  await writeAudit({
    actorId: user.id,
    action: "EMAIL_DRAFT_DELETE",
    entityType: "EmailDraft",
    entityId: id,
    summary: `刪除 Email 草稿：${draft.schoolCase.schoolName}（${EMAIL_DRAFT_STATUS_LABELS[draft.status]}）`,
    changes: { templateType: draft.templateType, status: draft.status, subject: draft.subject, toRecipients: draft.toRecipients },
  });
}

export async function getEmailDraft(user: AuthUser, id: string) {
  const draft = await prisma.emailDraft.findUnique({ where: { id }, include: { schoolCase: true, createdBy: { select: { name: true } } } });
  if (!draft) throw new NotFoundError("找不到 Email 草稿");
  await assertCaseAccess(user, draft.caseId, "view");
  return draft;
}

export async function listEmailDrafts(user: AuthUser, query: { q?: string; status?: string; templateType?: string; caseId?: string; page?: number; pageSize?: number; sort?: string; dir?: "asc" | "desc" }) {
  const filters: Prisma.EmailDraftWhereInput[] = [{ schoolCase: caseAccessWhere(user) }];
  if (query.status && ["DRAFT", "CONFIRMED_SENT", "CANCELLED"].includes(query.status)) filters.push({ status: query.status as EmailDraftStatus });
  if (query.templateType && query.templateType in EMAIL_TASK) filters.push({ templateType: query.templateType as TemplateType });
  if (query.caseId) filters.push({ caseId: query.caseId });
  if (query.q) {
    const q = query.q.trim();
    filters.push({ OR: [{ subject: { contains: q, mode: "insensitive" } }, { toRecipients: { contains: q, mode: "insensitive" } }, { schoolCase: { schoolName: { contains: q, mode: "insensitive" } } }] });
  }
  const where = { AND: filters };
  const sortable = ["createdAt", "updatedAt", "status", "confirmedSentAt"];
  const sort = sortable.includes(query.sort ?? "") ? query.sort! : "createdAt";
  const pageSize = Math.min(Math.max(query.pageSize ?? 20, 5), 100);
  const page = Math.max(query.page ?? 1, 1);
  const [total, items] = await Promise.all([
    prisma.emailDraft.count({ where }),
    prisma.emailDraft.findMany({
      where,
      orderBy: [orderBy(sort, query.dir === "asc" ? "asc" : "desc", ["confirmedSentAt"])] as Prisma.EmailDraftOrderByWithRelationInput[],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { schoolCase: { select: { id: true, schoolName: true, projectCode: true } } },
    }),
  ]);
  return { total, page, pageSize, items };
}
