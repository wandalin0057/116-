"use server";
import type { DocumentType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUserForAction } from "@/lib/auth";
import { runAction } from "@/lib/action-result";
import { assertCaseAccess } from "@/server/auth/permissions";
import {
  cancelDocument,
  createDocumentDraft,
  deleteDocument,
  markDocumentDispatched,
  markDocumentDrafted,
  updateDocument,
  type documentUpdateSchema,
} from "@/server/documents/document-service";
import type { z } from "zod";

/** 開啟既有草稿；若無則依範本新建 */
export async function openOrCreateDocumentAction(caseId: string, documentType: DocumentType, taskId?: string | null) {
  return runAction(async () => {
    const user = await requireUserForAction();
    await assertCaseAccess(user, caseId, "view");
    const existing = await prisma.officialDocument.findFirst({
      where: { caseId, documentType, status: { in: ["DRAFT", "DRAFTED"] } },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (existing) return { id: existing.id };
    const doc = await createDocumentDraft(user, { caseId, documentType, taskId });
    return { id: doc.id };
  });
}

export async function createDocumentAction(caseId: string, documentType: DocumentType) {
  return runAction(async () => ({ id: (await createDocumentDraft(await requireUserForAction(), { caseId, documentType })).id }), "已依範本建立公文草稿");
}

export async function updateDocumentAction(id: string, input: z.input<typeof documentUpdateSchema>) {
  return runAction(async () => {
    await updateDocument(await requireUserForAction(), id, input);
  }, "草稿已儲存");
}

export async function markDocumentDraftedAction(id: string) {
  return runAction(async () => markDocumentDrafted(await requireUserForAction(), id), "已標記創稿完成（尚未發文）");
}

export async function markDocumentDispatchedAction(id: string, input: { documentNumber: string; dispatchDate: string }) {
  return runAction(async () => markDocumentDispatched(await requireUserForAction(), id, input), "已標記發文完成並記錄發文字號");
}

export async function deleteDocumentAction(id: string) {
  return runAction(async () => deleteDocument(await requireUserForAction(), id), "公文已刪除");
}

export async function cancelDocumentAction(id: string) {
  return runAction(async () => cancelDocument(await requireUserForAction(), id), "公文草稿已作廢");
}
