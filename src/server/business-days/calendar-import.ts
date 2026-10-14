import Papa from "papaparse";
import { daysInYear, isISODate, isWeekend, makeISODate, yearOf, type ISODate } from "@/lib/dates";
import type { CalendarDayKind } from "./business-day-service";

/**
 * 年度辦公日曆匯入解析（CSV / JSON），純函式可獨立測試。
 *
 * 支援格式：
 * 1. 政府資料開放平臺「中華民國政府行政機關辦公日曆表」CSV
 *    欄位：西元日期, 星期, 是否放假, 備註（是否放假：2=放假、0=上班；逐日列出全年）
 * 2. 簡易 CSV：date,type,description（type：HOLIDAY/放假、MAKEUP_WORKDAY/補行上班）
 * 3. JSON：{ year, isComplete, source, days: [{ date, kind | isHoliday, description }] }
 *    或官方格式物件陣列 [{ 西元日期, 是否放假, 備註 }]
 */

export interface ParsedCalendarDay {
  date: ISODate;
  kind: CalendarDayKind;
  description: string | null;
}

export interface ParsedCalendarYear {
  year: number;
  days: ParsedCalendarDay[];
  /** 檔案中出現之日期數（逐日格式時可判斷是否涵蓋全年） */
  coveredDays: number;
  isComplete: boolean;
}

export interface ParsedCalendar {
  years: ParsedCalendarYear[];
  warnings: string[];
  format: "OFFICIAL_FULL_YEAR" | "EXCEPTIONS_ONLY";
  source?: string;
}

interface RawRow {
  date: ISODate;
  /** true=放假、false=上班 */
  isHoliday: boolean;
  description: string | null;
}

export function normalizeDate(raw: string): ISODate | null {
  const s = raw.trim();
  let m = /^(\d{4})(\d{2})(\d{2})$/.exec(s);
  if (!m) m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(s);
  if (m) {
    const iso = makeISODate(Number(m[1]), Number(m[2]), Number(m[3]));
    return isISODate(iso) ? iso : null;
  }
  // 民國年：115/1/1 或 1150101
  m = /^(\d{2,3})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(s) ?? /^(\d{3})(\d{2})(\d{2})$/.exec(s);
  if (m) {
    const iso = makeISODate(Number(m[1]) + 1911, Number(m[2]), Number(m[3]));
    return isISODate(iso) ? iso : null;
  }
  return null;
}

function parseHolidayFlag(raw: unknown): boolean | null {
  if (typeof raw === "boolean") return raw;
  const s = String(raw ?? "").trim().toUpperCase();
  if (["2", "TRUE", "Y", "YES", "放假", "HOLIDAY", "休"].includes(s)) return true;
  if (["0", "FALSE", "N", "NO", "上班", "WORKDAY", "MAKEUP_WORKDAY", "補行上班", "補班"].includes(s)) return false;
  return null;
}

function parseKind(raw: unknown): CalendarDayKind | null {
  const s = String(raw ?? "").trim().toUpperCase();
  if (["HOLIDAY", "放假", "休假", "假日", "2"].includes(s)) return "HOLIDAY";
  if (["MAKEUP_WORKDAY", "WORKDAY", "補行上班", "補班", "上班", "0"].includes(s)) return "MAKEUP_WORKDAY";
  return null;
}

/** 由逐日資料轉為「例外日」清單 */
function rowsToYears(rows: RawRow[], warnings: string[], fullYear: boolean, declaredComplete: boolean): ParsedCalendarYear[] {
  const byYear = new Map<number, Map<ISODate, RawRow>>();
  for (const r of rows) {
    const y = yearOf(r.date);
    if (!byYear.has(y)) byYear.set(y, new Map());
    const map = byYear.get(y)!;
    if (map.has(r.date)) warnings.push(`日期重複：${r.date}，以最後一筆為準`);
    map.set(r.date, r);
  }
  const result: ParsedCalendarYear[] = [];
  for (const [year, map] of [...byYear.entries()].sort((a, b) => a[0] - b[0])) {
    const days: ParsedCalendarDay[] = [];
    for (const r of [...map.values()].sort((a, b) => (a.date < b.date ? -1 : 1))) {
      const weekend = isWeekend(r.date);
      if (r.isHoliday && !weekend) days.push({ date: r.date, kind: "HOLIDAY", description: r.description });
      else if (!r.isHoliday && weekend) days.push({ date: r.date, kind: "MAKEUP_WORKDAY", description: r.description ?? "補行上班" });
      else if (r.isHoliday && weekend && r.description) days.push({ date: r.date, kind: "HOLIDAY", description: r.description });
      else if (!r.isHoliday && !weekend && !fullYear) warnings.push(`${r.date} 為平日且標示上班，已忽略`);
    }
    const coveredDays = map.size;
    const isComplete = fullYear ? coveredDays === daysInYear(year) : declaredComplete;
    if (fullYear && !isComplete) {
      warnings.push(`${year} 年僅包含 ${coveredDays} 天（全年 ${daysInYear(year)} 天），將標示為非完整日曆，期限為暫估`);
    }
    result.push({ year, days, coveredDays, isComplete });
  }
  return result;
}

