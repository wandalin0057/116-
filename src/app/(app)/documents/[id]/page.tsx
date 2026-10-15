import Link from "next/link";
import { notFound } from "next/navigation";
import { DocumentEditor } from "@/components/documents/document-editor";
import { PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/auth";
import { dbDateToISOOrNull, formatROCDateTime } from "@/lib/dates";
import { canAccessCase } from "@/server/auth/permissions";
import { getDocumentForEdit } from "@/server/documents/document-service";
import { buildDocumentVariables, DOCUMENT_STATUS_LABELS, DOCUMENT_TYPE_LABELS } from "@/server/documents/document-variables";
import { AppError } from "@/server/errors";
import { getActiveTemplate } from "@/server/templates/template-service";

export const metadata = { title: "公文草稿" };

export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const doc = await getDocumentForEdit(user, id).catch((e) => {
    if (e instanceof AppError) notFound();
    throw e;
  });
  const [canEdit, template] = await Promise.all([canAccessCase(user, doc.caseId, "edit"), getActiveTemplate(doc.documentType)]);
  const baseVars = buildDocumentVariables({ schoolCase: doc.schoolCase, companyName: process.env.COMPANY_NAME ?? "○○交通工程顧問有限公司" });
  return (
    <>
      <PageHeader
        title={`${DOCUMENT_TYPE_LABELS[doc.documentType]}公文`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Link href={`/cases/${doc.caseId}`} className="text-primary hover:underline">
              {doc.schoolCase.schoolName}
            </Link>
            <Badge variant={doc.status === "DISPATCHED" ? "success" : doc.status === "DRAFTED" ? "info" : "outline"}>{DOCUMENT_STATUS_LABELS[doc.status]}</Badge>
            <span className="text-xs">範本：{doc.template ? `${doc.template.name} 第 ${doc.template.version} 版` : "系統預設"}</span>
            {doc.draftCompletedAt && <span className="text-xs">創稿完成：{formatROCDateTime(doc.draftCompletedAt)}</span>}
            {doc.dispatchCompletedAt && <span className="text-xs">發文完成：{formatROCDateTime(doc.dispatchCompletedAt)}</span>}
          </span>
        }
      />
      <DocumentEditor
        canEdit={canEdit}
        companyName={process.env.COMPANY_NAME ?? "○○交通工程顧問有限公司"}
        schoolName={doc.schoolCase.schoolName}
        isAdmin={user.role === "ADMIN"}
        template={{ subject: template.subject, body: template.body }}
        baseVars={baseVars as Record<string, string>}
        doc={{
          id: doc.id,
          status: doc.status,
          documentNumber: doc.documentNumber,
          recipient: doc.recipient ?? "",
          subject: doc.subject,
          body: doc.body,
          attachments: doc.attachments ?? "",
          attachmentUrl: doc.attachmentUrl ?? "",
          attachmentPassword: doc.attachmentPassword ?? "",
          downloadDeadline: dbDateToISOOrNull(doc.downloadDeadline) ?? "",
          primaryRecipients: doc.primaryRecipients ?? "",
          ccRecipients: doc.ccRecipients ?? "",
          draftDate: dbDateToISOOrNull(doc.draftDate) ?? "",
          dispatchDate: dbDateToISOOrNull(doc.dispatchDate) ?? "",
        }}
      />
    </>
  );
}
