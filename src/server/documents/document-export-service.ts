import { dbDateToISOOrNull } from "@/lib/dates";
import type { AuthUser } from "@/server/auth/types";
import { writeAudit } from "@/server/audit/audit";
import { buildDocumentLayout } from "./document-layout";
import { getOrganization } from "@/server/settings/settings-service";
import { getDocumentForEdit, renderDocumentContent } from "./document-service";
import { DOCUMENT_TYPE_LABELS } from "./document-variables";

/** 取得匯出／列印用排版資料（含權限檢查） */
export async function getDocumentLayout(user: AuthUser, id: string) {
  const [doc, org] = await Promise.all([getDocumentForEdit(user, id), getOrganization()]);
  const content = renderDocumentContent(doc, org.companyName);
  const layout = buildDocumentLayout({
    companyName: org.companyName,
    organization: org,
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
