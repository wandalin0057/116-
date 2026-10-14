/**
 * 資料庫初始化：期限規則、預設範本、115 年辦公日曆、（選用）初始管理員與示範資料。
 * 可重複執行（冪等）。
 *
 *   npm run db:seed
 *   INITIAL_ADMIN_EMAIL=... INITIAL_ADMIN_PASSWORD=... INITIAL_ADMIN_NAME=... npm run db:seed
 *   SEED_DEMO=true npm run db:seed   # 另建立示範使用者與案件（僅限測試環境）
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { isoToDbDate } from "../src/lib/dates";
import { parseCalendarJson } from "../src/server/business-days/calendar-import";
import { DEFAULT_DEADLINE_RULES } from "../src/server/schedule/deadline-rules";
import { ALL_DEFAULT_TEMPLATES } from "../src/server/templates/default-templates";
import { hashPassword, validatePasswordStrength } from "../src/server/auth/password";

const prisma = new PrismaClient();

async function seedRules() {
  for (const r of DEFAULT_DEADLINE_RULES) {
    await prisma.deadlineRule.upsert({ where: { taskType: r.taskType }, create: r, update: {} });
  }
  console.log(`✓ 期限規則 ${DEFAULT_DEADLINE_RULES.length} 筆`);
}

async function seedTemplates() {
  for (const t of ALL_DEFAULT_TEMPLATES) {
    const exists = await prisma.documentTemplate.findFirst({ where: { type: t.type } });
    if (!exists) {
      await prisma.documentTemplate.create({ data: { ...t, version: 1, isActive: true, changeNote: "系統預設範本" } });
    }
  }
  console.log(`✓ 預設範本 ${ALL_DEFAULT_TEMPLATES.length} 種`);
}

async function seedCalendars() {
  const dir = path.join(process.cwd(), "data", "calendars");
  for (const file of ["2026.json"]) {
    const parsed = parseCalendarJson(readFileSync(path.join(dir, file), "utf8"));
    for (const y of parsed.years) {
      const existing = await prisma.calendarYear.findUnique({ where: { year: y.year } });
      if (existing) {
        console.log(`• ${y.year} 年辦公日曆已存在，略過（如需更新請由系統設定匯入）`);
        continue;
      }
      await prisma.$transaction([
        prisma.calendarYear.create({ data: { year: y.year, isComplete: y.isComplete, source: parsed.source ?? file, sourceNote: "系統初始化匯入" } }),
        prisma.holidayCalendar.createMany({ data: y.days.map((d) => ({ year: y.year, date: isoToDbDate(d.date), kind: d.kind, description: d.description })) }),
      ]);
      console.log(`✓ ${y.year} 年辦公日曆（${y.days.length} 筆，${y.isComplete ? "完整" : "非完整"}）`);
    }
  }
}

async function seedAdmin() {
  const email = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.INITIAL_ADMIN_PASSWORD;
  if (!email || !password) {
    const admins = await prisma.user.count({ where: { role: "ADMIN" } });
    if (!admins) console.log("! 尚無管理員帳號：請執行 npm run admin:create 建立");
    return;
  }
  const err = validatePasswordStrength(password);
  if (err) throw new Error(`INITIAL_ADMIN_PASSWORD 不符密碼規則：${err}`);
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`• 管理員 ${email} 已存在，未變更密碼`);
    return;
  }
  await prisma.user.create({
    data: {
      email,
      name: process.env.INITIAL_ADMIN_NAME || "系統管理員",
      role: "ADMIN",
      passwordHash: await hashPassword(password),
      passwordChangedAt: new Date(),
      reminderPreference: { create: {} },
    },
  });
  console.log(`✓ 建立管理員 ${email}`);
}

async function seedDemo() {
  if (process.env.SEED_DEMO !== "true") return;
  if (process.env.NODE_ENV === "production") throw new Error("正式環境不可建立示範資料");
  const { syncCaseTasks } = await import("../src/server/schedule/task-sync");
  const demoPassword = "Demo12345678";
  const users = [
    { email: "admin@example.com", name: "王管理", role: "ADMIN" as const },
    { email: "chen@example.com", name: "陳工程師", role: "USER" as const },
    { email: "lin@example.com", name: "林工程師", role: "USER" as const },
  ];
  const ids: Record<string, string> = {};
  for (const u of users) {
    const row = await prisma.user.upsert({
      where: { email: u.email },
      create: { ...u, passwordHash: await hashPassword(demoPassword), reminderPreference: { create: {} } },
      update: {},
    });
    ids[u.email] = row.id;
  }
  const cases = [
    { projectCode: "TP115-001", schoolName: "臺北市大安區仁愛國民小學", district: "大安區", responsible: "chen@example.com", notification: "2026-09-21", review: "2026-10-16T14:00", visit: "2026-10-23T09:30" },
    { projectCode: "TP115-002", schoolName: "臺北市信義區永吉國民小學", district: "信義區", responsible: "chen@example.com", notification: "2026-10-01", review: "2026-10-30T10:00", visit: null },
    { projectCode: "TP115-003", schoolName: "臺北市士林區雨聲國民小學", district: "士林區", responsible: "lin@example.com", notification: "2026-10-07", review: null, visit: null },
  ];
  const { parseTaipeiDateTime } = await import("../src/lib/dates");
  for (const c of cases) {
    const row = await prisma.schoolCase.upsert({
      where: { projectCode: c.projectCode },
      create: {
        projectCode: c.projectCode,
        schoolName: c.schoolName,
        district: c.district,
        agencyName: "臺北市政府交通局",
        agencyContact: "張承辦",
        agencyEmail: "agency@example.com",
        responsibleUserId: ids[c.responsible],
        notificationDate: isoToDbDate(c.notification),
        reviewMeetingDateTime: c.review ? parseTaipeiDateTime(c.review) : null,
        reviewMeetingLocation: c.review ? "臺北市政府交通局會議室" : null,
        siteVisitDateTime: c.visit ? parseTaipeiDateTime(c.visit) : null,
        siteVisitLocation: c.visit ? "學校正門口" : null,
        siteVisitUploadUrl: c.visit ? "https://example.com/upload" : null,
      },
      update: {},
    });
    await syncCaseTasks(row.id, { actorId: null, source: "CASE_CREATED", reason: "示範資料" });
  }
  console.log(`✓ 示範資料：使用者 ${users.length} 位（密碼 ${demoPassword}）、案件 ${cases.length} 筆`);
}

async function main() {
  await seedRules();
  await seedTemplates();
  await seedCalendars();
  await seedAdmin();
  await seedDemo();
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
