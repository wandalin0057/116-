import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";

/**
 * 日期工具。
 *
 * 系統以「ISO 日期字串」（YYYY-MM-DD）表示臺灣日曆日，避免時區誤差；
 * 所有「今天」「某時間點屬於哪一天」皆以 Asia/Taipei 判定。
 * 日期加減一律使用曆法運算（UTC 年月日欄位），不以 24 小時毫秒數累加。
 */
export const TAIPEI_TZ = "Asia/Taipei";

/** YYYY-MM-DD */
export type ISODate = string;

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const WEEKDAY_ZH = ["日", "一", "二", "三", "四", "五", "六"] as const;

export function isISODate(value: string): boolean {
  const m = ISO_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

export function parseISODate(value: ISODate): { year: number; month: number; day: number } {
  const m = ISO_RE.exec(value);
  if (!m || !isISODate(value)) throw new Error(`日期格式錯誤：${value}`);
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

export function makeISODate(year: number, month: number, day: number): ISODate {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** 曆法日期加減（不以毫秒數累加） */
export function addCalendarDays(date: ISODate, days: number): ISODate {
  const { year, month, day } = parseISODate(date);
  const dt = new Date(Date.UTC(year, month - 1, day));
  dt.setUTCDate(dt.getUTCDate() + days);
  return makeISODate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

/** 0=週日 … 6=週六 */
export function dayOfWeek(date: ISODate): number {
  const { year, month, day } = parseISODate(date);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function isWeekend(date: ISODate): boolean {
  const dow = dayOfWeek(date);
  return dow === 0 || dow === 6;
}

export function compareISODate(a: ISODate, b: ISODate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function yearOf(date: ISODate): number {
  return parseISODate(date).year;
}

/** 兩日期相差之曆日數（b - a） */
export function diffCalendarDays(a: ISODate, b: ISODate): number {
  const pa = parseISODate(a);
  const pb = parseISODate(b);
  return Math.round((Date.UTC(pb.year, pb.month - 1, pb.day) - Date.UTC(pa.year, pa.month - 1, pa.day)) / 86_400_000);
}

// ── 與資料庫 @db.Date 欄位互轉（以 UTC 00:00 表示日曆日）──

export function isoToDbDate(date: ISODate): Date {
  const { year, month, day } = parseISODate(date);
  return new Date(Date.UTC(year, month - 1, day));
}

export function dbDateToISO(date: Date): ISODate {
  return makeISODate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export function dbDateToISOOrNull(date: Date | null | undefined): ISODate | null {
  return date ? dbDateToISO(date) : null;
}

// ── 臺北時區 ──

/** 某時間點於臺北時區之日曆日 */
export function taipeiDateOf(instant: Date): ISODate {
  const tz = new TZDate(instant.getTime(), TAIPEI_TZ);
  return makeISODate(tz.getFullYear(), tz.getMonth() + 1, tz.getDate());
}

/** 臺北時區今天 */
export function taipeiToday(now: Date = new Date()): ISODate {
  return taipeiDateOf(now);
}

/** 將 `YYYY-MM-DDTHH:mm`（臺北時間，datetime-local 輸入）轉為時間點 */
export function parseTaipeiDateTime(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!m) throw new Error(`日期時間格式錯誤：${value}`);
  const tz = new TZDate(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6] ?? 0), TAIPEI_TZ);
  return new Date(tz.getTime());
}

/** 時間點轉為 datetime-local 輸入值（臺北時間） */
export function toTaipeiDateTimeInput(instant: Date | null | undefined): string {
  if (!instant) return "";
  return format(new TZDate(instant.getTime(), TAIPEI_TZ), "yyyy-MM-dd'T'HH:mm");
}

export function formatTaipeiTime(instant: Date): string {
  return format(new TZDate(instant.getTime(), TAIPEI_TZ), "HH:mm");
}

// ── 民國紀年格式 ──

/** 115年3月5日 */
export function formatROC(date: ISODate | null | undefined): string {
  if (!date) return "";
  const { year, month, day } = parseISODate(date);
  return `${year - 1911}年${month}月${day}日`;
}

/** 115/03/05（四） */
export function formatROCShort(date: ISODate | null | undefined, withWeekday = true): string {
  if (!date) return "—";
  const { year, month, day } = parseISODate(date);
  const base = `${year - 1911}/${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}`;
  return withWeekday ? `${base}（${WEEKDAY_ZH[dayOfWeek(date)]}）` : base;
}

/** 115/03/05（四）14:00 */
export function formatROCDateTime(instant: Date | null | undefined): string {
  if (!instant) return "—";
  return `${formatROCShort(taipeiDateOf(instant))} ${formatTaipeiTime(instant)}`;
}

/** 115年3月5日（星期四）下午2時 等公文常用格式 */
export function formatROCDateTimeLong(instant: Date | null | undefined): string {
  if (!instant) return "";
  const date = taipeiDateOf(instant);
  const tz = new TZDate(instant.getTime(), TAIPEI_TZ);
  const h = tz.getHours();
  const mi = tz.getMinutes();
  const period = h < 12 ? "上午" : "下午";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${formatROC(date)}（星期${WEEKDAY_ZH[dayOfWeek(date)]}）${period}${h12}時${mi ? `${mi}分` : ""}`;
}

export function weekdayZh(date: ISODate): string {
  return WEEKDAY_ZH[dayOfWeek(date)];
}

/** 該日所在週之週一（週一為一週起始） */
export function startOfWeekMonday(date: ISODate): ISODate {
  const dow = dayOfWeek(date);
  return addCalendarDays(date, dow === 0 ? -6 : 1 - dow);
}

export function startOfMonth(date: ISODate): ISODate {
  const { year, month } = parseISODate(date);
  return makeISODate(year, month, 1);
}

export function endOfMonth(date: ISODate): ISODate {
  const { year, month } = parseISODate(date);
  const dt = new Date(Date.UTC(year, month, 0));
  return makeISODate(year, month, dt.getUTCDate());
}

export function daysInYear(year: number): number {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365;
}
