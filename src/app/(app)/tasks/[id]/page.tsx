import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/common/page-header";
import { DueDateText, TaskStatusBadge, TaskTypeBadge } from "@/components/tasks/badges";
import { TaskActions } from "@/components/tasks/task-actions";
import { TaskEditDialog } from "@/components/tasks/task-edit-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requireUser } from "@/lib/auth";
import { dbDateToISOOrNull, formatROCDateTime, formatROCShort } from "@/lib/dates";
import { canAccessCase } from "@/server/auth/permissions";
import { AppError } from "@/server/errors";
import { getTask } from "@/server/tasks/task-service";
import { listUsers } from "@/server/users/user-service";

const SOURCE_LABELS: Record<string, string> = {
  CREATED: "建立",
  CASE_DATE_CHANGE: "案件日期變更",
  CALENDAR_RECALC: "工作日曆更新",
  RULE_CHANGE: "期限規則修改",
  MANUAL_OVERRIDE: "人工調整",
  MANUAL_RECALC: "重新計算",
  CASE_CREATED: "建立案件",
};

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const task = await getTask(user, id).catch((e) => {
    if (e instanceof AppError) notFound();
    throw e;
  });
  const [users, canEdit] = await Promise.all([listUsers(), canAccessCase(user, task.caseId, "edit")]);
  return (
    <>
      <PageHeader
        title={task.title}
        description={
          <Link href={`/cases/${task.caseId}`} className="text-primary hover:underline">
            {task.schoolCase.schoolName}（{task.schoolCase.projectCode}）
          </Link>
        }
      />
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>工作資訊</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <TaskTypeBadge taskType={task.taskType} />
              <TaskStatusBadge status={task.status} />
            </div>
            <p className="text-slate-600">{task.description}</p>
            <dl className="space-y-2">
              <div>
                <dt className="text-xs text-muted-foreground">截止日期</dt>
                <dd>
                  <DueDateText dueDate={task.due.dueDate} remaining={task.due.remainingBusinessDays} status={task.status} estimated={task.dueDateEstimated} locked={task.due.isLocked} />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">系統計算期限</dt>
                <dd className="tabular">{formatROCShort(dbDateToISOOrNull(task.calculatedDueDate))}</dd>
              </div>
              {task.overrideDueDate && (
                <div>
                  <dt className="text-xs text-muted-foreground">人工鎖定</dt>
                  <dd>
                    {formatROCShort(dbDateToISOOrNull(task.overrideDueDate))}（{task.overrideReason}）
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-muted-foreground">負責人</dt>
                <dd>{task.assignedUser?.name ?? "未指派"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">完成時間</dt>
                <dd className="tabular">{formatROCDateTime(task.actualCompletedAt)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">每日提醒</dt>
                <dd>{task.reminderEnabled ? "啟用" : "停用"}</dd>
              </div>
            </dl>
            {canEdit && (
              <div className="space-y-2 border-t pt-3">
                <TaskActions taskId={task.id} caseId={task.caseId} taskType={task.taskType} status={task.status} title={task.title} uploadUrl={task.schoolCase.siteVisitUploadUrl} />
                <TaskEditDialog
                  task={{
                    id: task.id,
                    title: task.title,
                    status: task.status,
                    calculatedDueDate: dbDateToISOOrNull(task.calculatedDueDate),
                    overrideDueDate: dbDateToISOOrNull(task.overrideDueDate),
                    overrideReason: task.overrideReason,
                    assignedUserId: task.assignedUserId,
                    reminderEnabled: task.reminderEnabled,
                  }}
                  users={users.map((u) => ({ id: u.id, name: u.name }))}
                />
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>期限異動歷史</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <THead>
                <TR>
                  <TH>時間</TH>
                  <TH>來源</TH>
                  <TH>原期限</TH>
                  <TH>新期限</TH>
                  <TH>原因</TH>
                  <TH>操作者</TH>
                </TR>
              </THead>
              <TBody>
                {task.histories.map((h) => (
                  <TR key={h.id}>
                    <TD className="whitespace-nowrap text-xs tabular">{formatROCDateTime(h.createdAt)}</TD>
                    <TD className="text-xs">{SOURCE_LABELS[h.changeSource] ?? h.changeSource}</TD>
                    <TD className="tabular">{formatROCShort(dbDateToISOOrNull(h.previousDate))}</TD>
                    <TD className="tabular">{formatROCShort(dbDateToISOOrNull(h.newDate))}</TD>
                    <TD className="text-xs">{h.reason ?? "—"}</TD>
                    <TD className="text-xs">{h.changedBy?.name ?? "系統"}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
