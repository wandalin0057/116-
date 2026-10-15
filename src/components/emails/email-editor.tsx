"use client";
import { Ban, CheckCircle2, Loader2, MailOpen, Save } from "lucide-react";
import { useState } from "react";
import { cancelEmailDraftAction, confirmEmailSentAction, updateEmailDraftAction } from "@/app/actions/emails";
import { ActionButton } from "@/components/common/action-button";
import { CopyButton } from "@/components/common/copy-button";
import { useAction } from "@/components/common/use-action";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DeleteEmailDraftButton } from "./delete-email-draft-button";

interface Draft {
  id: string;
  status: "DRAFT" | "CONFIRMED_SENT" | "CANCELLED";
  toRecipients: string;
  ccRecipients: string;
  subject: string;
  body: string;
  attachmentNames: string;
  attachmentUrl: string;
  eventDateTime: string;
  agencyContact: string;
}

/** 將內文中的 {attachmentUrl} 代入下載連結 */
function renderBody(d: Draft) {
  return d.attachmentUrl ? d.body.split("{attachmentUrl}").join(d.attachmentUrl) : d.body;
}

function mailto(d: Draft) {
  const split = (s: string) => s.split(/[,;，；\s]+/).filter(Boolean).join(",");
  const q = [`subject=${encodeURIComponent(d.subject)}`, `body=${encodeURIComponent(renderBody(d))}`];
  if (d.ccRecipients) q.unshift(`cc=${encodeURIComponent(split(d.ccRecipients))}`);
  return `mailto:${split(d.toRecipients)}?${q.join("&")}`;
}

export function EmailEditor({
  draft: initial,
  canEdit,
  schoolName,
  isAdmin = false,
}: {
  draft: Draft;
  canEdit: boolean;
  schoolName: string;
  isAdmin?: boolean;
}) {
  const [d, setD] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const { run, pending } = useAction();
  const locked = !canEdit || d.status !== "DRAFT";
  const needsUrl = d.body.includes("{attachmentUrl}");
  const dirty = JSON.stringify(d) !== JSON.stringify(saved);
  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setD((s) => ({ ...s, [k]: e.target.value }));

  const save = () =>
    run(
      () =>
        updateEmailDraftAction(d.id, {
          toRecipients: d.toRecipients,
          ccRecipients: d.ccRecipients,
          subject: d.subject,
          body: d.body,
          attachmentNames: d.attachmentNames,
          attachmentUrl: d.attachmentUrl,
          eventDateTime: d.eventDateTime || undefined,
        }),
      { onSuccess: () => setSaved(d) },
    );

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>編輯草稿</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
            本系統不會自動寄送此 Email。請確認附件（{d.attachmentNames || "未填寫"}）後，由您自行以郵件程式寄出。
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="to">收件人（機關承辦人 {d.agencyContact || "—"}）</Label>
              <Input id="to" value={d.toRecipients} onChange={set("toRecipients")} disabled={locked} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cc">副本</Label>
              <Input id="cc" value={d.ccRecipients} onChange={set("ccRecipients")} disabled={locked} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="event">會議或會勘日期時間</Label>
              <Input id="event" type="datetime-local" value={d.eventDateTime} onChange={set("eventDateTime")} disabled={locked} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="att">附件名稱</Label>
              <Input id="att" value={d.attachmentNames} onChange={set("attachmentNames")} disabled={locked} />
            </div>
          </div>
          {(needsUrl || d.attachmentUrl) && (
            <div className="space-y-1.5">
              <Label htmlFor="url">下載連結（例如 Google Drive 分享連結）</Label>
              <Input id="url" type="url" placeholder="https://drive.google.com/…" value={d.attachmentUrl} onChange={set("attachmentUrl")} disabled={locked} />
              <p className="text-xs text-muted-foreground">內文中的 {"{attachmentUrl}"} 會自動換成這個連結。</p>
            </div>
          )}
          {needsUrl && !d.attachmentUrl && <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-sm text-amber-800">請填寫下載連結，內文才會出現連結。</p>}
          <div className="space-y-1.5">
            <Label htmlFor="subject">主旨</Label>
            <Input id="subject" value={d.subject} onChange={set("subject")} disabled={locked} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="body">內文</Label>
            <Textarea id="body" rows={14} value={d.body} onChange={set("body")} disabled={locked} />
          </div>
          <div className="flex flex-wrap gap-2">
            {!locked && (
              <Button onClick={() => void save()} disabled={pending || !dirty}>
                {pending ? <Loader2 className="animate-spin" /> : <Save />}
                儲存草稿
              </Button>
            )}
            <CopyButton text={d.toRecipients} label="複製收件人" />
            <CopyButton text={d.subject} label="複製主旨" />
            <CopyButton text={() => renderBody(d)} label="複製內文" />
            <Button asChild variant="outline" size="sm">
              <a href={mailto(d)}>
                <MailOpen />
                以郵件程式開啟
              </a>
            </Button>
            {canEdit && (d.status !== "CONFIRMED_SENT" || isAdmin) && (
              <DeleteEmailDraftButton id={d.id} schoolName={schoolName} sent={d.status === "CONFIRMED_SENT"} redirectTo="/emails" size="sm" />
            )}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>預覽</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">收件人：</span>
              {d.toRecipients || "（未填）"}
            </p>
            {d.ccRecipients && (
              <p>
                <span className="text-muted-foreground">副本：</span>
                {d.ccRecipients}
              </p>
            )}
            <p>
              <span className="text-muted-foreground">主旨：</span>
              <span className="font-medium">{d.subject}</span>
            </p>
            <p>
              <span className="text-muted-foreground">附件：</span>
              {d.attachmentNames || "—"}
            </p>
            <div className="mt-2 whitespace-pre-wrap break-all rounded-md border bg-white p-4 leading-relaxed">{renderBody(d)}</div>
          </CardContent>
        </Card>
        {canEdit && d.status === "DRAFT" && (
          <Card>
            <CardHeader>
              <CardTitle>寄出確認</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <DialogTrigger asChild>
                  <Button variant="success" disabled={dirty}>
                    <CheckCircle2 />
                    我已寄出，標記完成
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>確認已寄出？</DialogTitle>
                    <DialogDescription>系統不會代為寄送。請確認您已使用郵件程式將此 Email 及正確附件寄給 {d.toRecipients}。</DialogDescription>
                  </DialogHeader>
                  <label className="flex items-start gap-2 text-sm">
                    <input type="checkbox" className="mt-0.5 h-4 w-4" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
                    我確認已自行寄出此 Email，且附件內容正確。
                  </label>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setConfirmOpen(false)}>
                      取消
                    </Button>
                    <Button
                      disabled={!checked || pending}
                      onClick={() =>
                        run(() => confirmEmailSentAction(d.id), {
                          onSuccess: () => {
                            setConfirmOpen(false);
                            setD((s) => ({ ...s, status: "CONFIRMED_SENT" }));
                          },
                        })
                      }
                    >
                      {pending && <Loader2 className="animate-spin" />}
                      確認標記
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <ActionButton
                variant="ghost"
                className="text-red-700"
                action={() => cancelEmailDraftAction(d.id)}
                onDone={() => setD((s) => ({ ...s, status: "CANCELLED" }))}
                confirm={{ title: "作廢此 Email 草稿？", destructive: true, confirmLabel: "作廢" }}
              >
                <Ban />
                作廢
              </ActionButton>
              {dirty && <p className="w-full text-xs text-amber-700">有未儲存的變更，請先儲存。</p>}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
