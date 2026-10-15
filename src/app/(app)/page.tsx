import { AlertTriangle, CalendarClock, CalendarDays, Clock, FilePen, FileText, Mail, MapPin, Upload, Users } from "lucide-react";
import Link from "next/link";
import { PageHeader, EmptyState } from "@/components/common/page-header";
import { ListControls } from "@/components/common/list-controls";
import { buildHref } from "@/components/common/table-nav";
import { listProjectNames } from "@/server/cases/projects";
import { TaskCard, toTaskCard } from "@/components/tasks/task-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireUser } from "@/lib/auth";
import { formatROC, formatROCDateTime, formatROCShort, weekdayZh } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { getDashboard, type DashboardTask } from "@/server/dashboard/dashboard-service";
import { CASE_STATUS_LABELS } from "@/server/cases/case-schema";

export const metadata = { title: "儀表板" };

function Stat({ label, value, icon: Icon, tone, href }: { label: string; value: number; icon: React.ElementType; tone: string; href: string }) {
  return (
    <Link href={href} className="group rounded-lg border bg-white p-3 shadow-sm transition-colors hover:border-primary/40">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-600">{label}</span>
        <Icon className={cn("h-4 w-4", tone)} />
      </div>
      <p className={cn("mt-1 text-2xl font-bold tabular", value ? tone : "text-slate-400")}>{value}</p>
    </Link>
  );
}

