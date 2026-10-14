import Link from "next/link";
import { ListControls } from "@/components/common/list-controls";
import { EmptyState, PageHeader } from "@/components/common/page-header";
import { Pagination, SortHeader } from "@/components/common/table-nav";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requireUser } from "@/lib/auth";
import { formatROCDateTime } from "@/lib/dates";
import { EMAIL_DRAFT_STATUS_LABELS, listEmailDrafts } from "@/server/emails/email-draft-service";
import { EMAIL_TEMPLATE_TYPES, TEMPLATE_TYPE_LABELS } from "@/server/templates/default-templates";

export const metadata = { title: "Email 草稿" };
type SP = Record<string, string | undefined>;

export default async function EmailsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const result = await listEmailDrafts(user, { q: sp.q, status: sp.status, templateType: sp.type, sort: sp.sort, dir: sp.dir === "asc" ? "asc" : "desc", page: Number(sp.page) || 1 });
  const sortProps = { pathname: "/emails", params: sp, defaultSort: "createdAt" };
  return (
    <>
      <PageHeader title="Email 草稿" description="系統不會自動寄送業務信件。請複製內容或以郵件程式開啟，由您確認附件後自行寄出，再於系統標記為已寄出。" />
      <Card>
        <div className="border-b p-3">
          <ListControls
            searchPlaceholder="搜尋主旨、收件人、學校…"
            filters={[
              { name: "type", label: "範本", options: EMAIL_TEMPLATE_TYPES.map((t) => ({ value: t, label: TEMPLATE_TYPE_LABELS[t] })) },
              { name: "status", label: "狀態", options: Object.entries(EMAIL_DRAFT_STATUS_LABELS).map(([value, label]) => ({ value, label })) },
            ]}
          />
        </div>
        {result.items.length ? (
          <>
            <Table>
              <THead>
                <TR>
                  <TH>學校</TH>
                  <TH>範本</TH>
                  <TH>主旨</TH>
                  <TH>收件人</TH>
                  <TH>
                    <SortHeader label="狀態" field="status" {...sortProps} />
                  </TH>
                  <TH>
                    <SortHeader label="建立時間" field="createdAt" {...sortProps} />
                  </TH>
                  <TH>
                    <SortHeader label="確認寄出" field="confirmedSentAt" {...sortProps} />
                  </TH>
                </TR>
              </THead>
              <TBody>
                {result.items.map((e) => (
                  <TR key={e.id}>
                    <TD className="whitespace-nowrap">{e.schoolCase.schoolName}</TD>
                    <TD className="whitespace-nowrap">{TEMPLATE_TYPE_LABELS[e.templateType]}</TD>
                    <TD className="max-w-sm">
                      <Link href={`/emails/${e.id}`} className="line-clamp-2 text-primary hover:underline">
                        {e.subject}
                      </Link>
                    </TD>
                    <TD className="max-w-[200px] truncate text-xs">{e.toRecipients || "—"}</TD>
                    <TD>
                      <Badge variant={e.status === "CONFIRMED_SENT" ? "success" : e.status === "CANCELLED" ? "muted" : "outline"}>{EMAIL_DRAFT_STATUS_LABELS[e.status]}</Badge>
                    </TD>
                    <TD className="whitespace-nowrap text-xs tabular">{formatROCDateTime(e.createdAt)}</TD>
                    <TD className="whitespace-nowrap text-xs tabular">{formatROCDateTime(e.confirmedSentAt)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <Pagination total={result.total} page={result.page} pageSize={result.pageSize} pathname="/emails" params={sp} />
          </>
        ) : (
          <EmptyState title="尚無 Email 草稿" description="可於儀表板或案件頁面點選「產生 Email」建立草稿。" />
        )}
      </Card>
    </>
  );
}
