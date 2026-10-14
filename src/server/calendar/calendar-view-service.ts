import type { Prisma, TaskType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isISODate, type ISODate } from "@/lib/dates";
import { taskAccessWhere } from "@/server/auth/permissions";
import type { AuthUser } from "@/server/auth/types";
import { loadBusinessDayService } from "@/server/business-days/calendar-repository";
import { TASK_CATEGORY, type TaskCategory } from "@/server/schedule/task-types";
import { dueDateRangeWhere, TASK_INCLUDE } from "@/server/tasks/task-service";
import { effectiveDueDate } from "@/server/tasks/task-utils";

export interface CalendarEvent {
  id: string;
  taskId: string;
  caseId: string;
  date: ISODate;
  title: string;
  taskType: TaskType;
  category: TaskCategory;
  schoolName: string;
  status: string;
  assignedName: string | null;
  estimated: boolean;
  /** 會議或會勘之時間點（若有） */
  eventAt: Date | null;
  location: string | null;
}

export interface CalendarFilter {
  caseId?: string;
  assignedUserId?: string;
  taskType?: string;
  includeCompleted?: boolean;
}

export async function getCalendarEvents(user: AuthUser, from: ISODate, to: ISODate, filter: CalendarFilter = {}) {
  if (!isISODate(from) || !isISODate(to)) throw new Error("日期格式錯誤");
  const where: Prisma.TaskWhereInput[] = [taskAccessWhere(user), dueDateRangeWhere(from, to)];
  if (!filter.includeCompleted) where.push({ status: { not: "CANCELLED" } });
  if (filter.caseId) where.push({ caseId: filter.caseId });
  if (filter.assignedUserId) where.push({ assignedUserId: filter.assignedUserId });
  if (filter.taskType && filter.taskType in TASK_CATEGORY) where.push({ taskType: filter.taskType as TaskType });
  const [tasks, bds] = await Promise.all([
    prisma.task.findMany({
      where: { AND: where },
      include: { ...TASK_INCLUDE, schoolCase: { select: { ...TASK_INCLUDE.schoolCase.select, reviewMeetingDateTime: true, reviewMeetingLocation: true, siteVisitDateTime: true, siteVisitLocation: true } } },
    }),
    loadBusinessDayService(),
  ]);
  const events: CalendarEvent[] = tasks.map((t) => {
    const isMeeting = t.taskType === "REVIEW_MEETING";
    const isVisit = t.taskType === "SITE_VISIT";
    return {
      id: t.id,
      taskId: t.id,
      caseId: t.caseId,
      date: effectiveDueDate(t)!,
      title: t.title,
      taskType: t.taskType,
      category: TASK_CATEGORY[t.taskType],
      schoolName: t.schoolCase.schoolName,
      status: t.status,
      assignedName: t.assignedUser?.name ?? null,
      estimated: !t.overrideDueDate && t.dueDateEstimated,
      eventAt: isMeeting ? t.schoolCase.reviewMeetingDateTime : isVisit ? t.schoolCase.siteVisitDateTime : null,
      location: isMeeting ? t.schoolCase.reviewMeetingLocation : isVisit ? t.schoolCase.siteVisitLocation : null,
    };
  });
  events.sort((a, b) => a.date.localeCompare(b.date) || a.schoolName.localeCompare(b.schoolName, "zh-Hant"));
  return { events, days: bds.listDays(from, to), hasEstimated: bds.hasIncompleteYearBetween(from, to) };
}
