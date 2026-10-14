import Link from "next/link";
import { ListControls } from "@/components/common/list-controls";
import { EmptyState, PageHeader } from "@/components/common/page-header";
import { buildHref, Pagination, SortHeader } from "@/components/common/table-nav";
import { DueDateText, TaskStatusBadge, TaskTypeBadge } from "@/components/tasks/badges";
import { TaskActions } from "@/components/tasks/task-actions";
import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requireUser } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { TASK_COLORS, TASK_STATUS_LABELS, TASK_TYPE_LABELS } from "@/server/schedule/task-types";
import { listTasks } from "@/server/tasks/task-service";
import { listUsers } from "@/server/users/user-service";

export const metadata = { title: "工作待辦" };

type SP = Record<string, string | undefined>;
const VIEWS = [
  { value: "open", label: "未完成" },
  { value: "overdue", label: "已逾期" },
  { value: "completed", label: "已完成" },
  { value: "all", label: "全部" },
] as const;

export default async function TasksPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const view = (VIEWS.find((v) => v.value === sp.view)?.value ?? "open") as (typeof VIEWS)[number]["value"];
  const [result, users] = await Promise.all([
    listTasks(user, {
      view,
      q: sp.q,
      status: sp.status,
      taskType: sp.taskType,
      category: sp.category,
      assignedUserId: sp.assignee,
      dueFrom: sp.from,
      dueTo: sp.to,
      sort: (sp.sort as "dueDate") ?? "dueDate",
      dir: sp.dir === "desc" ? "desc" : "asc",
      page: Number(sp.page) || 1,
      pageSize: 30,
    }),
    listUsers(),
  ]);
  const sortProps = { pathname: "/tasks", params: sp, defaultSort: "dueDate" };

  return (
    <>
      <PageHeader title="工作待辦" description="所有可存取案件之工作項目；期限以人工鎖定日期優先。" />
      <div className="mb-3 inline-flex rounded-md border bg-white p-0.5 text-sm">
        {VIEWS.map((v) => (
          <Link key={v.value} href={buildHref("/tasks", sp, { view: v.value, page: null })} className={cn("rounded px-3 py-1", view === v.value && "bg-primary text-white")}>
            {v.label}
          </Link>
        ))}
      </div>
      <Card>
        <div className="border-b p-3">
          <ListControls
            searchPlaceholder="搜尋學校、案件編號、工作…"
            filters={[
              { name: "category", label: "分類", options: Object.entries(TASK_COLORS).map(([value, c]) => ({ value, label: c.label })) },
              { name: "taskType", label: "工作類型", options: Object.entries(TASK_TYPE_LABELS).map(([value, label]) => ({ value, label })) },
              { name: "status", label: "狀態", options: Object.entries(TASK_STATUS_LABELS).map(([value, label]) => ({ value, label })) },
              { name: "assignee", label: "負責人", options: [{ value: "none", label: "未指派" }, ...users.map((u) => ({ value: u.id, label: u.name }))] },
            ]}
          />
        </div>
        {result.items.length ? (
          <>
            <Table>
              <THead>
                <TR>
                  <TH>
                    <SortHeader label="學校" field="schoolName" {...sortProps} />
                  </TH>
                  <TH>
                    <SortHeader label="工作類型" field="taskType" {...sortProps} />
                  </TH>
                  <TH>
                    <SortHeader label="截止日期" field="dueDate" {...sortProps} />
                  </TH>
                  <TH>負責人</TH>
                  <TH>
                    <SortHeader label="狀態" field="status" {...sortProps} />
                  </TH>
                  <TH>操作</TH>
                </TR>
              </THead>
              <TBody>
                {result.items.map((t) => (
                  <TR key={t.id} className={t.due.isOverdue ? "bg-red-50/50" : undefined}>
                    <TD className="min-w-[160px]">
                      <Link href={`/cases/${t.caseId}`} className="font-medium hover:text-primary hover:underline">
                        {t.schoolCase.schoolName}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        <Link href={`/tasks/${t.id}`} className="hover:underline">
                          {t.title}
                        </Link>
                      </p>
                    </TD>
                    <TD>
                      <TaskTypeBadge taskType={t.taskType} />
                    </TD>
                    <TD className="whitespace-nowrap">
                      <DueDateText dueDate={t.due.dueDate} remaining={t.due.remainingBusinessDays} status={t.status} estimated={t.dueDateEstimated} locked={t.due.isLocked} />
                    </TD>
                    <TD className="whitespace-nowrap">{t.assignedUser?.name ?? "未指派"}</TD>
                    <TD>
                      <TaskStatusBadge status={t.status} />
                    </TD>
                    <TD>
                      <TaskActions taskId={t.id} caseId={t.caseId} taskType={t.taskType} status={t.status} title={t.title} uploadUrl={t.schoolCase.siteVisitUploadUrl} compact showCase={false} />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <Pagination total={result.total} page={result.page} pageSize={result.pageSize} pathname="/tasks" params={sp} />
          </>
        ) : (
          <EmptyState title="沒有符合條件的工作" />
        )}
      </Card>
    </>
  );
}
