import type { Prisma } from "@prisma/client";
import { ListControls } from "@/components/common/list-controls";
import { EmptyState, PageHeader } from "@/components/common/page-header";
import { Pagination } from "@/components/common/table-nav";
import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth";
import { formatROCDateTime } from "@/lib/dates";

export const metadata = { title: "操作紀錄" };
type SP = Record<string, string | undefined>;

const ENTITY_LABELS: Record<string, string> = {
  SchoolCase: "案件",
  Task: "工作",
  OfficialDocument: "公文",
  EmailDraft: "Email 草稿",
  User: "使用者",
  DocumentTemplate: "範本",
  DeadlineRule: "期限規則",
  CalendarYear: "辦公日曆",
  BusinessDayOverride: "工作天調整",
  SystemSetting: "系統設定",
  ReminderPreference: "通知設定",
  JobRun: "排程",
  System: "系統",
};

export default async function AuditPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireAdminPage();
  const sp = await searchParams;
  const page = Math.max(Number(sp.page) || 1, 1);
  const pageSize = 50;
  const [users] = await Promise.all([prisma.user.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } })]);
  const where: Prisma.AuditLogWhereInput = {
    ...(sp.entity ? { entityType: sp.entity } : {}),
    ...(sp.actor ? { actorId: sp.actor } : {}),
    ...(sp.q ? { OR: [{ summary: { contains: sp.q, mode: "insensitive" } }, { action: { contains: sp.q, mode: "insensitive" } }] } : {}),
  };
  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize, include: { actor: { select: { name: true } } } }),
  ]);
  return (
    <>
      <PageHeader title="操作紀錄" description="記錄登入、案件與期限異動、公文、範本、日曆與設定變更。敏感欄位已遮蔽。" />
      <Card>
        <div className="border-b p-3">
          <ListControls
            searchPlaceholder="搜尋內容或動作…"
            filters={[
              { name: "entity", label: "對象", options: Object.entries(ENTITY_LABELS).map(([value, label]) => ({ value, label })) },
              { name: "actor", label: "操作者", options: users.map((u) => ({ value: u.id, label: u.name })) },
            ]}
          />
        </div>
        {logs.length ? (
          <>
            <Table>
              <THead>
                <TR>
                  <TH>時間</TH>
                  <TH>操作者</TH>
                  <TH>對象</TH>
                  <TH>動作</TH>
                  <TH>內容</TH>
                  <TH>IP</TH>
                </TR>
              </THead>
              <TBody>
                {logs.map((l) => (
                  <TR key={l.id}>
                    <TD className="whitespace-nowrap text-xs tabular">{formatROCDateTime(l.createdAt)}</TD>
                    <TD className="whitespace-nowrap">{l.actor?.name ?? "系統"}</TD>
                    <TD className="whitespace-nowrap text-xs">{ENTITY_LABELS[l.entityType] ?? l.entityType}</TD>
                    <TD className="whitespace-nowrap font-mono text-[11px]">{l.action}</TD>
                    <TD className="text-sm">
                      {l.summary}
                      {l.changes && (
                        <details className="mt-1 text-xs">
                          <summary className="cursor-pointer text-primary">異動內容</summary>
                          <pre className="mt-1 max-h-48 max-w-xl overflow-auto rounded bg-slate-50 p-2">{JSON.stringify(l.changes, null, 2)}</pre>
                        </details>
                      )}
                    </TD>
                    <TD className="text-xs">{l.ipAddress ?? "—"}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <Pagination total={total} page={page} pageSize={pageSize} pathname="/settings/audit" params={sp} />
          </>
        ) : (
          <EmptyState title="查無紀錄" />
        )}
      </Card>
    </>
  );
}