export function parseCalendarCsv(text: string, options: { declaredComplete?: boolean } = {}): ParsedCalendar {
  const warnings: string[] = [];
  const clean = text.replace(/^﻿/, "");
  const parsed = Papa.parse<Record<string, string>>(clean, { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim() });
  if (parsed.errors.length) {
    for (const e of parsed.errors.slice(0, 5)) warnings.push(`CSV 第 ${(e.row ?? 0) + 2} 列：${e.message}`);
  }
  const headers = parsed.meta.fields ?? [];
  const rows: RawRow[] = [];

  const officialDateKey = headers.find((h) => h === "西元日期" || h === "日期");
  const officialFlagKey = headers.find((h) => h === "是否放假");
  if (officialDateKey && officialFlagKey) {
    const descKey = headers.find((h) => h === "備註" || h === "說明");
    parsed.data.forEach((row, idx) => {
      const date = normalizeDate(row[officialDateKey] ?? "");
      const flag = parseHolidayFlag(row[officialFlagKey]);
      if (!date || flag === null) {
        warnings.push(`第 ${idx + 2} 列資料無法解析，已略過`);
        return;
      }
      const desc = (descKey ? row[descKey] : "")?.trim() || null;
      rows.push({ date, isHoliday: flag, description: desc });
    });
    if (!rows.length) throw new Error("CSV 沒有可匯入的日期資料");
    return { years: rowsToYears(rows, warnings, true, false), warnings, format: "OFFICIAL_FULL_YEAR" };
  }

  const dateKey = headers.find((h) => /^date$/i.test(h));
  const typeKey = headers.find((h) => /^(type|kind)$/i.test(h));
  if (!dateKey || !typeKey) {
    throw new Error("無法辨識 CSV 欄位。請使用官方格式（西元日期,星期,是否放假,備註）或 date,type,description");
  }
  const descKey = headers.find((h) => /^(description|name|note)$/i.test(h));
  parsed.data.forEach((row, idx) => {
    const date = normalizeDate(row[dateKey] ?? "");
    const kind = parseKind(row[typeKey]);
    if (!date || !kind) {
      warnings.push(`第 ${idx + 2} 列資料無法解析，已略過`);
      return;
    }
    rows.push({ date, isHoliday: kind === "HOLIDAY", description: (descKey ? row[descKey] : "")?.trim() || null });
  });
  if (!rows.length) throw new Error("CSV 沒有可匯入的日期資料");
  return { years: rowsToYears(rows, warnings, false, options.declaredComplete ?? false), warnings, format: "EXCEPTIONS_ONLY" };
}

export function parseCalendarJson(text: string, options: { declaredComplete?: boolean } = {}): ParsedCalendar {
  let data: unknown;
  try {
    data = JSON.parse(text.replace(/^﻿/, ""));
  } catch {
    throw new Error("JSON 格式錯誤");
  }
  const warnings: string[] = [];

  // 官方格式陣列
  if (Array.isArray(data)) {
    const rows: RawRow[] = [];
    data.forEach((item: Record<string, unknown>, idx) => {
      const date = normalizeDate(String(item["西元日期"] ?? item["date"] ?? ""));
      const flag = parseHolidayFlag(item["是否放假"] ?? item["isHoliday"]);
      if (!date || flag === null) {
        warnings.push(`第 ${idx + 1} 筆資料無法解析，已略過`);
        return;
      }
      rows.push({ date, isHoliday: flag, description: String(item["備註"] ?? item["description"] ?? "").trim() || null });
    });
    if (!rows.length) throw new Error("JSON 沒有可匯入的日期資料");
    return { years: rowsToYears(rows, warnings, true, false), warnings, format: "OFFICIAL_FULL_YEAR" };
  }

  if (!data || typeof data !== "object" || !Array.isArray((data as { days?: unknown }).days)) {
    throw new Error("JSON 需包含 days 陣列");
  }
  const obj = data as { year?: number; isComplete?: boolean; source?: string; days: Record<string, unknown>[] };
  const rows: RawRow[] = [];
  obj.days.forEach((item, idx) => {
    const date = normalizeDate(String(item.date ?? ""));
    let isHoliday: boolean | null = null;
    if (item.kind !== undefined) {
      const k = parseKind(item.kind);
      isHoliday = k === null ? null : k === "HOLIDAY";
    } else if (item.isHoliday !== undefined) {
      isHoliday = parseHolidayFlag(item.isHoliday);
    }
    if (!date || isHoliday === null) {
      warnings.push(`第 ${idx + 1} 筆資料無法解析，已略過`);
      return;
    }
    if (obj.year && yearOf(date) !== obj.year) warnings.push(`${date} 不屬於 ${obj.year} 年`);
    rows.push({ date, isHoliday, description: String(item.description ?? item.name ?? "").trim() || null });
  });
  const declared = obj.isComplete === true || options.declaredComplete === true;
  const years = rowsToYears(rows, warnings, false, declared);
  // 若宣告年度但無任何例外日（理論上不會發生），仍建立年度紀錄
  if (obj.year && !years.find((y) => y.year === obj.year)) {
    years.push({ year: obj.year, days: [], coveredDays: 0, isComplete: declared });
  }
  return { years, warnings, format: "EXCEPTIONS_ONLY", source: obj.source };
}

export function parseCalendarFile(fileName: string, text: string, options: { declaredComplete?: boolean } = {}): ParsedCalendar {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".json")) return parseCalendarJson(text, options);
  if (lower.endsWith(".csv") || lower.endsWith(".txt")) return parseCalendarCsv(text, options);
  const trimmed = text.trim();
  return trimmed.startsWith("{") || trimmed.startsWith("[") ? parseCalendarJson(text, options) : parseCalendarCsv(text, options);
}
