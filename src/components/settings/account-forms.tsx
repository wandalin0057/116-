"use client";
import { Loader2, Save, Send } from "lucide-react";
import { useState } from "react";
import {
  changeOwnPasswordAction,
  sendTestEmailAction,
  updateEmailSettingsAction,
  saveSignatureAction,
  updateOrganizationAction,
  updateReminderPreferenceAction,
} from "@/app/actions/settings";
import { useAction } from "@/components/common/use-action";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { DEFAULT_SIGNATURE_STYLE, SIGNATURE_FONTS, signatureHtml, type SignatureData, type SignatureStyle } from "@/lib/signature";
import { Label } from "@/components/ui/label";

export function ChangePasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const { run, pending } = useAction();
  const mismatch = confirm.length > 0 && next !== confirm;
  return (
    <form
      className="max-w-sm space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        void run(() => changeOwnPasswordAction(current, next), {
          onSuccess: () => {
            setCurrent("");
            setNext("");
            setConfirm("");
          },
        });
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="cur">目前密碼</Label>
        <Input id="cur" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="new">新密碼</Label>
        <Input id="new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required />
        <p className="text-xs text-muted-foreground">至少 10 個字元，需包含英文字母與數字。</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cf">確認新密碼</Label>
        <Input id="cf" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        {mismatch && <p className="text-xs text-red-600">兩次輸入不一致</p>}
      </div>
      <Button type="submit" disabled={pending || mismatch || !next}>
        {pending ? <Loader2 className="animate-spin" /> : <Save />}
        變更密碼
      </Button>
    </form>
  );
}

export function ReminderPreferenceForm({
  initial,
  isAdmin = false,
}: {
  initial: { emailEnabled: boolean; leadBusinessDays: number; overdueEnabled: boolean; dailyDigestEnabled: boolean; managerDigestEnabled: boolean };
  isAdmin?: boolean;
}) {
  const [v, setV] = useState(initial);
  const { run, pending } = useAction();
  const toggle = (k: "emailEnabled" | "overdueEnabled" | "dailyDigestEnabled" | "managerDigestEnabled", label: string, desc: string) => (
    <label className="flex items-start gap-3 rounded-md border p-3">
      <input type="checkbox" className="mt-0.5 h-4 w-4" checked={v[k]} onChange={(e) => setV((s) => ({ ...s, [k]: e.target.checked }))} />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{desc}</span>
      </span>
    </label>
  );
  return (
    <form
      className="max-w-lg space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        void run(() => updateReminderPreferenceAction(v));
      }}
    >
      {toggle("emailEnabled", "接收 Email 通知", "關閉後不會收到任何系統提醒信")}
      {toggle("dailyDigestEnabled", "接收每日摘要", "每個工作天上午 8:00 寄送今日到期、即將到期與逾期工作")}
      {isAdmin &&
        toggle(
          "managerDigestEnabled",
          "改收「全部學校總表」（專案經理）",
          "每天收到一封整理所有學校、標示各負責人的總表，取代上面只含自己負責學校的摘要。各負責人仍會收到自己的提醒信。",
        )}
      {toggle("overdueEnabled", "接收逾期通知", "於每日摘要中列出已逾期且未完成之工作")}
      <div className="space-y-1.5">
        <Label htmlFor="lead">提前提醒工作天數</Label>
        <Input id="lead" type="number" min={0} max={20} className="w-32" value={v.leadBusinessDays} onChange={(e) => setV((s) => ({ ...s, leadBusinessDays: Number(e.target.value) }))} />
        <p className="text-xs text-muted-foreground">列出未來 N 個工作天內到期之工作（預設 3）。</p>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <Save />}
        儲存通知設定
      </Button>
    </form>
  );
}

