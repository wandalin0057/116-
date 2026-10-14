import { describe, expect, it } from "vitest";
import { addCalendarDays, dayOfWeek, makeISODate } from "@/lib/dates";
import { normalizeDate, parseCalendarCsv, parseCalendarFile, parseCalendarJson } from "@/server/business-days/calendar-import";

function fullYearOfficialCsv(year: number, holidays: Record<string, string>, workdays: string[] = []) {
  const rows = ["西元日期,星期,是否放假,備註"];
  const wk = ["日", "一", "二", "三", "四", "五", "六"];
  let d = makeISODate(year, 1, 1);
  while (d.startsWith(String(year))) {
    const dow = dayOfWeek(d);
    const weekend = dow === 0 || dow === 6;
    const off = holidays[d] !== undefined ? true : workdays.includes(d) ? false : weekend;
    rows.push(`${d.replace(/-/g, "")},${wk[dow]},${off ? 2 : 0},${holidays[d] ?? (workdays.includes(d) ? "補行上班" : "")}`);
    d = addCalendarDays(d, 1);
  }
  return rows.join("\n");
}

describe("辦公日曆匯入", () => {
  it("解析官方逐日 CSV，涵蓋全年時視為完整日曆", () => {
    const csv = fullYearOfficialCsv(2027, { "2027-01-01": "開國紀念日" }, ["2027-01-09"]);
    const parsed = parseCalendarCsv("﻿" + csv);
    expect(parsed.format).toBe("OFFICIAL_FULL_YEAR");
    expect(parsed.years[0].year).toBe(2027);
    expect(parsed.years[0].isComplete).toBe(true);
    expect(parsed.years[0].days).toContainEqual({ date: "2027-01-01", kind: "HOLIDAY", description: "開國紀念日" });
    expect(parsed.years[0].days).toContainEqual({ date: "2027-01-09", kind: "MAKEUP_WORKDAY", description: "補行上班" });
  });

  it("不完整之官方 CSV 標示為非完整並提出警示", () => {
    const parsed = parseCalendarCsv("西元日期,星期,是否放假,備註\n20270101,五,2,開國紀念日\n20270104,一,0,");
    expect(parsed.years[0].isComplete).toBe(false);
    expect(parsed.warnings.join()).toContain("暫估");
  });

  it("解析簡易 CSV 與 JSON", () => {
    const csv = parseCalendarFile("x.csv", "date,type,description\n2027-02-08,放假,春節\n2027-02-20,補行上班,補班", { declaredComplete: true });
    expect(csv.years[0].days.map((d) => d.kind)).toEqual(["HOLIDAY", "MAKEUP_WORKDAY"]);
    expect(csv.years[0].isComplete).toBe(true);
    const json = parseCalendarJson(JSON.stringify({ year: 2027, isComplete: false, days: [{ date: "2027-01-01", kind: "HOLIDAY", description: "元旦" }] }));
    expect(json.years[0]).toMatchObject({ year: 2027, isComplete: false });
  });

  it("日期格式正規化（西元、民國）", () => {
    expect(normalizeDate("20260101")).toBe("2026-01-01");
    expect(normalizeDate("2026/1/2")).toBe("2026-01-02");
    expect(normalizeDate("115/1/3")).toBe("2026-01-03");
    expect(normalizeDate("2026-02-30")).toBeNull();
  });

  it("無法辨識之欄位回報錯誤", () => {
    expect(() => parseCalendarCsv("a,b\n1,2")).toThrow(/無法辨識/);
  });
});
