import { makeISODate, type ISODate } from "@/lib/dates";

/**
 * 解析排程甘特圖（Excel）。
 *
 * 版面：某一列為標題（含「學校名稱」），其上方某列為月份（「115/1」「115/2」…，民國年/月），
 * 每所學校一列，右側甘特區依時間順序填入日期（如「5/22」「8/4(上午)」），依序為
 * 派案 → 交初規 → 審查會議 → 會勘。年份由日期所在欄位上方的月份標題決定。
 */

export type Cell = string | Date | null;

export type Period = "上午" | "下午" | "上下午" | null;

export interface ScheduleRow {
  sheet: string;
  rowNumber: number;
  /** 第幾所 */
  order: number | null;
  rocYear: number;
  district: string | null;
  schoolName: string;
  location: string | null;
  extension: string | null;
  unit: string | null;
  contact: string | null;
  notificationDate: ISODate | null;
  preReportDate: ISODate | null;
  reviewMeeting: { date: ISODate; period: Period } | null;
  siteVisit: { date: ISODate; period: Period } | null;
  remarks: string[];
  warnings: string[];
}

const DATE_RE = /^(\d{1,2})\s*[/／]\s*(\d{1,2})\s*(?:[（(]\s*(上午|下午|上下午)\s*[)）])?$/;
const MONTH_HEADER_RE = /^(\d{2,3})\s*[/／]\s*(\d{1,2})$/;

const text = (c: Cell | undefined): string => (c instanceof Date ? "" : (c ?? "").replace(/\s+/g, " ").trim());

const HEADERS: Record<string, keyof Pick<ScheduleRow, "district" | "schoolName" | "location" | "extension" | "unit" | "contact">> = {
  行政區: "district",
  學校名稱: "schoolName",
  學校所在: "location",
  延伸: "extension",
  交工: "unit",
  承辦人: "contact",
};

/** 民國年月份標題：每一欄對應的民國年 */
function yearByColumn(grid: Cell[][], headerRow: number): Map<number, number> | null {
  for (let r = headerRow - 1; r >= 0; r--) {
    const marks: [number, number][] = [];
    (grid[r] ?? []).forEach((c, col) => {
      const m = MONTH_HEADER_RE.exec(text(c));
      if (m) marks.push([col, Number(m[1])]);
    });
    if (marks.length >= 2) {
      const width = Math.max(...grid.map((row) => row.length));
      const map = new Map<number, number>();
      for (let col = 0; col < width; col++) {
        const mark = [...marks].reverse().find(([c]) => c <= col) ?? marks[0];
        map.set(col, mark[1]);
      }
      return map;
    }
  }
  return null;
}

function toISO(rocYear: number, month: number, day: number): ISODate | null {
  const year = rocYear + 1911;
  const d = new Date(Date.UTC(year, month - 1, day));
  if (month < 1 || month > 12 || d.getUTCMonth() !== month - 1) return null;
  return makeISODate(year, month, day);
}

export function parseScheduleGrid(sheet: string, grid: Cell[][]): ScheduleRow[] {
  const headerRow = grid.findIndex((row) => row.some((c) => text(c) === "學校名稱"));
  if (headerRow < 0) return [];
  const cols = new Map<string, number>();
  grid[headerRow]!.forEach((c, col) => {
    const key = HEADERS[text(c)];
    if (key && !cols.has(key)) cols.set(key, col);
  });
  const schoolCol = cols.get("schoolName")!;
  const firstDataCol = Math.max(...cols.values()) + 1;
  const years = yearByColumn(grid, headerRow);

  const rows: ScheduleRow[] = [];
  for (let r = headerRow + 1; r < grid.length; r++) {
    const row = grid[r] ?? [];
    const schoolName = text(row[schoolCol]);
    if (!schoolName || !/(國小|國中|高中|學校|小學|中學)/.test(schoolName)) continue;
    const field = (k: string) => {
      const col = cols.get(k);
      return col === undefined ? null : text(row[col]) || null;
    };
    const orderText = row.slice(0, schoolCol).map(text).find((t) => /^第\s*\d+\s*所$/.test(t));

    const dates: { date: ISODate; period: Period; rocYear: number }[] = [];
    const remarks: string[] = [];
    const warnings: string[] = [];
    for (let col = firstDataCol; col < row.length; col++) {
      const c = row[col];
      if (c instanceof Date) {
        const rocYear = c.getUTCFullYear() - 1911;
        const iso = toISO(rocYear, c.getUTCMonth() + 1, c.getUTCDate());
        if (iso) dates.push({ date: iso, period: null, rocYear });
        continue;
      }
      const t = text(c);
      if (!t) continue;
      const m = DATE_RE.exec(t);
      if (!m) {
        remarks.push(t);
        continue;
      }
      const rocYear = years?.get(col);
      if (!rocYear) {
        warnings.push(`無法判斷「${t}」的年份（找不到月份標題列）`);
        continue;
      }
      const iso = toISO(rocYear, Number(m[1]), Number(m[2]));
      if (!iso) warnings.push(`日期「${t}」不正確`);
      else dates.push({ date: iso, period: (m[3] as Period) ?? null, rocYear });
    }
    if (dates.length < 4) warnings.push(`只找到 ${dates.length} 個日期（應有派案、交初規、審查會議、會勘 4 個）`);
    if (dates.length > 4) warnings.push(`找到 ${dates.length} 個日期，只採用前 4 個`);
    const [n, p, rv, sv] = dates;
    rows.push({
      sheet,
      rowNumber: r + 1,
      order: orderText ? Number(/\d+/.exec(orderText)![0]) : null,
      rocYear: dates[0]?.rocYear ?? years?.get(firstDataCol) ?? 0,
      district: field("district"),
      schoolName,
      location: field("location"),
      extension: field("extension"),
      unit: field("unit"),
      contact: field("contact"),
      notificationDate: n?.date ?? null,
      preReportDate: p?.date ?? null,
      reviewMeeting: rv ? { date: rv.date, period: rv.period } : null,
      siteVisit: sv ? { date: sv.date, period: sv.period } : null,
      remarks,
      warnings,
    });
  }
  return rows;
}

/** 承辦人簡稱（如「珠」）展開為全名（如「麗珠」）：以同批資料或既有案件中唯一相符者為準 */
export function expandContacts(rows: ScheduleRow[], known: string[]): void {
  const pool = [...new Set([...known, ...rows.map((r) => r.contact ?? "")].filter((n) => n.length >= 2))];
  for (const r of rows) {
    if (!r.contact || r.contact.length !== 1) continue;
    const hits = pool.filter((n) => n.includes(r.contact!));
    if (hits.length === 1) r.contact = hits[0]!;
  }
}

/** 同一校名比對用（去除空白） */
export const normalizeSchool = (s: string) => s.replace(/\s+/g, "");

/** 由民國年產生計畫名稱 */
export const projectNameForYear = (rocYear: number) => `${rocYear}年度臺北市通學區規劃分析案`;

/** 審查會議／會勘時間：上午或未註明 10:00，下午 14:00 */
export const timeForPeriod = (p: Period) => (p === "下午" ? "14:00" : "10:00");
