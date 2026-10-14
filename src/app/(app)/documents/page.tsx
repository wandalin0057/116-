import Link from "next/link";
import { ListControls } from "@/components/common/list-controls";
import { EmptyState, PageHeader } from "@/components/common/page-header";
import { Pagination, SortHeader } from "@/components/common/table-nav";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requireUser } from "@/lib/auth";
import { dbDateToISOOrNull, formatROCDateTime, formatROCShort } from "@/lib/dates";
import { listDocuments } from "@/server/documents/document-service";
import { DOCUMENT_STATUS_LABELS, DOCUMENT_TYPE_LABELS } from "@/server/documents/document-variables";

export const metadata = { title: "公文管理" };
type SP = Record<string, string | undefined>;

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const result = await listDocuments(user, { q: sp.q, status: sp.status, documentType: sp.type, sort: sp.sort, dir: sp.dir === "asc" ? "asc" : "desc", page: Number(sp.page) || 1 });
  const sortProps = { pathname: "/documents", params: sp, defaultSort: "createdAt" };
  return (
    <>
      <PageHeader
        title="公文管理"
        description="公文草稿與發文紀錄。匯出之 DOCX／PDF 僅為草稿排版文件，正式發文請於機關電子公文系統辦理，並回填正式發文字號。"
      />
      <Card>
        <div className="border-b p-3">
          <ListControls
            searchPlaceholder="搜尋主旨、發文字號、學校…"
            filters={[
              { name: "type", label: "公文類型", options: Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => ({ value, label })) },
              { name: "status", label: "狀態", options: Object.entries(DOCUMENT_STATUS_LABELS).map(([value, label]) => ({ value, label })) },
            ]}
          />
        </div>
        {result.items.length ? (
          <>
            <Table>
              <THead>
                <TR>
                  <TH>學校</TH>
                  <TH>
                    <SortHeader label="公文類型" field="documentType" {...sortProps} />
                  </TH>
                  <TH>主旨</TH>
                  <TH>
                    <SortHeader label="狀態" field="status" {...sortProps} />
                  </TH>
                  <TH>發文字號</TH>
                  <TH>
                    <SortHeader label="發文日期" field="dispatchDate" {...sortProps} />
                  </TH>
                  <TH>
                    <SortHeader label="建立時間" field="createdAt" {...sortProps} />
                  </TH>
                </TR>
              </THead>
              <TBody>
                {result.items.map((d) => (
                  <TR key={d.id}>
                    <TD className="whitespace-nowrap">{d.schoolCase.schoolName}</TD>
                    <TD className="whitespace-nowrap">{DOCUMENT_TYPE_LABELS[d.documentType]}</TD>
                    <TD className="max-w-md">
                      <Link href={`/documents/${d.id}`} className="line-clamp-2 text-primary hover:underline">
                        {d.subject}
                      </Link>
                    </TD>
                    <TD>
                      <Badge variant={d.status === "DISPATCHED" ? "success" : d.status === "DRAFTED" ? "info" : d.status === "CANCELLED" ? "muted" : "outline"}>
                        {DOCUMENT_STATUS_LABELS[d.status]}
                      </Badge>
                    </TD>
                    <TD className="whitespace-nowrap">{d.documentNumber ?? "—"}</TD>
                    <TD className="whitespace-nowrap tabular">{formatROCShort(dbDateToISOOrNull(d.dispatchDate))}</TD>
                    <TD className="whitespace-nowrap text-xs tabular">{formatROCDateTime(d.createdAt)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <Pagination total={result.total} page={result.page} pageSize={result.pageSize} pathname="/documents" params={sp} />
          </>
        ) : (
          <EmptyState title="尚無公文" description="可於儀表板、工作待辦或案件頁面點選「產生公文」，依範本建立草稿。" />
        )}
      </Card>
    </>
  );
}
