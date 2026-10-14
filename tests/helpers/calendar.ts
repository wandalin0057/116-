import { readFileSync } from "node:fs";
import path from "node:path";
import { BusinessDayService, type CalendarData } from "@/server/business-days/business-day-service";
import { parseCalendarJson } from "@/server/business-days/calendar-import";

/** 以 data/calendars/2026.json（115 年官方辦公日曆）建立測試用日曆 */
export function calendar2026Data(): CalendarData {
  const parsed = parseCalendarJson(readFileSync(path.join(process.cwd(), "data/calendars/2026.json"), "utf8"));
  const data: CalendarData = { years: new Map(), days: new Map(), overrides: new Map() };
  for (const y of parsed.years) {
    data.years.set(y.year, { isComplete: y.isComplete });
    for (const d of y.days) data.days.set(d.date, { kind: d.kind, description: d.description });
  }
  return data;
}

/**
 * 114 年（2025）春節調整放假範例：1/27（一）調整放假、2/8（六）補行上班。
 * 用於驗證補行上班日之計算。
 */
export function withMakeupWorkdayFixture(data: CalendarData): CalendarData {
  const days = new Map(data.days);
  for (const d of ["2025-01-25", "2025-01-26", "2025-01-27", "2025-01-28", "2025-01-29", "2025-01-30", "2025-01-31", "2025-02-01", "2025-02-02"]) {
    days.set(d, { kind: "HOLIDAY", description: "春節連假" });
  }
  days.set("2025-02-08", { kind: "MAKEUP_WORKDAY", description: "補行上班" });
  const years = new Map(data.years);
  years.set(2025, { isComplete: true });
  return { ...data, days, years };
}

export function bds2026() {
  return new BusinessDayService(withMakeupWorkdayFixture(calendar2026Data()));
}
