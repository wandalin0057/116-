import Link from "next/link";
import { notFound } from "next/navigation";
import { EmailEditor } from "@/components/emails/email-editor";
import { PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/auth";
import { getSignature } from "@/server/users/user-service";
import { formatROCDateTime, toTaipeiDateTimeInput } from "@/lib/dates";
import { canAccessCase } from "@/server/auth/permissions";
import { EMAIL_DRAFT_STATUS_LABELS, getEmailDraft } from "@/server/emails/email-draft-service";
import { AppError } from "@/server/errors";
import { TEMPLATE_TYPE_LABELS } from "@/server/templates/default-templates";

export const metadata = { title: "Email 草稿" };

export default async function EmailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const draft = await getEmailDraft(user, id).catch((e) => {
    if (e instanceof AppError) notFound();
    throw e;
  });
  const canEdit = await canAccessCase(user, draft.caseId, "edit");
  // 簽名圖片使用草稿建立者的設定（無建立者時用目前使用者）
  const signature = await getSignature(draft.createdById ?? user.id);
  return (
    <>
      <PageHeader
        title={TEMPLATE_TYPE_LABELS[draft.templateType]}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Link href={`/cases/${draft.caseId}`} className="text-primary hover:underline">
              {draft.schoolCase.schoolName}
            </Link>
            <span>{draft.schoolCase.projectName}</span>
            <Badge variant={draft.status === "CONFIRMED_SENT" ? "success" : "outline"}>{EMAIL_DRAFT_STATUS_LABELS[draft.status]}</Badge>
            {draft.confirmedSentAt && <span className="text-xs">確認寄出：{formatROCDateTime(draft.confirmedSentAt)}</span>}
          </span>
        }
      />
      <EmailEditor
        canEdit={canEdit}
        schoolName={draft.schoolCase.schoolName}
        isAdmin={user.role === "ADMIN"}
        signature={signature}
        draft={{
          id: draft.id,
          status: draft.status,
          toRecipients: draft.toRecipients,
          ccRecipients: draft.ccRecipients ?? "",
          subject: draft.subject,
          body: draft.body,
          attachmentNames: draft.attachmentNames ?? "",
          attachmentUrl: draft.attachmentUrl ?? "",
          eventDateTime: toTaipeiDateTimeInput(draft.eventDateTime),
          agencyContact: draft.schoolCase.agencyContact ?? "",
        }}
      />
    </>
  );
}
