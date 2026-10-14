import { dbDateToISOOrNull } from "@/lib/dates";
import type { AuthUser } from "@/server/auth/types";
import { writeAudit } from "@/server/audit/audit";
import { buildDocumentLayout } from "./document-layout";
import { getDocumentForEdit, renderDocumentContent } from "./document-service";
import { DOCUMENT_TYPE_LABELS } from "./document-variables";

/** 取得匯出／列印用排版資料（含權限檢查） */
export async function getDocumentLayout(user: AuthUser, id: string) {
  const doc = await getDocumentForEdit(user, id);
  const content = renderDocumentContent(doc);
  const layout = buildDocumentLayout({
    companyName: process.env.COMPANY_NAME ?? "○○交通工程顧問有限公司",
    status: doc.status,
    recipient: doc.recipient,
    dispatchDate: doc.dispatchDate,
    documentNumber: doc.documentNumber,
    attachments: doc.attachments,
    subject: content.subject,
    bodyLines: content.bodyLines,
    primaryRecipients: doc.primaryRecipients,
    ccRecipients: doc.ccRecipients,
  });
  const fileBase = `${doc.schoolCase.schoolName}_${DOCUMENT_TYPE_LABELS[doc.documentType]}_草稿_${dbDateToISOOrNull(doc.draftDate) ?? ""}`.replace(/[\\/:*?"<>|\s]+/g, "_");
  return { doc, layout, missing: content.missing, fileBase };
}

export async function auditExport(user: AuthUser, id: string, format: string) {
  await writeAudit({ actorId: user.id, action: "DOCUMENT_EXPORT", entityType: "OfficialDocument", entityId: id, summary: `匯出公文草稿（${format.toUpperCase()}）` });
}
