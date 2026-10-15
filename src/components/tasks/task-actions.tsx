"use client";
import { useCanComplete } from "@/components/layout/viewer-context";
import type { TaskStatus, TaskType } from "@prisma/client";
import { CheckCircle2, ExternalLink, Eye, FileText, Loader2, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { openOrCreateDocumentAction } from "@/app/actions/documents";
import { openOrCreateEmailDraftAction } from "@/app/actions/emails";
import { completeTaskAction } from "@/app/actions/tasks";
import { ActionButton } from "@/components/common/action-button";
import { Button } from "@/components/ui/button";
import { TASK_DOCUMENT_TYPE, TASK_EMAIL_TYPE } from "@/server/schedule/task-types";

export interface TaskActionProps {
  taskId: string;
  caseId: string;
  taskType: TaskType;
  status: TaskStatus;
  title: string;
  uploadUrl?: string | null;
  compact?: boolean;
  showCase?: boolean;
}

export function TaskActions({ taskId, caseId, taskType, status, title, uploadUrl, compact, showCase = true }: TaskActionProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const size = compact ? "xs" : "sm";
  const docType = TASK_DOCUMENT_TYPE[taskType];
  const emailType = TASK_EMAIL_TYPE[taskType];
  const closed = status === "COMPLETED" || status === "CANCELLED";
  const canComplete = useCanComplete();

  const open = (fn: () => Promise<{ ok: boolean; message?: string; data?: { id: string } }>, base: string) =>
    start(async () => {
      const res = await fn();
      if (res.ok && res.data) router.push(`${base}/${res.data.id}`);
      else toast.error(res.message ?? "無法開啟");
    });

  return (
    <div className="flex flex-wrap gap-1.5">
      {showCase && (
        <Button asChild variant="outline" size={size}>
          <Link href={`/cases/${caseId}`}>
            <Eye />
            查看案件
          </Link>
        </Button>
      )}
      {docType && (
        <Button variant="outline" size={size} disabled={pending} onClick={() => open(() => openOrCreateDocumentAction(caseId, docType, taskId), "/documents")}>
          {pending ? <Loader2 className="animate-spin" /> : <FileText />}
          產生公文
        </Button>
      )}
      {emailType && (
        <Button variant="outline" size={size} disabled={pending} onClick={() => open(() => openOrCreateEmailDraftAction(caseId, emailType, taskId), "/emails")}>
          {pending ? <Loader2 className="animate-spin" /> : <Mail />}
          產生 Email
        </Button>
      )}
      {taskType === "SITE_VISIT_SLIDES_UPLOAD" &&
        (uploadUrl ? (
          <Button asChild variant="outline" size={size}>
            <a href={uploadUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink />
              開啟上傳網址
            </a>
          </Button>
        ) : (
          <Button variant="outline" size={size} disabled title="案件尚未填寫會勘簡報上傳網址">
            <ExternalLink />
            未設定上傳網址
          </Button>
        ))}
      {!closed && canComplete && (
        <ActionButton
          size={size}
          variant="success"
          action={() => completeTaskAction(taskId)}
          confirm={{
            title: "確認標記完成？",
            description:
              docType && taskType.endsWith("_DRAFT")
                ? `「${title}」標記完成僅代表創稿完成，提供圖說需另行標記。`
                : emailType
                  ? `請確認您已自行寄出「${title}」相關 Email。`
                  : `確認「${title}」已完成。`,
            confirmLabel: "標記完成",
          }}
        >
          <CheckCircle2 />
          標記完成
        </ActionButton>
      )}
    </div>
  );
}
