import { readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/db";
import { isoToDbDate } from "@/lib/dates";
import { hashPassword } from "@/server/auth/password";
import type { AuthUser } from "@/server/auth/types";
import { parseCalendarJson } from "@/server/business-days/calendar-import";
import { DEFAULT_DEADLINE_RULES } from "@/server/schedule/deadline-rules";

export const hasTestDb = !!process.env.TEST_DATABASE_URL;

export async function resetDatabase() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables.map((t) => `"${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);
  }
}

export async function seedBasics() {
  for (const r of DEFAULT_DEADLINE_RULES) await prisma.deadlineRule.create({ data: r });
  const parsed = parseCalendarJson(readFileSync(path.join(process.cwd(), "data/calendars/2026.json"), "utf8"));
  for (const y of parsed.years) {
    await prisma.calendarYear.create({ data: { year: y.year, isComplete: y.isComplete, source: "test" } });
    await prisma.holidayCalendar.createMany({ data: y.days.map((d) => ({ year: y.year, date: isoToDbDate(d.date), kind: d.kind, description: d.description })) });
  }
}

let pwHash: string | null = null;
export async function makeUser(email: string, role: "ADMIN" | "USER" = "USER", name = email.split("@")[0]): Promise<AuthUser> {
  pwHash ??= await hashPassword("Password1234");
  const u = await prisma.user.create({ data: { email, name, role, passwordHash: pwHash, reminderPreference: { create: {} } } });
  return { id: u.id, email: u.email, name: u.name, role: u.role };
}

export function caseInput(overrides: Record<string, unknown> = {}) {
  return {
    projectCode: "TP-001",
    projectName: "115年度臺北市通學區規劃分析案",
    schoolName: "仁愛國小",
    district: "大安區",
    agencyName: "臺北市政府交通局",
    agencyContact: "張承辦",
    agencyEmail: "agency@example.com",
    responsibleUserId: "",
    notificationDate: "2026-10-14",
    reviewMeetingDateTime: "2026-10-22T14:00",
    reviewMeetingLocation: "交通局會議室",
    siteVisitDateTime: "",
    siteVisitLocation: "",
    siteVisitUploadUrl: "",
    status: "ACTIVE",
    notes: "",
    ...overrides,
  } as const;
}
