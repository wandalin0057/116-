"use server";
import { getRequestMeta, requireUserForAction } from "@/lib/auth";
import { runAction } from "@/lib/action-result";
import type { CaseInput } from "@/server/cases/case-schema";
import { createCase, deleteCase, markEventHeld, previewCaseUpdate, setCaseMember, updateCase } from "@/server/cases/case-service";

export async function createCaseAction(input: CaseInput) {
  return runAction(async () => {
    const user = await requireUserForAction();
    const { schoolCase, changes } = await createCase(user, input, await getRequestMeta());
    return { id: schoolCase.id, created: changes.filter((c) => c.action === "CREATE").length };
  }, "案件已建立，並依期限規則產生工作");
}

export async function previewCaseUpdateAction(caseId: string, input: CaseInput) {
  return runAction(async () => previewCaseUpdate(await requireUserForAction(), caseId, input));
}

export async function updateCaseAction(caseId: string, input: CaseInput) {
  return runAction(async () => {
    const user = await requireUserForAction();
    const { changes } = await updateCase(user, caseId, input, await getRequestMeta());
    return { updated: changes.filter((c) => c.action === "UPDATE" || c.action === "CLEAR").length, created: changes.filter((c) => c.action === "CREATE").length };
  }, "案件已更新");
}

export async function deleteCaseAction(caseId: string, confirmCode?: string) {
  return runAction(async () => deleteCase(await requireUserForAction(), caseId, { confirmCode, ...(await getRequestMeta()) }), "案件已刪除");
}

export async function setCaseMemberAction(caseId: string, userId: string, role: "EDITOR" | "VIEWER" | null) {
  return runAction(async () => setCaseMember(await requireUserForAction(), caseId, userId, role), role ? "已更新案件授權" : "已移除案件授權");
}

export async function markEventHeldAction(caseId: string, kind: "REVIEW_MEETING" | "SITE_VISIT", info: { attendees?: string; notes?: string }) {
  return runAction(
    async () => markEventHeld(await requireUserForAction(), caseId, kind, { attendees: info.attendees || null, notes: info.notes || null }),
    kind === "REVIEW_MEETING" ? "已標記審查會議辦理完成" : "已標記會勘辦理完成",
  );
}