export function EmailSettingsForm({ initial }: { initial: { testMode: boolean; testRecipient: string; skipNonBusinessDays: boolean } }) {
  const [v, setV] = useState(initial);
  const [testTo, setTestTo] = useState(initial.testRecipient);
  const { run, pending } = useAction();
  return (
    <div className="max-w-lg space-y-4">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void run(() => updateEmailSettingsAction(v));
        }}
      >
        <label className="flex items-start gap-3 rounded-md border p-3">
          <input type="checkbox" className="mt-0.5 h-4 w-4" checked={v.testMode} onChange={(e) => setV((s) => ({ ...s, testMode: e.target.checked }))} />
          <span>
            <span className="block text-sm font-medium">測試模式</span>
            <span className="text-xs text-muted-foreground">啟用時所有每日提醒改寄至測試收件人，主旨加註［測試］。正式上線前請先以測試模式驗證。</span>
          </span>
        </label>
        <div className="space-y-1.5">
          <Label htmlFor="testRecipient">測試收件人</Label>
          <Input id="testRecipient" type="email" value={v.testRecipient} onChange={(e) => setV((s) => ({ ...s, testRecipient: e.target.value }))} />
        </div>
        <label className="flex items-start gap-3 rounded-md border p-3">
          <input type="checkbox" className="mt-0.5 h-4 w-4" checked={v.skipNonBusinessDays} onChange={(e) => setV((s) => ({ ...s, skipNonBusinessDays: e.target.checked }))} />
          <span>
            <span className="block text-sm font-medium">非工作天不寄送</span>
            <span className="text-xs text-muted-foreground">週末與國定假日不寄送每日提醒（依工作日曆判定）。</span>
          </span>
        </label>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Save />}
          儲存 Email 設定
        </Button>
      </form>
      <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="testTo">寄送測試信至</Label>
          <Input id="testTo" type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
        </div>
        <Button variant="outline" disabled={pending} onClick={() => run(() => sendTestEmailAction(testTo), { refresh: false })}>
          <Send />
          寄送測試信
        </Button>
      </div>
    </div>
  );
}

type Org = { companyName: string; address: string; contactName: string; phone: string; fax: string; email: string };

export function OrganizationForm({ initial }: { initial: Org }) {
  const [v, setV] = useState(initial);
  const { run, pending } = useAction();
  const field = (k: keyof Org, label: string, placeholder: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={`org-${k}`}>{label}</Label>
      <Input id={`org-${k}`} value={v[k]} placeholder={placeholder} onChange={(e) => setV((s) => ({ ...s, [k]: e.target.value }))} />
    </div>
  );
  return (
    <form
      className="grid max-w-2xl gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        void run(() => updateOrganizationAction(v));
      }}
    >
      <div className="sm:col-span-2">{field("companyName", "公司名稱（公文抬頭）", "○○工程顧問股份有限公司")}</div>
      <div className="sm:col-span-2">{field("address", "地址", "110048 臺北市信義區○○路○號○樓")}</div>
      {field("contactName", "聯絡人", "王小明")}
      {field("phone", "電話", "02-2748-8822#6685")}
      {field("fax", "傳真", "02-2748-6600")}
      {field("email", "電子郵件", "name@company.com.tw")}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Save />}
          儲存發文單位資訊
        </Button>
      </div>
    </form>
  );
}

const SIG_MAX_WIDTH = 600;
const SIG_MAX_CHARS = 400_000;

/** 讀取圖片並縮小（寬度上限 480px），回傳 data URL */
async function shrinkImage(file: File): Promise<string> {
  const src = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("讀取失敗"));
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("無法讀取這張圖片"));
    i.src = src;
  });
  const scale = Math.min(1, SIG_MAX_WIDTH / img.naturalWidth);
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const keepAlpha = file.type === "image/png" || file.type === "image/gif" || file.type === "image/webp";
  if (!keepAlpha) {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
  }
  ctx.drawImage(img, 0, 0, w, h);
  let out = canvas.toDataURL(keepAlpha ? "image/png" : "image/jpeg", 0.9);
  // 仍過大時改用 JPEG 並逐步降低品質
  for (let q = 0.85; out.length > SIG_MAX_CHARS && q >= 0.4; q -= 0.15) {
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    out = canvas.toDataURL("image/jpeg", q);
  }
  return out;
}

const PT_OPTIONS = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24];

