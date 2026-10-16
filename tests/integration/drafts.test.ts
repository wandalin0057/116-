import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { createCase } from "@/server/cases/case-service";
import {
  createDocumentDraft,
  getDocumentForEdit,
  markDocumentDispatched,
  markDocumentDrafted,
  renderDocumentContent,
  updateDocument,
} from "@/server/documents/document-service";
import { confirmEmailSent, createEmailDraft, updateEmailDraft } from "@/server/emails/email-draft-service";
import * as mailerModule from "@/server/reminders/mailer";
import { caseInput, hasTestDb, makeUser, resetDatabase, seedBasics } from "../helpers/db";

describe.skipIf(!hasTestDb)("公文與 Email 草稿", () => {
  beforeEach(async () => {
    await resetDatabase();
    await seedBasics();
  });

  it("15. Email 草稿不會在未確認時自動寄出", async () => {
    const spy = vi.spyOn(mailerModule, "createMailer");
    const u = await makeUser("pm@example.com", "ADMIN");
    const { schoolCase } = await createCase(u, caseInput({ responsibleUserId: u.id }));
    const draft = await createEmailDraft(u, { caseId: schoolCase.id, templateType: "REVIEW_SLIDES_EMAIL" });
    expect(draft.status).toBe("DRAFT");
    expect(draft.toRecipients).toBe("agency@example.com");
    expect(draft.body).toContain("您好，");
    expect(draft.body).toContain("{attachmentUrl}");
    await updateEmailDraft(u, draft.id, { toRecipients: "agency@example.com", subject: draft.subject, body: draft.body + "\n補充" });
    expect((await prisma.emailDraft.findUniqueOrThrow({ where: { id: draft.id } })).status).toBe("DRAFT");
    // 未勾選確認不可標記
    await expect(confirmEmailSent(u, draft.id, { confirmed: false })).rejects.toThrow(/確認/);
    const task = await prisma.task.findFirstOrThrow({ where: { caseId: schoolCase.id, taskType: "REVIEW_SLIDES_EMAIL" } });
    expect(task.status).toBe("NOT_STARTED");
    expect(spy).not.toHaveBeenCalled();
    expect(await prisma.notificationLog.count()).toBe(0);

    await confirmEmailSent(u, draft.id, { confirmed: true });
    expect((await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).status).toBe("COMPLETED");
    expect(spy).not.toHaveBeenCalled();
  });

  it("公文：密碼加密儲存、創稿與發文分別完成、發文字號由使用者輸入", async () => {
    const u = await makeUser("pm@example.com", "ADMIN");
    const { schoolCase } = await createCase(u, caseInput({ responsibleUserId: u.id }));
    const doc = await createDocumentDraft(u, { caseId: schoolCase.id, documentType: "PRE_REPORT" });
    expect(doc.documentNumber).toBeNull();
    expect(doc.body).toContain("115年10月14日");
    await updateDocument(u, doc.id, {
      subject: doc.subject,
      body: doc.body,
      attachmentUrl: "https://files.example.com/x",
      attachmentPassword: "Secret99",
      downloadDeadline: "2026-11-30",
    });
    const raw = await prisma.officialDocument.findUniqueOrThrow({ where: { id: doc.id } });
    expect(raw.attachmentPasswordEnc).not.toContain("Secret99");
    expect(raw.body).not.toContain("Secret99");
    const full = await getDocumentForEdit(u, doc.id);
    const content = renderDocumentContent(full);
    expect(content.bodyLines[1]).toBe("二、附件網址：https://files.example.com/x，下載密碼：Secret99(請於115年11月30日前下載)。");
    expect(doc.recipient).toBe("如行文單位");

    await markDocumentDrafted(u, doc.id);
    const draftTask = await prisma.task.findFirstOrThrow({ where: { caseId: schoolCase.id, taskType: "PRE_REPORT_DRAFT" } });
    expect(draftTask.status).toBe("COMPLETED");
    // 事前規劃報告書已不另列「提供圖說」工項
    expect(await prisma.task.count({ where: { caseId: schoolCase.id, taskType: "PRE_REPORT_DISPATCH" } })).toBe(0);

    await expect(markDocumentDispatched(u, doc.id, { documentNumber: "", dispatchDate: "2026-11-02" })).rejects.toThrow(/發文字號/);
    await markDocumentDispatched(u, doc.id, { documentNumber: "交顧字第1150001號", dispatchDate: "2026-11-02" });
    const after = await prisma.officialDocument.findUniqueOrThrow({ where: { id: doc.id } });
    expect(after.documentNumber).toBe("交顧字第1150001號");
    await expect(updateDocument(u, doc.id, { subject: "x", body: "y" })).rejects.toThrow(/不可修改/);
  });

  it("新公文自動帶入下載密碼（CD80@＋提供報告日期）與下載期限（創稿日＋14 天）", async () => {
    const { taipeiToday, addCalendarDays, dbDateToISO } = await import("@/lib/dates");
    const u = await makeUser("pm@example.com", "ADMIN");
    const { schoolCase } = await createCase(u, caseInput({ responsibleUserId: u.id }));
    const provide = await prisma.task.findFirstOrThrow({ where: { caseId: schoolCase.id, taskType: "PRE_REPORT_PROVIDE" } });
    const d = dbDateToISO(provide.calculatedDueDate!);
    const doc = await createDocumentDraft(u, { caseId: schoolCase.id, documentType: "PRE_REPORT" });
    const full = await getDocumentForEdit(u, doc.id);
    expect(full.attachmentPassword).toBe(`CD80@${d.slice(5, 7)}${d.slice(8, 10)}`);
    expect(dbDateToISO(full.downloadDeadline!)).toBe(addCalendarDays(taipeiToday(), 14));
  });

  it("操作紀錄不包含下載密碼", async () => {
    const u = await makeUser("pm@example.com");
    const { schoolCase } = await createCase(u, caseInput({ responsibleUserId: u.id }));
    const doc = await createDocumentDraft(u, { caseId: schoolCase.id, documentType: "REVIEW_DRAWING" });
    await updateDocument(u, doc.id, { subject: doc.subject, body: doc.body, attachmentPassword: "TopSecret77" });
    const logs = await prisma.auditLog.findMany();
    expect(JSON.stringify(logs)).not.toContain("TopSecret77");
  });

  it("刪除公文：未發文可由編輯者刪除；已發文僅管理員可刪除，並留下操作紀錄", async () => {
    const { deleteDocument } = await import("@/server/documents/document-service");
    const admin = await makeUser("admin@example.com", "ADMIN");
    const u = await makeUser("pm@example.com");
    const other = await makeUser("other@example.com");
    const { schoolCase } = await createCase(u, caseInput({ responsibleUserId: u.id }));
    const draft = await createDocumentDraft(u, { caseId: schoolCase.id, documentType: "PRE_REPORT" });
    await expect(deleteDocument(other, draft.id)).rejects.toThrow(/權限/);
    await deleteDocument(u, draft.id);
    expect(await prisma.officialDocument.count({ where: { id: draft.id } })).toBe(0);

    const sent = await createDocumentDraft(u, { caseId: schoolCase.id, documentType: "REVIEW_DRAWING" });
    await markDocumentDispatched(admin, sent.id, { documentNumber: "交顧字第1150002號", dispatchDate: "2026-11-02" });
    await expect(deleteDocument(u, sent.id)).rejects.toThrow(/僅管理員/);
    await deleteDocument(admin, sent.id);
    expect(await prisma.officialDocument.count({ where: { id: sent.id } })).toBe(0);
    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: "DOCUMENT_DELETE", entityId: sent.id } });
    expect(log.summary).toContain("交顧字第1150002號");
    // 對應工作的完成狀態不受影響
    expect((await prisma.task.findFirstOrThrow({ where: { caseId: schoolCase.id, taskType: "REVIEW_DRAWING_DISPATCH" } })).status).toBe("COMPLETED");
  });

  it("刪除 Email 草稿：未寄出可由編輯者刪除；已確認寄出僅管理員可刪除，並留下操作紀錄", async () => {
    const { deleteEmailDraft } = await import("@/server/emails/email-draft-service");
    const admin = await makeUser("admin@example.com", "ADMIN");
    const u = await makeUser("pm@example.com");
    const other = await makeUser("other@example.com");
    const { schoolCase } = await createCase(u, caseInput({ responsibleUserId: u.id }));
    const d1 = await createEmailDraft(u, { caseId: schoolCase.id, templateType: "REVIEW_SLIDES_EMAIL" });
    await expect(deleteEmailDraft(other, d1.id)).rejects.toThrow(/權限/);
    await deleteEmailDraft(u, d1.id);
    expect(await prisma.emailDraft.count({ where: { id: d1.id } })).toBe(0);

    const d2 = await createEmailDraft(u, { caseId: schoolCase.id, templateType: "REVIEW_MINUTES_EMAIL" });
    await confirmEmailSent(admin, d2.id, { confirmed: true });
    await expect(deleteEmailDraft(u, d2.id)).rejects.toThrow(/僅管理員/);
    await deleteEmailDraft(admin, d2.id);
    expect(await prisma.emailDraft.count({ where: { id: d2.id } })).toBe(0);
    expect(await prisma.auditLog.count({ where: { action: "EMAIL_DRAFT_DELETE" } })).toBe(2);
    expect((await prisma.task.findFirstOrThrow({ where: { caseId: schoolCase.id, taskType: "REVIEW_MINUTES_EMAIL" } })).status).toBe("COMPLETED");
  });

  it("刪除學校案件：僅管理員；含公文／Email 時需輸入案件編號，並一併刪除", async () => {
    const { deleteCase } = await import("@/server/cases/case-service");
    const admin = await makeUser("admin@example.com", "ADMIN");
    const u = await makeUser("pm@example.com");
    const { schoolCase } = await createCase(u, caseInput({ responsibleUserId: u.id }));
    const doc = await createDocumentDraft(u, { caseId: schoolCase.id, documentType: "PRE_REPORT" });
    await markDocumentDispatched(admin, doc.id, { documentNumber: "交顧字第1150009號", dispatchDate: "2026-11-02" });
    await createEmailDraft(u, { caseId: schoolCase.id, templateType: "REVIEW_SLIDES_EMAIL" });

    await expect(deleteCase(u, schoolCase.id, { confirmCode: "TP-001" })).rejects.toThrow(/僅管理員/);
    await expect(deleteCase(admin, schoolCase.id)).rejects.toThrow(/請輸入案件編號/);
    await expect(deleteCase(admin, schoolCase.id, { confirmCode: "TP-999" })).rejects.toThrow(/請輸入案件編號/);
    await deleteCase(admin, schoolCase.id, { confirmCode: "TP-001" });

    expect(await prisma.schoolCase.count({ where: { id: schoolCase.id } })).toBe(0);
    expect(await prisma.task.count({ where: { caseId: schoolCase.id } })).toBe(0);
    expect(await prisma.officialDocument.count({ where: { caseId: schoolCase.id } })).toBe(0);
    expect(await prisma.emailDraft.count({ where: { caseId: schoolCase.id } })).toBe(0);
    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: "CASE_DELETE" } });
    expect(JSON.stringify(log.changes)).toContain("交顧字第1150009號");

    // 沒有公文／Email 的案件不需輸入編號
    const second = await createCase(u, caseInput({ responsibleUserId: u.id, projectCode: "TP-002" }));
    await deleteCase(admin, second.schoolCase.id);
    expect(await prisma.schoolCase.count()).toBe(0);
  });

  it("簽名圖片：只接受圖片 data URL 並限制大小，可移除", async () => {
    const { updateSignatureImage } = await import("@/server/users/user-service");
    const u = await makeUser("pm@example.com");
    const png = "data:image/png;base64," + Buffer.from("fake-png").toString("base64");
    await updateSignatureImage(u, png);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).signatureImage).toBe(png);
    await expect(updateSignatureImage(u, "data:text/html;base64,PHNjcmlwdD4=")).rejects.toThrow(/格式不支援/);
    await expect(updateSignatureImage(u, "javascript:alert(1)")).rejects.toThrow(/格式不支援/);
    await expect(updateSignatureImage(u, "data:image/png;base64," + "A".repeat(500_000))).rejects.toThrow(/太大/);
    await updateSignatureImage(u, null);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).signatureImage).toBeNull();
  });

  it("儲存格式化簽名檔（HTML 白名單過濾），新 Email 草稿保留 {signature} 供套用", async () => {
    const { saveSignatureHtml, getSignature } = await import("@/server/users/user-service");
    const u = await makeUser("pm@example.com");
    const png = "data:image/png;base64," + Buffer.from("x").toString("base64");
    const saved = await saveSignatureHtml(
      u,
      `<p><span style="font-size:14pt;color:#1f4e79">林映辰</span> 規劃師<script>alert(1)</script></p><p><a href="mailto:pm@example.com">pm@example.com</a></p><p><img src="${png}" width="200"></p>`,
    );
    expect(saved).not.toContain("script");
    const sig = await getSignature(u.id);
    expect(sig?.text).toBe("林映辰 規劃師\npm@example.com");
    expect(sig?.html).toContain("font-size:14pt;color:#1f4e79");
    expect(sig?.html).toContain('href="mailto:pm@example.com"');
    expect(sig?.html).toContain('width="200"');
    await expect(saveSignatureHtml(u, "x".repeat(700_000))).rejects.toThrow(/太大/);
    const { schoolCase } = await createCase(u, caseInput({ responsibleUserId: u.id }));
    const draft = await createEmailDraft(u, { caseId: schoolCase.id, templateType: "REVIEW_MINUTES_EMAIL" });
    expect(draft.body.trim().endsWith("{signature}")).toBe(true);
  });
});
