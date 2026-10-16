"use client";
import { useCanComplete } from "@/components/layout/viewer-context";
import { Ban, CheckCircle2, Eye, EyeOff, FileDown, FileText, Loader2, Printer, RotateCcw, Save, Send } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  cancelDocumentAction,
  markDocumentDispatchedAction,
  markDocumentDraftedAction,
  updateDocumentAction,
} from "@/app/actions/documents";
import { ActionButton } from "@/components/common/action-button";
import { CopyButton } from "@/components/common/copy-button";
import { useAction } from "@/components/common/use-action";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatROC, taipeiToday } from "@/lib/dates";
import { buildDocumentLayout, type LayoutOrganization } from "@/server/documents/document-layout";
import { splitBodyLines } from "@/server/documents/document-variables";
import { renderTemplate } from "@/server/templates/template-renderer";
import { DeleteDocumentButton } from "./delete-document-button";
import { DocumentPreview } from "./document-preview";

interface DocState {
  id: string;
  status: "DRAFT" | "DRAFTED" | "DISPATCHED" | "CANCELLED";
  documentNumber: string | null;
  recipient: string;
  subject: string;
  body: string;
  attachments: string;
  attachmentUrl: string;
  attachmentPassword: string;
  downloadDeadline: string;
  primaryRecipients: string;
  ccRecipients: string;
  draftDate: string;
  dispatchDate: string;
}

const KEEP = ["attachmentPassword", "attachmentUrl", "downloadDeadlineROC"];