export function SignatureEditor({ initial, namePlaceholder }: { initial: SignatureData; namePlaceholder: string }) {
  const [text, setText] = useState(initial.text);
  const [image, setImage] = useState<string | null>(initial.image);
  const [style, setStyle] = useState<SignatureStyle>(initial.style);
  const [err, setErr] = useState("");
  const { run, pending } = useAction();
  const set = <K extends keyof SignatureStyle>(k: K, v: SignatureStyle[K]) => setStyle((s) => ({ ...s, [k]: v }));
  const dirty = text !== initial.text || image !== initial.image || JSON.stringify(style) !== JSON.stringify(initial.style);

  const sizeSelect = (id: string, value: number, onChange: (n: number) => void, max = 24) => (
    <Select id={id} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-24">
      {PT_OPTIONS.filter((n) => n <= max).map((n) => (
        <option key={n} value={n}>
          {n} pt
        </option>
      ))}
    </Select>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-5">
        <section className="space-y-2">
          <Label htmlFor="sig-text">簽名文字（第一行通常是姓名與職稱）</Label>
          <Textarea id="sig-text" rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder={namePlaceholder} />
        </section>

        <section className="space-y-3 rounded-md border p-3">
          <p className="text-sm font-semibold">文字樣式</p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="sig-font">字型</Label>
              <Select id="sig-font" value={style.fontFamily} onChange={(e) => set("fontFamily", e.target.value as SignatureStyle["fontFamily"])} className="w-36">
                {Object.entries(SIGNATURE_FONTS).map(([k, f]) => (
                  <option key={k} value={k}>
                    {f.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="sig-size">文字大小</Label>
              {sizeSelect("sig-size", style.fontSizePt, (n) => set("fontSizePt", n))}
            </div>
            <div className="space-y-1">
              <Label htmlFor="sig-color">文字顏色</Label>
              <Input id="sig-color" type="color" value={style.color} onChange={(e) => set("color", e.target.value)} className="h-9 w-16 p-1" />
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-3 border-t pt-3">
            <div className="space-y-1">
              <Label htmlFor="sig-first-size">第一行大小</Label>
              {sizeSelect("sig-first-size", style.firstLineSizePt, (n) => set("firstLineSizePt", n))}
            </div>
            <div className="space-y-1">
              <Label htmlFor="sig-first-color">第一行顏色</Label>
              <Input id="sig-first-color" type="color" value={style.firstLineColor} onChange={(e) => set("firstLineColor", e.target.value)} className="h-9 w-16 p-1" />
            </div>
            <label className="flex h-9 items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4" checked={style.firstLineBold} onChange={(e) => set("firstLineBold", e.target.checked)} />
              第一行粗體
            </label>
          </div>
        </section>

        <section className="space-y-3 rounded-md border p-3">
          <p className="text-sm font-semibold">簽名圖片</p>
          <Input
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            aria-label="選擇簽名圖片"
            onChange={async (e) => {
              setErr("");
              const f = e.target.files?.[0];
              if (!f) return;
              if (f.size > 10_000_000) return setErr("檔案超過 10MB，請換一張較小的圖片");
              try {
                const data = await shrinkImage(f);
                if (data.length > SIG_MAX_CHARS) return setErr("圖片太大，請換一張較小的圖片");
                setImage(data);
              } catch (x) {
                setErr(x instanceof Error ? x.message : "無法讀取圖片");
              }
            }}
          />
          {err && <p className="text-sm text-red-600">{err}</p>}
          {image && (
            <>
              <div className="space-y-1">
                <Label htmlFor="sig-img-width">圖片寬度：{style.imageWidth} 像素</Label>
                <input
                  id="sig-img-width"
                  type="range"
                  min={40}
                  max={600}
                  step={10}
                  value={style.imageWidth}
                  onChange={(e) => set("imageWidth", Number(e.target.value))}
                  className="w-full accent-[hsl(var(--primary))]"
                />
                <div className="flex gap-1">
                  {[120, 180, 240, 320, 480].map((w) => (
                    <Button key={w} type="button" size="xs" variant={style.imageWidth === w ? "default" : "outline"} onClick={() => set("imageWidth", w)}>
                      {w}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Label htmlFor="sig-img-pos">圖片位置</Label>
                <Select id="sig-img-pos" value={style.imagePosition} onChange={(e) => set("imagePosition", e.target.value as SignatureStyle["imagePosition"])} className="w-32">
                  <option value="below">文字下方</option>
                  <option value="above">文字上方</option>
                </Select>
                <Button type="button" variant="outline" size="sm" onClick={() => setImage(null)}>
                  移除圖片
                </Button>
              </div>
            </>
          )}
          <p className="text-xs text-muted-foreground">建議使用公司 Logo 或名片圖檔（PNG／JPG），過大的圖片會自動縮小。</p>
        </section>

        <div className="flex flex-wrap gap-2">
          <Button disabled={pending || !dirty} onClick={() => run(() => saveSignatureAction({ text, image, style }))}>
            {pending ? <Loader2 className="animate-spin" /> : <Save />}
            儲存簽名檔
          </Button>
          <Button type="button" variant="ghost" onClick={() => setStyle(DEFAULT_SIGNATURE_STYLE)}>
            樣式恢復預設
          </Button>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-slate-700">即時預覽（收件人看到的樣子）</p>
        <div className="rounded-md border bg-white p-4">
          <p className="mb-3 text-sm text-slate-500">您好，……請查收，謝謝。</p>
          <div
            // 由 signatureHtml 產生：文字已跳脫、樣式經白名單驗證
            dangerouslySetInnerHTML={{ __html: signatureHtml({ text: text || namePlaceholder, image, style }) }}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">儲存後，Email 草稿的 {"{signature}"} 會套用這個簽名檔；使用「複製內文（含簽名圖片）」貼到 Outlook 即可保留樣式與圖片。</p>
      </div>
    </div>
  );
}
