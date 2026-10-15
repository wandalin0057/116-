import ExcelJS from "exceljs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { createCase } from "@/server/cases/case-service";
import { applyScheduleImport, previewScheduleImport } from "@/server/import/schedule-import";
import { caseInput, hasTestDb, makeUser, resetDatabase, seedBasics } from "../helpers/db";

async function workbook(): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("甘特圖");
  ws.getCell("F2").value = "115/9";
  ws.getCell("H2").value = "115/10";
  ws.mergeCells("F2:G2");
  ["行政區", "學校名稱", "學校所在", "承辦人"].forEach((h, i) => (ws.getRow(3).getCell(2 + i).value = h));
  const put = (r: number, v: Record<string, string>) => Object.entries(v).forEach(([c, x]) => (ws.getCell(`${c}${r}`).value = x));
  put(4, { A: "第1所", B: "文山區", C: "辛亥國小 ", D: "興昌里", E: "少穎", F: "9/21", H: "10/12", I: "10/16", J: "10/26(下午)" });
  // 合併儲存格只取一次
  ws.mergeCells("I4:I4");
  put(5, { A: "第2所", B: "萬華區", C: "萬大國小", E: "少", F: "9/30", H: "10/21", I: "10/23", J: "10/30" });
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

describe.skipIf(!hasTestDb)("排程表匯入", () => {
  beforeEach(async () => {
    vi.useRealTimers();
    await resetDatabase();
    await seedBasics();
  });

  it("新增與更新案件、交初規鎖定發文期限、過去工作標記完成", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-15T02:00:00Z"));
    const admin = await makeUser("admin@example.com", "ADMIN");
    // 既有案件：辛亥國小（同計畫）→ 應更新而非重複建立
    await createCase(admin, caseInput({ projectCode: "X-1", schoolName: "辛亥國小", responsibleUserId: admin.id, reviewMeetingDateTime: "2026-10-16T14:30" }));
    const files = [{ name: "115排程.xlsx", data: await workbook() }];

    const preview = await previewScheduleImport(files);
    expect(preview.map((r) => [r.schoolName, r.action, r.contact])).toEqual([
      ["辛亥國小", "UPDATE", "少穎"],
      ["萬大國小", "CREATE", "少穎"],
    ]);

    const results = await applyScheduleImport(admin, files, { completePast: true });
    expect(results.map((r) => r.action)).toEqual(["UPDATED", "CREATED"]);

    const hsin = await prisma.schoolCase.findUniqueOrThrow({ where: { projectCode: "X-1" } });
    expect(hsin.notificationDate?.toISOString().slice(0, 10)).toBe("2026-09-21");
    // 同一天保留原時間
    expect(hsin.reviewMeetingDateTime?.toISOString()).toBe("2026-10-16T06:30:00.000Z");
    // 下午 → 14:00
    expect(hsin.siteVisitDateTime?.toISOString()).toBe("2026-10-26T06:00:00.000Z");
    expect(hsin.agencyContact).toBe("少穎");

    const wanda = await prisma.schoolCase.findFirstOrThrow({ where: { schoolName: "萬大國小" } });
    expect(wanda.projectCode).toBe("115-02");
    expect(wanda.projectName).toBe("115年度臺北市通學區規劃分析案");
    expect(wanda.reviewMeetingDateTime?.toISOString()).toBe("2026-10-23T02:00:00.000Z");

    const dispatch = await prisma.task.findUniqueOrThrow({ where: { caseId_taskType: { caseId: wanda.id, taskType: "PRE_REPORT_PROVIDE" } } });
    expect(dispatch.overrideDueDate?.toISOString().slice(0, 10)).toBe("2026-10-21");
    expect(dispatch.overrideReason).toMatch(/交初規/);

    const tasks = await prisma.task.findMany({ where: { caseId: hsin.id } });
    for (const t of tasks) {
      const due = (t.overrideDueDate ?? t.calculatedDueDate)?.toISOString().slice(0, 10);
      if (due && due < "2026-10-15") expect(t.status).toBe("COMPLETED");
      if (due && due >= "2026-10-15") expect(t.status).toBe("NOT_STARTED");
    }

    // 再匯入一次不會重複建立
    await applyScheduleImport(admin, files, { completePast: true });
    expect(await prisma.schoolCase.count()).toBe(2);
    vi.useRealTimers();
  });

  it("非 Excel 或沒有排程資料時提示錯誤", async () => {
    await expect(previewScheduleImport([{ name: "a.csv", data: new ArrayBuffer(1) }])).rejects.toThrow(/xlsx/);
    await expect(previewScheduleImport([{ name: "a.xlsx", data: new TextEncoder().encode("abc").buffer }])).rejects.toThrow(/無法讀取/);
  });
});