function TaskList({ tasks, empty }: { tasks: DashboardTask[]; empty: string }) {
  if (!tasks.length) return <EmptyState title={empty} />;
  return (
    <div className="grid gap-2 md:grid-cols-2 2xl:grid-cols-3">
      {tasks.map((t) => (
        <TaskCard key={t.id} task={toTaskCard(t)} />
      ))}
    </div>
  );
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ mine?: string; error?: string; project?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const mineOnly = sp.mine === "1";
  const [d, projects] = await Promise.all([getDashboard(user, { mineOnly, projectName: sp.project || undefined }), listProjectNames(user)]);

  return (
    <>
      <PageHeader
        title="儀表板"
        description={`今天是 ${formatROC(d.today)}（星期${weekdayZh(d.today)}）　本週 ${formatROCShort(d.weekStart, false)}–${formatROCShort(d.weekEnd, false)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ListControls
              showSearch={false}
              filters={[{ name: "project", label: "計畫", allLabel: "全部計畫", options: projects.map((p) => ({ value: p, label: p })) }]}
            />
            <div className="inline-flex rounded-md border bg-white p-0.5 text-sm">
              <Link href={buildHref("/", sp, { mine: null, error: null })} className={cn("rounded px-3 py-1", !mineOnly && "bg-primary text-white")}>
                {user.role === "ADMIN" ? "全部案件" : "所有可存取案件"}
              </Link>
              <Link href={buildHref("/", sp, { mine: "1", error: null })} className={cn("rounded px-3 py-1", mineOnly && "bg-primary text-white")}>
                我負責的
              </Link>
            </div>
          </div>
        }
      />
      {sp.error === "forbidden" && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">您沒有權限存取該頁面。</div>
      )}
      {d.calendarWarning && (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            未來 60 天內有年度尚未匯入完整官方辦公日曆，相關期限僅排除週末並標示「暫估」。請管理員於「系統設定 → 工作天設定」匯入人事行政總處公告之辦公日曆。
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="今日到期" value={d.dueToday.length} icon={Clock} tone="text-amber-600" href="#due" />
        <Stat label="明日到期" value={d.dueTomorrow.length} icon={CalendarClock} tone="text-blue-700" href="#due" />
        <Stat label="未來 7 天到期" value={d.dueNext7.length} icon={CalendarDays} tone="text-blue-700" href="#due" />
        <Stat label="已逾期" value={d.overdue.length} icon={AlertTriangle} tone="text-red-600" href="#due" />
        <Stat label="本週審查會議" value={d.weekMeetings.length} icon={Users} tone="text-rose-600" href="#week" />
        <Stat label="待創稿" value={d.pendingDraft.length} icon={FilePen} tone="text-amber-700" href="#pending" />
        <Stat label="待提供圖說" value={d.pendingDispatch.length} icon={FileText} tone="text-blue-800" href="#pending" />
        <Stat label="待寄送 Email" value={d.pendingEmail.length} icon={Mail} tone="text-emerald-700" href="#pending" />
        <Stat label="待上傳簡報" value={d.pendingUpload.length} icon={Upload} tone="text-violet-700" href="#pending" />
        <Stat label="本週會勘" value={d.weekSiteVisits.length} icon={MapPin} tone="text-rose-600" href="#week" />
      </div>

      <Card className="mt-5" id="due">
        <CardHeader>
          <CardTitle>到期工作</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={d.overdue.length ? "overdue" : "today"}>
            <TabsList>
              <TabsTrigger value="overdue">已逾期（{d.overdue.length}）</TabsTrigger>
              <TabsTrigger value="today">今日（{d.dueToday.length}）</TabsTrigger>
              <TabsTrigger value="tomorrow">明日（{d.dueTomorrow.length}）</TabsTrigger>
              <TabsTrigger value="week">未來 7 天（{d.dueNext7.length}）</TabsTrigger>
            </TabsList>
            <TabsContent value="overdue">
              <TaskList tasks={d.overdue} empty="沒有逾期工作" />
            </TabsContent>
            <TabsContent value="today">
              <TaskList tasks={d.dueToday} empty="今日沒有到期工作" />
            </TabsContent>
            <TabsContent value="tomorrow">
              <TaskList tasks={d.dueTomorrow} empty="明日沒有到期工作" />
            </TabsContent>
            <TabsContent value="week">
              <TaskList tasks={d.dueNext7} empty="未來 7 天沒有到期工作" />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card className="mt-5" id="pending">
        <CardHeader>
          <CardTitle>待辦分類</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="draft">
            <TabsList>
              <TabsTrigger value="draft">待創稿（{d.pendingDraft.length}）</TabsTrigger>
              <TabsTrigger value="dispatch">待提供圖說（{d.pendingDispatch.length}）</TabsTrigger>
              <TabsTrigger value="email">待寄送 Email（{d.pendingEmail.length}）</TabsTrigger>
              <TabsTrigger value="upload">待上傳簡報（{d.pendingUpload.length}）</TabsTrigger>
            </TabsList>
            <TabsContent value="draft">
              <TaskList tasks={d.pendingDraft} empty="沒有待創稿工作" />
            </TabsContent>
            <TabsContent value="dispatch">
              <TaskList tasks={d.pendingDispatch} empty="沒有待提供圖說工作" />
            </TabsContent>
            <TabsContent value="email">
              <TaskList tasks={d.pendingEmail} empty="沒有待寄送 Email" />
            </TabsContent>
            <TabsContent value="upload">
              <TaskList tasks={d.pendingUpload} empty="沒有待上傳簡報" />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <div className="mt-5 grid gap-5 lg:grid-cols-2" id="week">
        <Card>
          <CardHeader>
            <CardTitle>本週審查會議</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {d.weekMeetings.length ? (
              <Table>
                <THead>
                  <TR>
                    <TH>時間</TH>
                    <TH>學校</TH>
                    <TH>地點</TH>
                  </TR>
                </THead>
                <TBody>
                  {d.weekMeetings.map((m) => (
                    <TR key={m.id}>
                      <TD className="whitespace-nowrap tabular">{formatROCDateTime(m.reviewMeetingDateTime)}</TD>
                      <TD>
                        <Link className="text-primary hover:underline" href={`/cases/${m.id}`}>
                          {m.schoolName}
                        </Link>
                      </TD>
                      <TD>{m.reviewMeetingLocation ?? "—"}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            ) : (
              <EmptyState title="本週沒有審查會議" />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>本週會勘</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {d.weekSiteVisits.length ? (
              <Table>
                <THead>
                  <TR>
                    <TH>時間</TH>
                    <TH>學校</TH>
                    <TH>地點</TH>
                  </TR>
                </THead>
                <TBody>
                  {d.weekSiteVisits.map((m) => (
                    <TR key={m.id}>
                      <TD className="whitespace-nowrap tabular">{formatROCDateTime(m.siteVisitDateTime)}</TD>
                      <TD>
                        <Link className="text-primary hover:underline" href={`/cases/${m.id}`}>
                          {m.schoolName}
                        </Link>
                      </TD>
                      <TD>{m.siteVisitLocation ?? "—"}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            ) : (
              <EmptyState title="本週沒有會勘" />
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader>
          <CardTitle>各學校進度</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {d.progress.length ? (
            <Table>
              <THead>
                <TR>
                  <TH>案件編號</TH>
                  <TH>學校</TH>
                  <TH>負責人</TH>
                  <TH className="min-w-[160px]">進度</TH>
                  <TH>逾期</TH>
                  <TH>下一項工作</TH>
                </TR>
              </THead>
              <TBody>
                {d.progress.map((p) => (
                  <TR key={p.id}>
                    <TD className="whitespace-nowrap font-mono text-xs">{p.projectCode}</TD>
                    <TD>
                      <Link className="font-medium text-primary hover:underline" href={`/cases/${p.id}`}>
                        {p.schoolName}
                      </Link>
                      {p.status !== "ACTIVE" && (
                        <Badge variant="warning" className="ml-2">
                          {CASE_STATUS_LABELS[p.status]}
                        </Badge>
                      )}
                    </TD>
                    <TD className="whitespace-nowrap">{p.responsibleName}</TD>
                    <TD>
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${p.percent}%` }} />
                        </div>
                        <span className="w-20 text-right text-xs tabular text-slate-600">
                          {p.completed}/{p.total}（{p.percent}%）
                        </span>
                      </div>
                    </TD>
                    <TD>{p.overdue ? <Badge variant="danger">{p.overdue}</Badge> : <span className="text-muted-foreground">0</span>}</TD>
                    <TD className="text-sm">
                      {p.nextTask ? (
                        <>
                          {p.nextTask.title}
                          <span className="ml-1 text-xs text-muted-foreground tabular">{formatROCShort(p.nextTask.dueDate)}</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          ) : (
            <EmptyState
              title="尚無執行中的案件"
              action={
                <Link href="/cases/new" className="text-sm text-primary hover:underline">
                  新增學校案件
                </Link>
              }
            />
          )}
        </CardContent>
      </Card>
    </>
  );
}
