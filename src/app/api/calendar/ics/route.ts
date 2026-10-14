import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addCalendarDays, taipeiToday } from "@/lib/dates";
import { absoluteUrl } from "@/lib/utils";
import { getCalendarEvents } from "@/server/calendar/calendar-view-service";
import { buildIcs } from "@/server/calendar/ics";
import { TASK_STATUS_LABELS, TASK_TYPE_LABELS } from "@/server/schedule/task-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 匯出 ICS：預設包含今日前 30 天至未來 365 天之工作 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "請先登入" }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const today = taipeiToday();
  const { events } = await getCalendarEvents(user, addCalendarDays(today, -30), addCalendarDays(today, 365), {
    caseId: sp.get("caseId") ?? undefined,
    assignedUserId: sp.get("assignee") ?? undefined,
    taskType: sp.get("taskType") ?? undefined,
  });
  const host = new URL(absoluteUrl("/")).host;
  const ics = buildIcs(
    events.map((e) => ({
      uid: `${e.taskId}@${host}`,
      date: e.date,
      start: e.eventAt,
      durationMinutes: 120,
      summary: `【${TASK_TYPE_LABELS[e.taskType]}】${e.schoolName}${e.estimated ? "（暫估）" : ""}`,
      description: `${e.title}\n狀態：${TASK_STATUS_LABELS[e.status as keyof typeof TASK_STATUS_LABELS]}\n負責人：${e.assignedName ?? "未指派"}`,
      location: e.location,
      url: absoluteUrl(`/cases/${e.caseId}`),
    })),
    { calendarName: "通學區案件期程" },
  );
  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="school-zone-${today}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
