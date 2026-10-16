import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { authenticate } from "@/server/auth/login";
import { createCase } from "@/server/cases/case-service";
import { applyDefaultPasswordToUsers, setDefaultUserPassword } from "@/server/users/default-password";
import { changeOwnPassword, createUser } from "@/server/users/user-service";
import { caseInput, hasTestDb, makeUser, resetDatabase, seedBasics } from "../helpers/db";

const PW = "123456789abc";

describe.skipIf(!hasTestDb)("一般使用者初始密碼", () => {
  beforeEach(async () => {
    await resetDatabase();
    await seedBasics();
  });

  it("設定後：重設所有一般使用者、新增使用者與案件自動建立帳號都使用初始密碼；變更後解除提醒", async () => {
    const admin = await makeUser("pm@example.com", "ADMIN");
    const eng = await makeUser("eng@example.com");
    await expect(applyDefaultPasswordToUsers(admin)).rejects.toThrow(/先設定/);
    await expect(setDefaultUserPassword(admin, "short")).rejects.toThrow();
    await expect(setDefaultUserPassword(eng, PW)).rejects.toThrow();
    await setDefaultUserPassword(admin, PW);
    const row = await prisma.systemSetting.findUniqueOrThrow({ where: { key: "defaultUserPassword" } });
    expect(JSON.stringify(row.value)).not.toContain(PW);

    expect(await applyDefaultPasswordToUsers(admin)).toBe(1);
    expect((await authenticate("eng@example.com", PW, {})).ok).toBe(true);
    expect((await authenticate("pm@example.com", PW, {})).ok).toBe(false);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: eng.id } })).mustChangePassword).toBe(true);

    await createUser(admin, { email: "new@example.com", name: "新同事", role: "USER" });
    expect((await authenticate("new@example.com", PW, {})).ok).toBe(true);
    await expect(createUser(admin, { email: "boss@example.com", name: "主管", role: "ADMIN" })).rejects.toThrow(/管理員/);

    await createCase(admin, caseInput({ responsibleName: "自動建立", responsibleEmail: "auto@example.com" }));
    expect((await authenticate("auto@example.com", PW, {})).ok).toBe(true);

    await changeOwnPassword(eng, PW, "MyNewPass2026");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: eng.id } })).mustChangePassword).toBe(false);
  });
});
