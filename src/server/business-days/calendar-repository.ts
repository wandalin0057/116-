import { prisma } from "@/lib/db";
import { dbDateToISO, type ISODate } from "@/lib/dates";
import { BusinessDayService, type CalendarData, type CalendarDayEntry } from "./business-day-service";

/** 由資料庫載入工作日曆並建立 BusinessDayService */
export async function loadCalendarData(): Promise<CalendarData> {
  const [years, days, overrides] = await Promise.all([
    prisma.calendarYear.findMany(),
    prisma.holidayCalendar.findMany(),
    prisma.businessDayOverride.findMany(),
  ]);
  return {
    years: new Map(years.map((y) => [y.year, { isComplete: y.isComplete, source: y.source }])),
    days: new Map<ISODate, CalendarDayEntry>(days.map((d) => [dbDateToISO(d.date), { kind: d.kind, description: d.description }])),
    overrides: new Map(
      overrides.map((o) => [dbDateToISO(o.date), { kind: o.kind, description: o.reason, reason: o.reason }]),
    ),
  };
}

export async function loadBusinessDayService(): Promise<BusinessDayService> {
  return new BusinessDayService(await loadCalendarData());
}
