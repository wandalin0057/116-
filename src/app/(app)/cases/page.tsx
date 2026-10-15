import { Plus } from "lucide-react";
import Link from "next/link";
import { ListControls } from "@/components/common/list-controls";
import { EmptyState, PageHeader } from "@/components/common/page-header";
import { buildHref, Pagination, SortHeader } from "@/components/common/table-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requireUser } from "@/lib/auth";
import { dbDateToISOOrNull, formatROCDateTime, formatROCShort } from "@/lib/dates";
import { CASE_STATUS_LABELS, TAIPEI_DISTRICTS } from "@/server/cases/case-schema";
import { listCases } from "@/server/cases/case-service";
import { listUsers } from "@/server/users/user-service";
import { countCasesByProject, listProjectNames, shortProjectLabel } from "@/server/cases/projects";
import { cn } from "@/lib/utils";

export const metadata = { title: "學校案件" };

type SP = Record<string, string | undefined>;

export default async function CasesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const [result, users, projectNames, projectCounts] = await Promise.all([
    listCases(user, {
      q: sp.q,
      status: sp.status,
      district: sp.district,
      projectName: sp.projectName,
      responsibleUserId: sp.responsible,
      sort: sp.sort,
      dir: sp.dir === "desc" ? "desc" : "asc",
      page: Number(sp.page) || 1,
    }),
    listUsers(),
    listProjectNames(user),
    countCasesByProject(user),
  ]);
  const totalCases = [...projectCounts.values()].reduce((a, b) => a + b, 0);
  const tab = (label: string, value: string | null, count: number) => (
    <Link
      key={value ?? "all"}
      href={buildHref("/cases", sp, { projectName: value, page: null })}
      className={cn(
        "whitespace-nowrap rounded-md px-3 py-1.5 text-sm",
        (sp.projectName ?? null) === value ? "bg-primary font-medium text-white" : "text-slate-600 hover:bg-accent",
      )}
    >
      {label}
      <span className="ml-1 text-xs opacity-80">（{count}）</span>
    </Link>
  );
  const sortProps = { pathname: "/cases", params: sp, defaultSort: "projectCode" };

  return (
    <>
      <PageHeader
        title="學校案件"
        description="每所學校一筆案件；點選案件可查看期程、公文與 Email 草稿。"
        actions={
          <Button asChild>
            <Link href={sp.projectName ? `/cases/new?project=${encodeURIComponent(sp.projectName)}` : "/cases/new"}>
              <Plus />
              新增案件
            </Link>
          </Button>
        }
      />
      <div className="mb-3 flex gap-1 overflow-x-auto rounded-lg border bg-white p-1">
        {tab("全部計畫", null, totalCases)}
        {projectNames.map((n) => tab(shortProjectLabel(n), n, projectCounts.get(n) ?? 0))}
      </div>
      {sp.projectName && <p className="mb-2 text-sm font-medium text-slate-700">{sp.projectName}</p>}
      <Card>
        <div className="border-b p-3">
          <ListControls
            searchPlaceholder="搜尋編號、學校、計畫名稱…"
            filters={[
              { name: "status", label: "狀態", options: Object.entries(CASE_STATUS_LABELS).map(([value, label]) => ({ value, label })) },
              { name: "district", label: "行政區", options: TAIPEI_DISTRICTS.map((d) => ({ value: d, label: d })) },
              { name: "responsible", label: "負責人", options: users.map((u) => ({ value: u.id, label: u.name })) },
            ]}
          />
        </div>
        {result.items.length ? (
          <>
            <Table>
              <THead>
                <TR>
                  <TH>
                    <SortHeader label="案件編號" field="projectCode" {...sortProps} />
                  </TH>
                  <TH>
                    <SortHeader label="學校" field="schoolName" {...sortProps} />
                  </TH>
                  <TH>
                    <SortHeader label="行政區" field="district" {...sortProps} />
                  </TH>
                  <TH>負責人</TH>
                  <TH>
                    <SortHeader label="通知日" field="notificationDate" {...sortProps} />
                  </TH>
                  <TH>
                    <SortHeader label="審查會議" field="reviewMeetingDateTime" {...sortProps} />
                  </TH>
                  <TH>
                    <SortHeader label="會勘" field="siteVisitDateTime" {...sortProps} />
                  </TH>
                  <TH>進度</TH>
                  <TH>
                    <SortHeader label="狀態" field="status" {...sortProps} />
                  </TH>
                </TR>
              </THead>
              <TBody>
                {result.items.map((c) => (
                  <TR key={c.id}>
                    <TD className="whitespace-nowrap font-mono text-xs">{c.projectCode}</TD>
                    <TD>
                      <Link href={`/cases/${c.id}`} className="font-medium text-primary hover:underline">
                        {c.schoolName}
                      </Link>
                      <p className="text-xs text-muted-foreground">{c.projectName}</p>
                    </TD>
                    <TD className="whitespace-nowrap">{c.district ?? "—"}</TD>
                    <TD className="whitespace-nowrap">{c.responsibleUser.name}</TD>
                    <TD className="whitespace-nowrap tabular">{formatROCShort(dbDateToISOOrNull(c.notificationDate))}</TD>
                    <TD className="whitespace-nowrap tabular">{formatROCDateTime(c.reviewMeetingDateTime)}</TD>
                    <TD className="whitespace-nowrap tabular">{formatROCDateTime(c.siteVisitDateTime)}</TD>
                    <TD className="whitespace-nowrap tabular text-xs">
                      {c.taskCompleted}/{c.taskTotal}
                    </TD>
                    <TD>
                      <Badge variant={c.status === "ACTIVE" ? "info" : c.status === "COMPLETED" ? "success" : "muted"}>{CASE_STATUS_LABELS[c.status]}</Badge>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <Pagination total={result.total} page={result.page} pageSize={result.pageSize} pathname="/cases" params={sp} />
          </>
        ) : (
          <EmptyState title="查無案件" description="可調整搜尋條件，或新增學校案件。" />
        )}
      </Card>
    </>
  );
}
