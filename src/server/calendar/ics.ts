import { addCalendarDays, type ISODate } from "@/lib/dates";

/** ICS 行事曆產生（RFC 5545，純函式） */
export interface IcsEvent {
  uid: string;
  date: ISODate;
  /** 有精確時間（會議、會勘）時使用 */
  start?: Date | null;
  durationMinutes?: number;
  summary: string;
  description?: string;
  location?: string | null;
  url?: string;
}

function escapeText(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** 每行最多 75 octets，超過需折行 */
function fold(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let currentBytes = 0;
  for (const ch of line) {
    const b = Buffer.byteLength(ch, "utf8");
    const limit = parts.length === 0 ? 75 : 74;
    if (currentBytes + b > limit) {
      parts.push(current);
      current = "";
      currentBytes = 0;
    }
    current += ch;
    currentBytes += b;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

const ymd = (d: ISODate) => d.replace(/-/g, "");
const utcStamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export function buildIcs(events: IcsEvent[], opts: { calendarName: string; now?: Date }): string {
  const stamp = utcStamp(opts.now ?? new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//School Zone Case Manager//ZH-TW",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(opts.calendarName)}`,
    "X-WR-TIMEZONE:Asia/Taipei",
  ];
  for (const e of events) {
    lines.push("BEGIN:VEVENT", `UID:${e.uid}`, `DTSTAMP:${stamp}`);
    if (e.start) {
      const end = new Date(e.start.getTime() + (e.durationMinutes ?? 120) * 60_000);
      lines.push(`DTSTART:${utcStamp(e.start)}`, `DTEND:${utcStamp(end)}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${ymd(e.date)}`, `DTEND;VALUE=DATE:${ymd(addCalendarDays(e.date, 1))}`);
    }
    lines.push(`SUMMARY:${escapeText(e.summary)}`);
    if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`);
    if (e.location) lines.push(`LOCATION:${escapeText(e.location)}`);
    if (e.url) lines.push(`URL:${e.url}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
