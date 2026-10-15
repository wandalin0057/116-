"use client";
import { useCanComplete } from "@/components/layout/viewer-context";
import { CheckCircle2, FilePlus, Loader2, MailPlus, Trash2, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { markEventHeldAction, setCaseMemberAction } from "@/app/actions/cases";
import { createDocumentAction } from "@/app/actions/documents";
import { createEmailDraftAction } from "@/app/actions/emails";
import { ActionButton } from "@/components/common/action-button";
import { useAction } from "@/components/common/use-action";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function EventHeldButton({ caseId, kind, label }: { caseId: string; kind: "REVIEW_MEETING" | "SITE_VISIT"; label: string }) {
  const canComplete = useCanComplete();
  const [open, setOpen] = useState(false);
  const [attendees, setAttendees] = useState("");
  const [notes, setNotes] = useState("");
  const { run, pending } = useAction();
  if (!canComplete) return null;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <CheckCircle2 />
          標記{label}已辦理
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{label}辦理紀錄</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="attendees">出席人員</Label>
            <Textarea id="attendees" rows={2} value={attendees} onChange={(e) => setAttendees(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">紀要</Label>
            <Textarea id="notes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button disabled={pending} onClick={() => run(() => markEventHeldAction(caseId, kind, { attendees, notes }), { onSuccess: () => setOpen(false) })}>
            {pending && <Loader2 className="animate-spin" />}
            確認已辦理
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CreateDocumentButtons({ caseId }: { caseId: string }) {
  const router = useRouter();
  const { run, pending } = useAction();
  const types = [
    { type: "PRE_REPORT" as const, label: "事前規劃報告書" },
    { type: "REVIEW_DRAWING" as const, label: "審查後修正圖說" },
    { type: "SITE_VISIT_DRAWING" as const, label: "會勘後修正圖說" },
  ];
  return (
    <div className="flex flex-wrap gap-1.5">
      {types.map((t) => (
        <Button key={t.type} size="xs" variant="outline" disabled={pending} onClick={() => run(() => createDocumentAction(caseId, t.type), { refresh: false, onSuccess: (d) => d && router.push(`/documents/${d.id}`) })}>
          <FilePlus />
          {t.label}
        </Button>
      ))}
    </div>
  );
}

export function CreateEmailButtons({ caseId }: { caseId: string }) {
  const router = useRouter();
  const { run, pending } = useAction();
  const types = [
    { type: "REVIEW_SLIDES_EMAIL" as const, label: "審查前寄簡報" },
    { type: "REVIEW_MINUTES_EMAIL" as const, label: "審查會議紀錄" },
    { type: "SITE_VISIT_MINUTES_EMAIL" as const, label: "會勘紀錄" },
  ];
  return (
    <div className="flex flex-wrap gap-1.5">
      {types.map((t) => (
        <Button key={t.type} size="xs" variant="outline" disabled={pending} onClick={() => run(() => createEmailDraftAction(caseId, t.type), { refresh: false, onSuccess: (d) => d && router.push(`/emails/${d.id}`) })}>
          <MailPlus />
          {t.label}
        </Button>
      ))}
    </div>
  );
}

export function MemberManager({
  caseId,
  members,
  candidates,
  canManage,
}: {
  caseId: string;
  members: { userId: string; name: string; role: "EDITOR" | "VIEWER" }[];
  candidates: { id: string; name: string }[];
  canManage: boolean;
}) {
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<"EDITOR" | "VIEWER">("EDITOR");
  const { run, pending } = useAction();
  return (
    <div className="space-y-3">
      {members.length ? (
        <ul className="divide-y rounded-md border">
          {members.map((m) => (
            <li key={m.userId} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
              <span>
                {m.name}
                <span className="ml-2 text-xs text-muted-foreground">{m.role === "EDITOR" ? "可編輯" : "僅檢視"}</span>
              </span>
              {canManage && (
                <ActionButton size="xs" variant="ghost" action={() => setCaseMemberAction(caseId, m.userId, null)} confirm={{ title: `移除 ${m.name} 的授權？`, destructive: true, confirmLabel: "移除" }}>
                  <Trash2 />
                  移除
                </ActionButton>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">除負責人與管理員外，尚未授權其他使用者。</p>
      )}
      {canManage && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select value={userId} onChange={(e) => setUserId(e.target.value)} aria-label="選擇使用者">
            <option value="">選擇使用者…</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select value={role} onChange={(e) => setRole(e.target.value as "EDITOR" | "VIEWER")} className="sm:w-32" aria-label="權限">
            <option value="EDITOR">可編輯</option>
            <option value="VIEWER">僅檢視</option>
          </Select>
          <Button size="sm" disabled={!userId || pending} onClick={() => run(() => setCaseMemberAction(caseId, userId, role), { onSuccess: () => setUserId("") })}>
            <UserPlus />
            授權
          </Button>
        </div>
      )}
    </div>
  );
}
