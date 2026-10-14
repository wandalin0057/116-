import { addCalendarDays, compareISODate, isWeekend, yearOf, type ISODate } from "@/lib/dates";

export type CalendarDayKind = "HOLIDAY" | "MAKEUP_WORKDAY";

export interface CalendarDayEntry {
  kind: CalendarDayKind;
  description?: string | null;
}

export interface CalendarData {
  /** 已匯入之年度；isComplete=false 表示非官方完整日曆 */
  years: Map<number, { isComplete: boolean; source?: string }>;
  /** 官方日曆：與預設（平日上班、週末放假）不同之日期 */
  days: Map<ISODate, CalendarDayEntry>;
  /** 管理員手動調整（優先於官方日曆） */
  overrides: Map<ISODate, CalendarDayEntry & { reason?: string }>;
}

export type DayReason =
  | "WEEKDAY"
  | "WEEKEND"
  | "HOLIDAY"
  | "MAKEUP_WORKDAY"
  | "OVERRIDE_HOLIDAY"
  | "OVERRIDE_WORKDAY";

export interface DayInfo {
  date: ISODate;
  isBusinessDay: boolean;
  reason: DayReason;
  description: string | null;
  /** 該日所屬年度未取得完整官方日曆 */
  estimated: boolean;
}

export interface BusinessDayResult {
  date: ISODate;
  /** 計算過程經過未取得完整官方日曆之年度，結果為暫估 */
  estimated: boolean;
}

const MAX_SEARCH_DAYS = 3660;

/**
 * 工作天計算服務（純函式，無資料庫相依，可獨立測試）。
 *
 * 規則：
 *  - 週六、週日不上班
 *  - 官方公告之休假日不上班；補行上班日需上班
 *  - 管理員手動調整優先
 *  - 事件當日為 D0，不計入前後工作天
 *  - 未取得完整年度官方日曆者，僅依週末規則推算並標示「暫估」，不自行猜測假日
 */
export class BusinessDayService {
  constructor(private readonly data: CalendarData) {}

  static empty(): BusinessDayService {
    return new BusinessDayService({ years: new Map(), days: new Map(), overrides: new Map() });
  }

  isYearComplete(year: number): boolean {
    return this.data.years.get(year)?.isComplete === true;
  }

  getDayInfo(date: ISODate): DayInfo {
    const estimated = !this.isYearComplete(yearOf(date));
    const override = this.data.overrides.get(date);
    if (override) {
      return {
        date,
        isBusinessDay: override.kind === "MAKEUP_WORKDAY",
        reason: override.kind === "MAKEUP_WORKDAY" ? "OVERRIDE_WORKDAY" : "OVERRIDE_HOLIDAY",
        description: override.description ?? override.reason ?? null,
        estimated,
      };
    }
    const official = this.data.days.get(date);
    if (official) {
      return {
        date,
        isBusinessDay: official.kind === "MAKEUP_WORKDAY",
        reason: official.kind,
        description: official.description ?? null,
        estimated,
      };
    }
    const weekend = isWeekend(date);
    return { date, isBusinessDay: !weekend, reason: weekend ? "WEEKEND" : "WEEKDAY", description: null, estimated };
  }

  isBusinessDay(date: ISODate): boolean {
    return this.getDayInfo(date).isBusinessDay;
  }

  /**
   * 以 D0 為基準，往後（n>0）或往前（n<0）第 |n| 個工作天。
   * n=0 時回傳 D0 本身（事件當日）。
   */
  addBusinessDays(date: ISODate, n: number): BusinessDayResult {
    if (!Number.isInteger(n)) throw new Error("工作天數必須為整數");
    let estimated = false;
    if (n === 0) return { date, estimated: !this.isYearComplete(yearOf(date)) };
    const step = n > 0 ? 1 : -1;
    let remaining = Math.abs(n);
    let cursor = date;
    let guard = 0;
    while (remaining > 0) {
      cursor = addCalendarDays(cursor, step);
      const info = this.getDayInfo(cursor);
      if (info.estimated) estimated = true;
      if (info.isBusinessDay) remaining -= 1;
      if (++guard > MAX_SEARCH_DAYS) throw new Error("工作天計算超出範圍");
    }
    return { date: cursor, estimated };
  }

  /**
   * 自 from（不含）至 to（含）之工作天數；to 早於 from 時為負值。
   * 用於「剩餘工作天」：今日至期限日之工作天數，期限日為今日時為 0。
   */
  businessDaysBetween(from: ISODate, to: ISODate): number {
    const cmp = compareISODate(from, to);
    if (cmp === 0) return 0;
    // 計算 (較早日, 較晚日] 區間之工作天數；逾期時回傳負值
    const [start, end] = cmp < 0 ? [from, to] : [to, from];
    let cursor = start;
    let count = 0;
    let guard = 0;
    while (cursor !== end) {
      cursor = addCalendarDays(cursor, 1);
      if (this.isBusinessDay(cursor)) count += 1;
      if (++guard > MAX_SEARCH_DAYS) throw new Error("工作天計算超出範圍");
    }
    return cmp < 0 ? count : -count;
  }

  /** 列出期間內之所有日期資訊（含頭尾） */
  listDays(from: ISODate, to: ISODate): DayInfo[] {
    const out: DayInfo[] = [];
    let cursor = from;
    let guard = 0;
    while (compareISODate(cursor, to) <= 0) {
      out.push(this.getDayInfo(cursor));
      cursor = addCalendarDays(cursor, 1);
      if (++guard > MAX_SEARCH_DAYS) break;
    }
    return out;
  }

  /** 期間內是否有任何年度未取得完整官方日曆 */
  hasIncompleteYearBetween(from: ISODate, to: ISODate): boolean {
    const [a, b] = compareISODate(from, to) <= 0 ? [yearOf(from), yearOf(to)] : [yearOf(to), yearOf(from)];
    for (let y = a; y <= b; y++) if (!this.isYearComplete(y)) return true;
    return false;
  }

  /** 回傳新的服務實例（不修改原資料），用於日曆異動前之差異預覽 */
  withData(patch: Partial<CalendarData>): BusinessDayService {
    return new BusinessDayService({
      years: patch.years ?? this.data.years,
      days: patch.days ?? this.data.days,
      overrides: patch.overrides ?? this.data.overrides,
    });
  }

  getData(): CalendarData {
    return this.data;
  }
}
