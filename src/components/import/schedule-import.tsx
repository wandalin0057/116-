"use client";
import { CheckCircle2, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { applyScheduleImportAction, previewScheduleImportAction } from "@/app/actions/cases";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatROCShort, type ISODate } from "@/lib/dates";
import type { ImportResult, PreviewRow } from "@/server/import/schedule-import";

const d = (v: ISODate | null | undefined, period?: string | null) => (v ? `${formatROCShort(v, false)}${period ? `（${period}）` : ""}` : "—");

export function ScheduleImport() {
  const [files, setFiles] = useState<File[]>([]);
  const [rows, setRows] = useState<PreviewRow[] | null>(null);
  const [results, setResults] = useState<ImportResult[] | null>(null);
  const [completePast, setCompletePast] = useState(true);
  const [busy, setBusy] = useState<"preview" | "apply" | null>(null);

  const form = () => {
    const f = new FormData();
    files.forEach((x) => f.append("files", x));
    f.set("completePast", completePast ? "1" : "0");
    return f;
  };

  const preview = async (list: File[]) => {
    setFiles(list);
    setRows(null);
    setResults(null);
    if (!list.length) return;
    setBusy("preview");
    const f = new FormData();
    list.forEach((x) => f.append("files", x));
    const r = await previewScheduleImportAction(f);
    setBusy(null);
    if (!r.ok) return void toast.error(r.message);
    setRows(r.data ?? []);
  };

  const apply = async () => {
    setBusy("apply");
    const r = await applyScheduleImportAction(form());
    setBusy(null);
    if (!r.ok) return void toast.error(r.message);
    setResults(r.data ?? []);
    const ok = (r.data ?? []).filter((x) => x.action === "CREATED" || x.action === "UPDATED").length;
    toast.success(`匯入完成：${ok} 所學校`);
  };

  const count = (a: PreviewRow["action"]) => rows?.filter((r) => r.action === a).length ?? 0;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>1. 選擇 Excel 檔案</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <label className="flex w-fit cursor-pointer items-center gap-2 rounded-md border border-dashed border-slate-400 px-4 py-3 hover:bg-accent">
            <Upload className="h-4 w-4" />
            <span>{files.length ? files.map((f) => f.name).join("、") : "點此選擇排程檔（.xlsx，可多選）"}</span>
            <input
              type="file"
              accept=".xlsx"
              multiple
              aria-label="選擇排程檔"
              className="hidden"
              onChange={(e) => void preview(Array.from(e.target.files ?? []))}
            />
          </label>
          {busy === "preview" && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> 讀取中…
            </p>
          )}
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>每所學校一列，右側日期依序為：派案 → 交初規 → 審查會議 → 會勘；年份依上方「115/1」這類月份標題判斷。</li>
            <li>已有相同計畫與學校名稱的案件會更新日期；沒有的會新增，負責人預設為你，可之後再改。</li>
            <li>審查會議與會勘時間預設上午 10:00（註明「下午」者為 14:00），請之後在案件中確認。</li>
            <li>承辦人簡稱（如「珠」）會自動對應全名（如「麗珠」）；115 與 116 年檔案一起上傳效果最好。</li>
          </ul>
        </CardContent>
      </Card>

      {rows && !results && (
        <Card>
          <CardHeader>
            <CardTitle>2. 確認內容</CardTitle>
            <p className="text-sm text-muted-foreground">
              共 {rows.length} 所：新增 {count("CREATE")}、更新 {count("UPDATE")}
              {count("SKIP") ? `、略過 ${count("SKIP")}（沒有派案日期）` : ""}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    <TH>計畫</TH>
                    <TH>學校</TH>
                    <TH>行政區</TH>
                    <TH>承辦人</TH>
                    <TH>派案</TH>
                    <TH>交初規</TH>
                    <TH>審查會議</TH>
                    <TH>會勘</TH>
                    <TH>處理</TH>
                  </TR>
                </THead>
                <TBody>
                  {rows.map((r) => (
                    <TR key={`${r.sheet}-${r.rowNumber}-${r.schoolName}`}>
                      <TD className="whitespace-nowrap">{r.rocYear}年度</TD>
                      <TD className="whitespace-nowrap font-medium">
                        {r.schoolName}
                        {r.warnings.map((w) => (
                          <p key={w} className="text-xs font-normal text-amber-700">
                            ⚠ {w}
                          </p>
                        ))}
                      </TD>
                      <TD>{r.district ?? "—"}</TD>
                      <TD>{r.contact ?? "—"}</TD>
                      <TD className="whitespace-nowrap">{d(r.notificationDate)}</TD>
                      <TD className="whitespace-nowrap">{d(r.preReportDate)}</TD>
                      <TD className="whitespace-nowrap">{d(r.reviewMeeting?.date, r.reviewMeeting?.period)}</TD>
                      <TD className="whitespace-nowrap">{d(r.siteVisit?.date, r.siteVisit?.period)}</TD>
                      <TD>
                        {r.action === "CREATE" && <Badge variant="success">新增</Badge>}
                        {r.action === "UPDATE" && <Badge variant="info">更新 {r.existingProjectCode}</Badge>}
                        {r.action === "SKIP" && <Badge variant="muted">略過</Badge>}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-0.5 h-4 w-4" checked={completePast} onChange={(e) => setCompletePast(e.target.checked)} />
              <span>
                <strong>今天以前的工作自動標記為「已完成」</strong>
                <br />
                <span className="text-muted-foreground">已經過去的派案、發文、會議等不會再寄逾期提醒。若有尚未完成的，之後可在工作待辦中改回。</span>
              </span>
            </label>
            <Button onClick={() => void apply()} disabled={busy !== null || !rows.some((r) => r.action !== "SKIP")}>
              {busy === "apply" ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />}
              確認匯入
            </Button>
          </CardContent>
        </Card>
      )}

      {results && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" /> 匯入結果
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Table>
              <THead>
                <TR>
                  <TH>學校</TH>
                  <TH>案件編號</TH>
                  <TH>結果</TH>
                </TR>
              </THead>
              <TBody>
                {results.map((r, i) => (
                  <TR key={i}>
                    <TD className="font-medium">
                      {r.schoolName}
                      <span className="ml-2 text-xs text-muted-foreground">{r.projectName.slice(0, 5)}</span>
                    </TD>
                    <TD>{r.projectCode ?? "—"}</TD>
                    <TD>
                      {r.action === "CREATED" && <Badge variant="success">已新增</Badge>}
                      {r.action === "UPDATED" && <Badge variant="info">已更新</Badge>}
                      {r.action === "SKIPPED" && <Badge variant="muted">略過</Badge>}
                      {r.action === "FAILED" && <Badge variant="danger">失敗</Badge>}
                      {r.message && <span className="ml-2 text-sm text-red-700">{r.message}</span>}
                      {!!r.completedTasks && <span className="ml-2 text-xs text-muted-foreground">{r.completedTasks} 項過去工作已標記完成</span>}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <Button asChild variant="outline">
              <Link href="/cases">回學校案件</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
