import { describe, expect, it } from "vitest";
import { expandContacts, parseScheduleGrid, type Cell } from "@/server/import/schedule-parser";

const row = (cells: Record<number, Cell>, width = 20): Cell[] => Array.from({ length: width }, (_, i) => cells[i] ?? null);

describe("排程甘特圖解析", () => {
  const grid: Cell[][] = [
    row({ 1: "115年主約" }),
    row({ 5: "115/11", 7: "115/12", 9: "116/1" }),
    row({ 1: "行政區", 2: "學校名稱", 3: "學校所在", 4: "承辦人" }),
    row({ 0: "第1所", 1: "萬華區", 2: "新和國小 ", 3: "新安里", 4: "少穎", 5: "11/20", 6: "12/1", 8: "12/24(下午)", 9: "1/5(上午)", 11: "亮" }),
    row({ 0: "第2所", 1: "信義區", 2: "雙永國小", 4: "珠", 9: "1/8" }),
    row({ 0: "驗收" }),
  ];

  it("依序取得派案、交初規、審查會議、會勘；年份依月份標題（跨年正確）", () => {
    const [a] = parseScheduleGrid("甘特圖", grid);
    expect(a).toMatchObject({
      order: 1,
      rocYear: 115,
      schoolName: "新和國小",
      district: "萬華區",
      location: "新安里",
      contact: "少穎",
      notificationDate: "2026-11-20",
      preReportDate: "2026-12-01",
      reviewMeeting: { date: "2026-12-24", period: "下午" },
      siteVisit: { date: "2027-01-05", period: "上午" },
      remarks: ["亮"],
      warnings: [],
    });
  });

  it("日期不足時提出警告；非學校列（驗收）略過", () => {
    const rows = parseScheduleGrid("甘特圖", grid);
    expect(rows).toHaveLength(2);
    expect(rows[1]!.notificationDate).toBe("2027-01-08");
    expect(rows[1]!.warnings[0]).toMatch(/只找到 1 個日期/);
  });

  it("承辦人簡稱對應唯一全名", () => {
    const rows = parseScheduleGrid("甘特圖", grid);
    expandContacts(rows, ["麗珠", "思蓉"]);
    expect(rows[1]!.contact).toBe("麗珠");
    const amb = parseScheduleGrid("甘特圖", grid);
    expandContacts(amb, ["麗珠", "珠美"]);
    expect(amb[1]!.contact).toBe("珠");
  });

  it("沒有學校名稱標題列時回傳空陣列", () => {
    expect(parseScheduleGrid("x", [row({ 0: "abc" })])).toEqual([]);
  });
});
