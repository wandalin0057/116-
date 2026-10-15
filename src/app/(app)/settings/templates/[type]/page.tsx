import type { TemplateType } from "@prisma/client";
import { notFound } from "next/navigation";
import { activateTemplateAction } from "@/app/actions/settings";
import { ActionButton } from "@/components/common/action-button";
import { PageHeader } from "@/components/common/page-header";
import { TemplateEditor } from "@/components/settings/template-editor";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requireAdminPage } from "@/lib/auth";
import { formatROCDateTime, isoToDbDate, parseTaipeiDateTime } from "@/lib/dates";
import { buildDocumentVariables, buildEmailVariables } from "@/server/documents/document-variables";
import { ALL_DEFAULT_TEMPLATES, TEMPLATE_TYPE_LABELS, TEMPLATE_VARIABLES } from "@/server/templates/default-templates";
import { getActiveTemplate, listTemplateVersions } from "@/server/templates/template-service";
import { getOrganization } from "@/server/settings/settings-service";

export default async function TemplateEditPage({ params }: { params: Promise<{ type: string }> }) {
  await requireAdminPage();
  const { type } = await params;
  const def = ALL_DEFAULT_TEMPLATES.find((t) => t.type === type);
  if (!def) notFound();
  const org = await getOrganization();
  const [active, versions] = await Promise.all([getActiveTemplate(type as TemplateType), listTemplateVersions(type as TemplateType)]);
  const sampleCase = {
    projectName: "115年度臺北市通學區規劃分析案",
    schoolName: "臺北市大安區仁愛國民小學",
    agencyName: "臺北市政府交通局",
    agencyContact: "王承辦",
    notificationDate: isoToDbDate("2026-10-14"),
    reviewMeetingDateTime: parseTaipeiDateTime("2026-10-22T14:00"),
  };
  const sampleVars =
    def.category === "DOCUMENT"
      ? buildDocumentVariables({ schoolCase: sampleCase, attachmentUrl: "https://example.com/files", attachmentPassword: "（密碼）", downloadDeadline: "2026-11-30", companyName: org.companyName })
      : buildEmailVariables({ schoolCase: sampleCase, eventDateTime: sampleCase.reviewMeetingDateTime, eventLocation: "交通局會議室", attachmentNames: "審查簡報.pdf", companyName: org.companyName, senderName: "陳工程師", signature: "林映辰 規劃師\nexample@company.com", notificationRound: 11, now: new Date("2026-10-23T02:00:00Z") });

  return (
    <>
      <PageHeader title={`範本：${TEMPLATE_TYPE_LABELS[def.type]}`} description={`目前啟用：${active.version ? `第 ${active.version} 版` : "系統預設"}`} />
      <Card>
        <CardContent>
          <TemplateEditor
            type={def.type}
            initial={{ name: active.name, subject: active.subject, body: active.body }}
            variables={TEMPLATE_VARIABLES[def.category]}
            sampleVars={sampleVars as Record<string, string>}
          />
        </CardContent>
      </Card>
      <Card className="mt-5">
        <CardHeader>
          <CardTitle>版本紀錄</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>版本</TH>
                <TH>主旨</TH>
                <TH>修改說明</TH>
                <TH>建立</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {versions.map((v) => (
                <TR key={v.id}>
                  <TD className="whitespace-nowrap">
                    第 {v.version} 版
                    {v.isActive && (
                      <Badge variant="success" className="ml-1">
                        啟用中
                      </Badge>
                    )}
                  </TD>
                  <TD className="max-w-md truncate text-xs" title={v.subject}>
                    {v.subject}
                  </TD>
                  <TD className="text-xs">{v.changeNote ?? "—"}</TD>
                  <TD className="whitespace-nowrap text-xs">
                    {formatROCDateTime(v.createdAt)} {v.createdBy?.name ?? "系統"}
                  </TD>
                  <TD>
                    {!v.isActive && (
                      <ActionButton size="xs" variant="outline" action={activateTemplateAction.bind(null, v.id)} confirm={{ title: `切換為第 ${v.version} 版？`, description: "之後新建之草稿將使用此版本。" }}>
                        切換為此版本
                      </ActionButton>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