/** YYYY-MM-DD ＋ n 天 */
function plusDays(date: string, n: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function DocumentEditor({
  doc: initial,
  canEdit,
  template,
  baseVars,
  companyName,
  organization,
  schoolName,
  isAdmin = false,
  defaults = { password: null, passwordSource: null },
}: {
  defaults?: { password: string | null; passwordSource: string | null };
  doc: DocState;
  canEdit: boolean;
  template: { subject: string; body: string };
  baseVars: Record<string, string>;
  companyName: string;
  organization?: LayoutOrganization;
  schoolName: string;
  isAdmin?: boolean;
}) {
  const [d, setD] = useState(initial);
  const canComplete = useCanComplete();
  const [saved, setSaved] = useState(initial);
  const [showPw, setShowPw] = useState(false);
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [docNumber, setDocNumber] = useState("");
  const [dispatchDate, setDispatchDate] = useState(initial.dispatchDate || taipeiToday());
  const { run, pending } = useAction();
  const locked = !canEdit || d.status === "DISPATCHED" || d.status === "CANCELLED";
  const dirty = JSON.stringify(d) !== JSON.stringify(saved);
  const set = (k: keyof DocState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setD((s) => ({ ...s, [k]: e.target.value }));

  const vars = useMemo(
    () => ({
      ...baseVars,
      attachmentUrl: d.attachmentUrl,
      attachmentPassword: d.attachmentPassword,
      downloadDeadlineROC: d.downloadDeadline ? formatROC(d.downloadDeadline) : "",
    }),
    [baseVars, d.attachmentUrl, d.attachmentPassword, d.downloadDeadline],
  );
  const subject = renderTemplate(d.subject, vars);
  const body = renderTemplate(d.body, vars);
  const missing = [...new Set([...subject.missing, ...body.missing])];
  const layout = buildDocumentLayout({
    companyName,
    organization,
    status: d.status,
    recipient: d.recipient,
    dispatchDate: d.dispatchDate ? new Date(`${d.dispatchDate}T00:00:00Z`) : null,
    documentNumber: d.documentNumber,
    attachments: d.attachments,
    subject: subject.text,
    bodyLines: splitBodyLines(body.text),
    primaryRecipients: d.primaryRecipients,
    ccRecipients: d.ccRecipients,
  });

  const save = () =>
    run(
      () =>
        updateDocumentAction(d.id, {
          recipient: d.recipient,
          subject: d.subject,
          body: d.body,
          attachments: d.attachments,
          attachmentUrl: d.attachmentUrl,
          attachmentPassword: d.attachmentPassword === saved.attachmentPassword ? undefined : d.attachmentPassword || "__CLEAR__",
          downloadDeadline: d.downloadDeadline,
          primaryRecipients: d.primaryRecipients,
          ccRecipients: d.ccRecipients,
          draftDate: d.draftDate,
          dispatchDate: d.dispatchDate,
        }),
      { onSuccess: () => setSaved(d) },
    );

  const regenerate = () => {
    setD((s) => ({ ...s, subject: renderTemplate(template.subject, baseVars, { keep: KEEP }).text, body: renderTemplate(template.body, baseVars, { keep: KEEP }).text }));
    toast.info("已依目前範本重新產生主旨及說明（尚未儲存）");
  };

  const exportGuard = (e: React.MouseEvent) => {
    if (dirty) {
      e.preventDefault();
      toast.warning("請先儲存草稿再匯出");
    }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <div className="space-y-5">
        <Card>
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle>編輯草稿</CardTitle>
            {!locked && (
              <Button variant="ghost" size="sm" onClick={regenerate}>
                <RotateCcw />
                依範本重新產生
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="recipient">受文者</Label>
                <Input id="recipient" value={d.recipient} onChange={set("recipient")} disabled={locked} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="attachments">附件</Label>
                <Input id="attachments" value={d.attachments} onChange={set("attachments")} disabled={locked} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="subject">主旨</Label>
              <Textarea id="subject" rows={3} value={d.subject} onChange={set("subject")} disabled={locked} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="body">說明（每行一點）</Label>
              <Textarea id="body" rows={7} value={d.body} onChange={set("body")} disabled={locked} className="font-mono text-[13px]" />
              <p className="text-xs text-muted-foreground">
                {"{attachmentUrl}"}、{"{attachmentPassword}"}、{"{downloadDeadlineROC}"} 會於預覽與匯出時依下方欄位代入；下載密碼不會以明文存入內文。
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5 sm:col-span-3">
                <Label htmlFor="attachmentUrl">附件網址</Label>
                <Input id="attachmentUrl" type="url" placeholder="https://" value={d.attachmentUrl} onChange={set("attachmentUrl")} disabled={locked} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="attachmentPassword">下載密碼</Label>
                <div className="relative">
                  <Input id="attachmentPassword" type={showPw ? "text" : "password"} autoComplete="off" value={d.attachmentPassword} onChange={set("attachmentPassword")} disabled={locked} />
                  <button type="button" className="absolute right-2 top-2 text-slate-500" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? "隱藏密碼" : "顯示密碼"}>
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="downloadDeadline">下載期限</Label>
                <Input id="downloadDeadline" type="date" value={d.downloadDeadline} onChange={set("downloadDeadline")} disabled={locked} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="draftDate">創稿日期</Label>
                <Input
                  id="draftDate"
                  type="date"
                  value={d.draftDate}
                  disabled={locked}
                  onChange={(e) => {
                    const v = e.target.value;
                    // 下載期限仍為「創稿日期＋14 天」時跟著創稿日期調整
                    setD((s) => ({ ...s, draftDate: v, downloadDeadline: v && (!s.downloadDeadline || s.downloadDeadline === plusDays(s.draftDate, 14)) ? plusDays(v, 14) : s.downloadDeadline }));
                  }}
                />
              </div>
              {!locked && (
                <div className="space-y-1 text-xs text-muted-foreground sm:col-span-3">
                  <p>
                    預設下載密碼：{defaults.password ? <code className="rounded bg-slate-100 px-1">{defaults.password}</code> : "（尚無提供日期）"}
                    {defaults.passwordSource && `（依「${defaults.passwordSource}」）`}；預設下載期限：創稿日期＋14 天
                    {d.draftDate && `（${plusDays(d.draftDate, 14)}）`}
                  </p>
                  {((defaults.password && d.attachmentPassword !== defaults.password) || (d.draftDate && d.downloadDeadline !== plusDays(d.draftDate, 14))) && (
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      onClick={() =>
                        setD((s) => ({
                          ...s,
                          attachmentPassword: defaults.password ?? s.attachmentPassword,
                          downloadDeadline: s.draftDate ? plusDays(s.draftDate, 14) : s.downloadDeadline,
                        }))
                      }
                    >
                      帶入預設密碼與下載期限
                    </Button>
                  )}
                </div>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="primaryRecipients">正本</Label>
                <Input id="primaryRecipients" value={d.primaryRecipients} onChange={set("primaryRecipients")} disabled={locked} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ccRecipients">副本</Label>
                <Input id="ccRecipients" value={d.ccRecipients} onChange={set("ccRecipients")} disabled={locked} />
              </div>
            </div>
            {d.status === "DISPATCHED" && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                已發文：發文字號 {d.documentNumber}，發文日期 {d.dispatchDate ? formatROC(d.dispatchDate) : "—"}
              </div>
            )}
            {missing.length > 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">尚有未填欄位：{missing.map((m) => `{${m}}`).join("、")}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>操作</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {!locked && (
              <Button onClick={() => void save()} disabled={pending || !dirty}>
                {pending ? <Loader2 className="animate-spin" /> : <Save />}
                儲存草稿
              </Button>
            )}
            <CopyButton text={subject.text} label="複製主旨" />
            <CopyButton text={() => `說明：\n${splitBodyLines(body.text).join("\n")}`} label="複製說明" />
            <Button asChild variant="outline" size="sm">
              <a href={`/api/documents/${d.id}/export?format=docx`} onClick={exportGuard}>
                <FileDown />
                匯出 DOCX
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={`/api/documents/${d.id}/export?format=pdf`} onClick={exportGuard}>
                <FileText />
                匯出 PDF
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={`/documents/${d.id}/print`} target="_blank" rel="noopener" onClick={exportGuard}>
                <Printer />
                列印
              </a>
            </Button>
            {canEdit && canComplete && d.status === "DRAFT" && (
              <ActionButton
                variant="secondary"
                size="sm"
                disabled={dirty}
                action={() => markDocumentDraftedAction(d.id)}
                onDone={() => setD((s) => ({ ...s, status: "DRAFTED" }))}
                confirm={{ title: "標記已創稿？", description: "將完成對應之「創稿」工作；提供圖說需另行標記。", confirmLabel: "標記已創稿" }}
              >
                <CheckCircle2 />
                標記已創稿
              </ActionButton>
            )}
            {canEdit && canComplete && (d.status === "DRAFT" || d.status === "DRAFTED") && (
              <Dialog open={dispatchOpen} onOpenChange={setDispatchOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="success" disabled={dirty}>
                    <Send />
                    標記已提供圖說
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>記錄提供圖說（正式發文）</DialogTitle>
                    <DialogDescription>請先於機關電子公文系統完成正式發文，再填入系統核發之正式發文字號。本系統不會自行產生發文字號。</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="docNumber">正式發文字號 *</Label>
                      <Input id="docNumber" value={docNumber} onChange={(e) => setDocNumber(e.target.value)} placeholder="例如：○○字第1150000000號" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="dispatchDate">發文日期 *</Label>
                      <Input id="dispatchDate" type="date" value={dispatchDate} onChange={(e) => setDispatchDate(e.target.value)} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setDispatchOpen(false)}>
                      取消
                    </Button>
                    <Button
                      disabled={pending || !docNumber.trim() || !dispatchDate}
                      onClick={() =>
                        run(() => markDocumentDispatchedAction(d.id, { documentNumber: docNumber, dispatchDate }), {
                          onSuccess: () => {
                            setDispatchOpen(false);
                            setD((s) => ({ ...s, status: "DISPATCHED", documentNumber: docNumber, dispatchDate }));
                          },
                        })
                      }
                    >
                      {pending && <Loader2 className="animate-spin" />}
                      確認已發文
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
            {canEdit && (d.status === "DRAFT" || d.status === "DRAFTED") && (
              <ActionButton
                variant="ghost"
                size="sm"
                className="text-red-700"
                action={() => cancelDocumentAction(d.id)}
                onDone={() => setD((s) => ({ ...s, status: "CANCELLED" }))}
                confirm={{ title: "作廢此公文草稿？", destructive: true, confirmLabel: "作廢" }}
              >
                <Ban />
                作廢
              </ActionButton>
            )}
            {canEdit && (d.status !== "DISPATCHED" || isAdmin) && (
              <DeleteDocumentButton id={d.id} schoolName={schoolName} dispatched={d.status === "DISPATCHED"} redirectTo="/documents" size="sm" />
            )}
            {dirty && <p className="w-full text-xs text-amber-700">有未儲存的變更；匯出與標記前請先儲存。</p>}
          </CardContent>
        </Card>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-slate-700">即時預覽</p>
        <div className="rounded-lg border bg-slate-100 p-3">
          <DocumentPreview layout={layout} />
        </div>
      </div>
    </div>
  );
}
