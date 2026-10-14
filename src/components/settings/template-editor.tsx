"use client";
import { Loader2, Save } from "lucide-react";
import { useMemo, useState } from "react";
import { saveTemplateAction } from "@/app/actions/settings";
import { useAction } from "@/components/common/use-action";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listPlaceholders, renderTemplate } from "@/server/templates/template-renderer";

export function TemplateEditor({
  type,
  initial,
  variables,
  sampleVars,
}: {
  type: string;
  initial: { name: string; subject: string; body: string };
  variables: { key: string; label: string }[];
  sampleVars: Record<string, string>;
}) {
  const [v, setV] = useState({ ...initial, changeNote: "" });
  const { run, pending } = useAction();
  const known = new Set(variables.map((x) => x.key));
  const unknown = useMemo(() => [...listPlaceholders(v.subject), ...listPlaceholders(v.body)].filter((k) => !known.has(k)), [v.subject, v.body]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = v.name !== initial.name || v.subject !== initial.subject || v.body !== initial.body;
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="t-name">範本名稱</Label>
          <Input id="t-name" value={v.name} onChange={(e) => setV((s) => ({ ...s, name: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="t-subject">{type.endsWith("EMAIL") ? "Email 主旨" : "主旨"}</Label>
          <Textarea id="t-subject" rows={2} value={v.subject} onChange={(e) => setV((s) => ({ ...s, subject: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="t-body">{type.endsWith("EMAIL") ? "Email 內文" : "說明（每行一點）"}</Label>
          <Textarea id="t-body" rows={10} className="font-mono text-[13px]" value={v.body} onChange={(e) => setV((s) => ({ ...s, body: e.target.value }))} />
        </div>
        {unknown.length > 0 && <p className="text-sm text-amber-700">未知變數：{unknown.map((u) => `{${u}}`).join("、")}（將不會被代入）</p>}
        <div className="space-y-1.5">
          <Label htmlFor="t-note">修改說明</Label>
          <Input id="t-note" value={v.changeNote} onChange={(e) => setV((s) => ({ ...s, changeNote: e.target.value }))} placeholder="例如：配合機關要求調整文字" />
        </div>
        <Button disabled={pending || !dirty} onClick={() => run(() => saveTemplateAction(type as never, v), { onSuccess: () => setV((s) => ({ ...s, changeNote: "" })) })}>
          {pending ? <Loader2 className="animate-spin" /> : <Save />}
          儲存為新版本
        </Button>
        <div className="rounded-md border bg-slate-50 p-3">
          <p className="mb-1 text-xs font-semibold text-slate-600">範例預覽</p>
          <p className="text-sm font-medium">{renderTemplate(v.subject, sampleVars).text}</p>
          <p className="mt-2 whitespace-pre-wrap text-sm">{renderTemplate(v.body, sampleVars).text}</p>
        </div>
      </div>
      <div className="rounded-md border p-3 text-sm">
        <p className="mb-2 font-semibold">可用變數</p>
        <ul className="space-y-1">
          {variables.map((x) => (
            <li key={x.key} className="flex justify-between gap-2">
              <code className="rounded bg-slate-100 px-1 text-xs">{`{${x.key}}`}</code>
              <span className="text-xs text-muted-foreground">{x.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
