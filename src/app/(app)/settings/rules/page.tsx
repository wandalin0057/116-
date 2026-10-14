import { PageHeader } from "@/components/common/page-header";
import { RuleEditDialog } from "@/components/settings/rule-editor";
import { TaskTypeBadge } from "@/components/tasks/badges";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requireAdminPage } from "@/lib/auth";
import { ANCHOR_LABELS } from "@/server/schedule/task-types";
import { loadDeadlineRules } from "@/server/schedule/task-sync";

export const metadata = { title: "期限規則管理" };

function offsetText(n: number) {
  if (n === 0) return "當日（D0）";
  return n > 0 ? `後第 ${n} 個工作天` : `前第 ${-n} 個工作天`;
}

export default async function RulesPage() {
  await requireAdminPage();
  const rules = await loadDeadlineRules();
  return (
    <>
      <PageHeader title="期限規則管理" description="修改規則需管理員權限，並記錄原因。事件當日為 D0，不計入前後工作天。" />
      <Card>
        <Table>
          <THead>
            <TR>
              <TH>工作類型</TH>
              <TH>工作名稱</TH>
              <TH>基準</TH>
              <TH>期限</TH>
              <TH>狀態</TH>
              <TH />
            </TR>
          </THead>
          <TBody>
            {rules.map((r) => (
              <TR key={r.taskType}>
                <TD>
                  <TaskTypeBadge taskType={r.taskType} />
                </TD>
                <TD>
                  {r.title}
                  <p className="text-xs text-muted-foreground">{r.description}</p>
                </TD>
                <TD className="whitespace-nowrap">{ANCHOR_LABELS[r.anchor]}</TD>
                <TD className="whitespace-nowrap font-medium">{offsetText(r.offsetBusinessDays)}</TD>
                <TD>
                  <Badge variant={r.enabled ? "success" : "muted"}>{r.enabled ? "啟用" : "停用"}</Badge>
                </TD>
                <TD>
                  <RuleEditDialog rule={r} anchorLabel={ANCHOR_LABELS[r.anchor]} />
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </>
  );
}
