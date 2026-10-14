import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { dbDateToISO } from "@/lib/dates";
import { createCase, previewCaseUpdate, updateCase } from "@/server/cases/case-service";
import { completeTask, setTaskOverride } from "@/server/tasks/task-service";
import { syncCaseTasks } from "@/server/schedule/task-sync";
import { caseInput, hasTestDb, makeUser, resetDatabase, seedBasics } from "../helpers/db";

const dueOf = async (caseId: string, taskType: string) => {
  const t = await prisma.task.findFirstOrThrow({ where: { caseId, taskType: taskType as never } });
  return { ...t, due: t.calculatedDueDate ? dbDateToISO(t.calculatedDueDate) : null };
};

describe.skipIf(!hasTestDb)("案件期程同步（資料庫）", () => {
  beforeEach(async () => {
    await resetDatabase();
    await seedBasics();
  });

  it("建立案件時依規則建立工作，且不重複建立", async () => {
    const u = await makeUser("pm@example.com");
    const { schoolCase } = await createCase(u, caseInput({ responsibleUserId: u.id }));
    const tasks = await prisma.task.findMany({ where: { caseId: schoolCase.id } });
    // 通知日 2 項 + 審查會議 5 項
    expect(tasks).toHaveLength(7);
    expect((await dueOf(schoolCase.id, "PRE_REPORT_DISPATCH")).due).toBe("2026-11-02");
    expect((await dueOf(schoolCase.id, "PRE_REPORT_DRAFT")).due).toBe("2026-10-30");
    await syncCaseTasks(schoolCase.id, { actorId: u.id, source: "MANUAL_RECALC" });
    await syncCaseTasks(schoolCase.id, { actorId: u.id, source: "MANUAL_RECALC" });
    expect(await prisma.task.count({ where: { caseId: schoolCase.id } })).toBe(7);
  });

  it("10. 變更會議日期後期限正確更新，並保留異動歷史與差異預覽", async () => {
    const u = await makeUser("pm@example.com");
    const { schoolCase } = await createCase(u, caseInput({ responsibleUserId: u.id }));
    expect((await dueOf(schoolCase.id, "REVIEW_MINUTES_EMAIL")).due).toBe("2026-10-23");

    const preview = await previewCaseUpdate(u, schoolCase.id, caseInput({ responsibleUserId: u.id, reviewMeetingDateTime: "2026-10-29T10:00" }));
    expect(preview.find((c) => c.taskType === "REVIEW_MINUTES_EMAIL")).toMatchObject({ action: "UPDATE", previousDate: "2026-10-23", newDate: "2026-10-30" });
    // 預覽不寫入
    expect((await dueOf(schoolCase.id, "REVIEW_MINUTES_EMAIL")).due).toBe("2026-10-23");

    await updateCase(u, schoolCase.id, caseInput({ responsibleUserId: u.id, reviewMeetingDateTime: "2026-10-29T10:00", dateChangeReason: "機關改期" }));
    expect((await dueOf(schoolCase.id, "REVIEW_SLIDES_EMAIL")).due).toBe("2026-10-27");
    expect((await dueOf(schoolCase.id, "REVIEW_MINUTES_EMAIL")).due).toBe("2026-10-30");
    expect((await dueOf(schoolCase.id, "REVIEW_DRAWING_DISPATCH")).due).toBe("2026-11-03");

    const t = await dueOf(schoolCase.id, "REVIEW_MINUTES_EMAIL");
    const history = await prisma.taskDueDateHistory.findMany({ where: { taskId: t.id, changeSource: "CASE_DATE_CHANGE" } });
    expect(history).toHaveLength(1);
    expect(history[0].reason).toBe("機關改期");
    const meetings = await prisma.meeting.findMany({ where: { caseId: schoolCase.id }, orderBy: { createdAt: "asc" } });
    expect(meetings.map((m) => m.status)).toEqual(["RESCHEDULED", "SCHEDULED"]);
    expect(await prisma.auditLog.count({ where: { action: "CASE_DATE_CHANGE" } })).toBe(1);
    expect(await prisma.task.count({ where: { caseId: schoolCase.id } })).toBe(7);
  });

  it("11. 已完成工作不會被重新設定為未完成，期限亦不變", async () => {
    const u = await makeUser("pm@example.com");
    const { schoolCase } = await createCase(u, caseInput({ responsibleUserId: u.id }));
    const slides = await dueOf(schoolCase.id, "REVIEW_SLIDES_EMAIL");
    await completeTask(u, slides.id);
    await updateCase(u, schoolCase.id, caseInput({ responsibleUserId: u.id, reviewMeetingDateTime: "2026-11-05T10:00" }));
    const after = await dueOf(schoolCase.id, "REVIEW_SLIDES_EMAIL");
    expect(after.status).toBe("COMPLETED");
    expect(after.actualCompletedAt).not.toBeNull();
    expect(after.due).toBe("2026-10-20");
    // 未完成之工作則更新
    expect((await dueOf(schoolCase.id, "REVIEW_MINUTES_EMAIL")).due).toBe("2026-11-06");
  });

  it("人工鎖定之期限不被日期變更覆蓋，創稿期限連動鎖定日", async () => {
    const u = await makeUser("pm@example.com");
    const { schoolCase } = await createCase(u, caseInput({ responsibleUserId: u.id }));
    const dispatch = await dueOf(schoolCase.id, "PRE_REPORT_DISPATCH");
    await expect(setTaskOverride(u, dispatch.id, { overrideDueDate: "2026-11-10" })).rejects.toThrow(/原因/);
    await setTaskOverride(u, dispatch.id, { overrideDueDate: "2026-11-10", overrideReason: "機關要求延後" });
    expect((await dueOf(schoolCase.id, "PRE_REPORT_DRAFT")).due).toBe("2026-11-09");
    await updateCase(u, schoolCase.id, caseInput({ responsibleUserId: u.id, notificationDate: "2026-10-15" }));
    const locked = await dueOf(schoolCase.id, "PRE_REPORT_DISPATCH");
    expect(dbDateToISO(locked.overrideDueDate!)).toBe("2026-11-10");
    expect(locked.due).toBe("2026-11-02");
  });

  it("日期可分次填寫：補填會勘日期後才建立會勘工作", async () => {
    const u = await makeUser("pm@example.com");
    const { schoolCase } = await createCase(u, caseInput({ responsibleUserId: u.id, reviewMeetingDateTime: "" }));
    expect(await prisma.task.count({ where: { caseId: schoolCase.id } })).toBe(2);
    await updateCase(u, schoolCase.id, caseInput({ responsibleUserId: u.id, reviewMeetingDateTime: "", siteVisitDateTime: "2026-11-11T09:30" }));
    expect((await dueOf(schoolCase.id, "SITE_VISIT_SLIDES_UPLOAD")).due).toBe("2026-11-09");
    expect(await prisma.task.count({ where: { caseId: schoolCase.id } })).toBe(7);
  });

  it("案件編號不得重複", async () => {
    const u = await makeUser("pm@example.com");
    await createCase(u, caseInput({ responsibleUserId: u.id }));
    await expect(createCase(u, caseInput({ responsibleUserId: u.id, projectCode: "tp-001" }))).rejects.toThrow(/案件編號已存在/);
  });
});
