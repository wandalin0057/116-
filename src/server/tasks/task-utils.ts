import type { TaskStatus } from "@prisma/client";
import { dbDateToISOOrNull, type ISODate } from "@/lib/dates";
import type { BusinessDayService } from "@/server/business-days/business-day-service";

export function effectiveDueDate(t: { overrideDueDate: Date | null; calculatedDueDate: Date | null }): ISODate | null {
  return dbDateToISOOrNull(t.overrideDueDate ?? t.calculatedDueDate);
}

export function isOpenStatus(status: TaskStatus) {
  return status !== "COMPLETED" && status !== "CANCELLED";
}

export interface DueInfo {
  dueDate: ISODate | null;
  /** 今日至期限之工作天數；負數表示逾期工作天數 */
  remainingBusinessDays: number | null;
  isOverdue: boolean;
  isLocked: boolean;
}

export function computeDueInfo(
  t: { overrideDueDate: Date | null; calculatedDueDate: Date | null; status: TaskStatus },
  bds: BusinessDayService,
  today: ISODate,
): DueInfo {
  const dueDate = effectiveDueDate(t);
  if (!dueDate) return { dueDate: null, remainingBusinessDays: null, isOverdue: false, isLocked: !!t.overrideDueDate };
  const remaining = bds.businessDaysBetween(today, dueDate);
  return {
    dueDate,
    remainingBusinessDays: remaining,
    isOverdue: isOpenStatus(t.status) && dueDate < today,
    isLocked: !!t.overrideDueDate,
  };
}
