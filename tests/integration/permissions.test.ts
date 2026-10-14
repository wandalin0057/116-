import { beforeEach, describe, expect, it } from "vitest";
import { createCase, getCaseDetail, listCases, setCaseMember, updateCase } from "@/server/cases/case-service";
import { completeTask, listTasks } from "@/server/tasks/task-service";
import { createDocumentDraft, listDocuments } from "@/server/documents/document-service";
import { prisma } from "@/lib/db";
import { authenticate } from "@/server/auth/login";
import { validateSessionToken } from "@/server/auth/session";
import { updateUser } from "@/server/users/user-service";
import { ForbiddenError } from "@/server/errors";
import { caseInput, hasTestDb, makeUser, resetDatabase, seedBasics } from "../helpers/db";

describe.skipIf(!hasTestDb)("13. 權限控管", () => {
  beforeEach(async () => {
    await resetDatabase();
    await seedBasics();
  });

  it("不同使用者不能存取未授權案件", async () => {
    const alice = await makeUser("alice@example.com");
    const bob = await makeUser("bob@example.com");
    const admin = await makeUser("admin@example.com", "ADMIN");
    const { schoolCase } = await createCase(alice, caseInput({ responsibleUserId: alice.id }));
    const task = await prisma.task.findFirstOrThrow({ where: { caseId: schoolCase.id } });

    await expect(getCaseDetail(bob, schoolCase.id)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(updateCase(bob, schoolCase.id, caseInput({ responsibleUserId: bob.id }))).rejects.toBeInstanceOf(ForbiddenError);
    await expect(completeTask(bob, task.id)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(createDocumentDraft(bob, { caseId: schoolCase.id, documentType: "PRE_REPORT" })).rejects.toBeInstanceOf(ForbiddenError);
    expect((await listCases(bob, {})).total).toBe(0);
    expect((await listTasks(bob, { view: "all" })).total).toBe(0);
    expect((await listDocuments(bob, {})).total).toBe(0);

    // 管理員可存取全部
    expect((await getCaseDetail(admin, schoolCase.id)).id).toBe(schoolCase.id);
    expect((await listCases(admin, {})).total).toBe(1);
  });

  it("授權為檢視者僅可讀取，授權為編輯者可修改", async () => {
    const alice = await makeUser("alice@example.com");
    const bob = await makeUser("bob@example.com");
    const { schoolCase } = await createCase(alice, caseInput({ responsibleUserId: alice.id }));
    await setCaseMember(alice, schoolCase.id, bob.id, "VIEWER");
    expect((await getCaseDetail(bob, schoolCase.id)).id).toBe(schoolCase.id);
    await expect(updateCase(bob, schoolCase.id, caseInput({ responsibleUserId: alice.id }))).rejects.toBeInstanceOf(ForbiddenError);
    await setCaseMember(alice, schoolCase.id, bob.id, "EDITOR");
    await expect(updateCase(bob, schoolCase.id, caseInput({ responsibleUserId: alice.id, schoolName: "仁愛國民小學" }))).resolves.toBeTruthy();
    // 非負責人之一般使用者不可調整授權
    await expect(setCaseMember(bob, schoolCase.id, bob.id, null)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("登入驗證、停用帳號後工作階段失效", async () => {
    const admin = await makeUser("admin@example.com", "ADMIN");
    const alice = await makeUser("alice@example.com");
    expect((await authenticate("alice@example.com", "wrong-password")).ok).toBe(false);
    const ok = await authenticate("ALICE@example.com", "Password1234");
    expect(ok.ok).toBe(true);
    const token = ok.ok ? ok.token : "";
    expect((await validateSessionToken(token))?.user.id).toBe(alice.id);
    // 資料庫僅存權杖雜湊
    expect(await prisma.session.count({ where: { tokenHash: token } })).toBe(0);
    await updateUser(admin, alice.id, { name: "alice", role: "USER", isActive: false });
    expect(await validateSessionToken(token)).toBeNull();
    expect((await authenticate("alice@example.com", "Password1234")).ok).toBe(false);
  });

  it("連續登入失敗將暫時鎖定帳號", async () => {
    await makeUser("alice@example.com");
    for (let i = 0; i < 5; i++) await authenticate("alice@example.com", "bad");
    const r = await authenticate("alice@example.com", "Password1234");
    expect(r.ok).toBe(false);
    expect(r.ok ? "" : r.message).toMatch(/鎖定/);
  });
});
