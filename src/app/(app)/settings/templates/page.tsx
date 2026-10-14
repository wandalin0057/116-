import Link from "next/link";
import { PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requireAdminPage } from "@/lib/auth";
import { formatROCDateTime } from "@/lib/dates";
import { ALL_DEFAULT_TEMPLATES, TEMPLATE_TYPE_LABELS } from "@/server/templates/default-templates";
import { prisma } from "@/lib/db";

export const metadata = { title: "範本管理" };

export default async function TemplatesPage() {
  await requireAdminPage();
  const active = await prisma.documentTemplate.findMany({ where: { isActive: true }, include: { createdBy: { select: { name: true } } } });
  const counts = await prisma.documentTemplate.groupBy({ by: ["type"], _count: { _all: true } });
  return (
    <>
      <PageHeader title="公文與 Email 範本" description="每次修改皆保留舊版本，可隨時切換回先前版本。已建立之草稿不受範本修改影響。" />
      <Card>
        <Table>
          <THead>
            <TR>
              <TH>類別</TH>
              <TH>範本</TH>
              <TH>啟用版本</TH>
              <TH>版本數</TH>
              <TH>最後修改</TH>
            </TR>
          </THead>
          <TBody>
            {ALL_DEFAULT_TEMPLATES.map((t) => {
              const a = active.find((x) => x.type === t.type);
              return (
                <TR key={t.type}>
                  <TD>
                    <Badge variant={t.category === "DOCUMENT" ? "info" : "success"}>{t.category === "DOCUMENT" ? "公文" : "Email"}</Badge>
                  </TD>
                  <TD>
                    <Link href={`/settings/templates/${t.type}`} className="font-medium text-primary hover:underline">
                      {TEMPLATE_TYPE_LABELS[t.type]}
                    </Link>
                  </TD>
                  <TD>{a ? `第 ${a.version} 版` : "系統預設"}</TD>
                  <TD className="tabular">{counts.find((c) => c.type === t.type)?._count._all ?? 0}</TD>
                  <TD className="text-xs">
                    {a ? `${formatROCDateTime(a.createdAt)}　${a.createdBy?.name ?? "系統"}` : "—"}
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </Card>
    </>
  );
}
