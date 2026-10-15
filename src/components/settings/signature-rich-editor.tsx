"use client";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { Color, FontFamily, FontSize, TextStyle } from "@tiptap/extension-text-style";
import { Bold, ImagePlus, Italic, Link2, Link2Off, Loader2, Redo2, RemoveFormatting, Save, Underline, Undo2 } from "lucide-react";
import { useRef, useState } from "react";
import { saveSignatureHtmlAction } from "@/app/actions/settings";
import { useAction } from "@/components/common/use-action";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { shrinkImage, SIG_MAX_CHARS } from "./signature-image";

const FONTS = [
  { label: "微軟正黑體", value: "'Microsoft JhengHei', sans-serif" },
  { label: "新細明體", value: "PMingLiU, serif" },
  { label: "標楷體", value: "DFKai-SB, BiauKai, serif" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Calibri", value: "Calibri, sans-serif" },
  { label: "Times New Roman", value: "'Times New Roman', serif" },
];
const SIZES = ["8pt", "9pt", "10pt", "10.5pt", "11pt", "12pt", "14pt", "16pt", "18pt", "20pt", "24pt", "28pt"];
const SWATCHES = ["#000000", "#404040", "#7f7f7f", "#1f3864", "#2e75b6", "#c00000", "#e46c0a", "#00b050", "#7030a0"];

/** 使用者輸入的連結：Email → mailto:、電話 → tel:、其他補 https:// */
export function normalizeLink(input: string): string {
  const v = input.trim();
  if (!v) return "";
  if (/^(https?:|mailto:|tel:)/i.test(v)) return v;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return `mailto:${v}`;
  if (/^[+()\d\s\-#]{6,}$/.test(v)) return `tel:${v.replace(/[^\d+]/g, "")}`;
  return `https://${v}`;
}

function ToolButton({ active, onClick, title, children, disabled }: { active?: boolean; onClick: () => void; title: string; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn("inline-flex h-8 w-8 items-center justify-center rounded hover:bg-slate-100 disabled:opacity-40", active && "bg-slate-200 text-primary")}
    >
      {children}
    </button>
  );
}

/** 目前游標／選取範圍的格式（供工具列顯示） */
function toolbarState(e: Editor) {
  const ts = e.getAttributes("textStyle");
  return {
    bold: e.isActive("bold"),
    italic: e.isActive("italic"),
    underline: e.isActive("underline"),
    link: e.isActive("link"),
    image: e.isActive("image"),
    imageWidth: (e.getAttributes("image").width as number | undefined) ?? null,
    fontFamily: (ts.fontFamily as string | undefined) ?? "",
    fontSize: (ts.fontSize as string | undefined) ?? "",
    color: (ts.color as string | undefined) ?? "",
    canUndo: e.can().undo(),
    canRedo: e.can().redo(),
    html: e.getHTML(),
  };
}

export function SignatureRichEditor({ initialHtml }: { initialHtml: string }) {
  const { run, pending } = useAction();
  const fileRef = useRef<HTMLInputElement>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [err, setErr] = useState("");
  const [savedHtml, setSavedHtml] = useState(initialHtml);

  const editor = useEditor({
    immediatelyRender: false,
    // 每次游標移動／編輯都重新整理工具列狀態（簽名檔內容很小，效能無虞）
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        code: false,
        blockquote: false,
        horizontalRule: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: "https", protocols: ["mailto", "tel"] },
      }),
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      Image.configure({ allowBase64: true, inline: false, resize: { enabled: true, directions: ["bottom-right", "bottom-left", "right"], minWidth: 30, alwaysPreserveAspectRatio: true } }),
    ],
    content: initialHtml,
    editorProps: {
      attributes: {
        class: "signature-editor min-h-[180px] rounded-b-md border border-t-0 bg-white p-3 text-[10pt] leading-snug focus:outline-none",
        "aria-label": "簽名檔內容",
      },
    },
  });

  if (!editor) return <div className="h-60 animate-pulse rounded-md bg-slate-100" />;
  const st = toolbarState(editor);
  const chain = () => editor.chain().focus();
  const dirty = st.html !== savedHtml;

  const applyLink = () => {
    const href = normalizeLink(linkValue);
    if (!href) {
      chain().extendMarkRange("link").unsetLink().run();
    } else if (editor.state.selection.empty && !st.link) {
      const text = linkValue.trim();
      chain().insertContent({ type: "text", text, marks: [{ type: "link", attrs: { href } }] }).run();
    } else {
      chain().extendMarkRange("link").setLink({ href }).run();
    }
    setLinkOpen(false);
    setLinkValue("");
  };

  return (
    <div className="space-y-3">
      <div>
        <div className="flex flex-wrap items-center gap-1 rounded-t-md border bg-slate-50 p-1.5">
          <Select
            aria-label="字型"
            className="h-8 w-32 text-xs"
            value={FONTS.find((f) => f.value === st.fontFamily)?.value ?? ""}
            onChange={(e) => (e.target.value ? chain().setFontFamily(e.target.value).run() : chain().unsetFontFamily().run())}
          >
            <option value="">字型</option>
            {FONTS.map((f) => (
              <option key={f.label} value={f.value}>
                {f.label}
              </option>
            ))}
          </Select>
          <Select
            aria-label="文字大小"
            className="h-8 w-20 text-xs"
            value={SIZES.includes(st.fontSize) ? st.fontSize : ""}
            onChange={(e) => (e.target.value ? chain().setFontSize(e.target.value).run() : chain().unsetFontSize().run())}
          >
            <option value="">大小</option>
            {SIZES.map((s) => (
              <option key={s} value={s}>
                {s.replace("pt", "")}
              </option>
            ))}
          </Select>
          <span className="mx-1 h-6 w-px bg-slate-300" />
          <ToolButton title="粗體" active={st.bold} onClick={() => chain().toggleBold().run()}>
            <Bold className="h-4 w-4" />
          </ToolButton>
          <ToolButton title="斜體" active={st.italic} onClick={() => chain().toggleItalic().run()}>
            <Italic className="h-4 w-4" />
          </ToolButton>
          <ToolButton title="底線" active={st.underline} onClick={() => chain().toggleUnderline().run()}>
            <Underline className="h-4 w-4" />
          </ToolButton>
          <span className="mx-1 h-6 w-px bg-slate-300" />
          <div className="flex items-center gap-0.5" role="group" aria-label="文字顏色">
            {SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                title={`文字顏色 ${c}`}
                aria-label={`文字顏色 ${c}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => chain().setColor(c).run()}
                className={cn("h-5 w-5 rounded-sm border", st.color.toLowerCase() === c && "ring-2 ring-primary ring-offset-1")}
                style={{ backgroundColor: c }}
              />
            ))}
            <input
              type="color"
              aria-label="自訂文字顏色"
              title="自訂文字顏色"
              value={/^#[0-9a-f]{6}$/i.test(st.color) ? st.color : "#000000"}
              onChange={(e) => chain().setColor(e.target.value).run()}
              className="h-6 w-7 cursor-pointer rounded border bg-white p-0.5"
            />
          </div>
          <span className="mx-1 h-6 w-px bg-slate-300" />
          <ToolButton
            title="插入超連結（網址、Email 或電話）"
            active={st.link}
            onClick={() => {
              setLinkValue((editor.getAttributes("link").href as string | undefined)?.replace(/^(mailto:|tel:)/, "") ?? "");
              setLinkOpen((o) => !o);
            }}
          >
            <Link2 className="h-4 w-4" />
          </ToolButton>
          <ToolButton title="移除超連結" disabled={!st.link} onClick={() => chain().extendMarkRange("link").unsetLink().run()}>
            <Link2Off className="h-4 w-4" />
          </ToolButton>
          <ToolButton title="插入圖片" onClick={() => fileRef.current?.click()}>
            <ImagePlus className="h-4 w-4" />
          </ToolButton>
          <ToolButton title="清除格式" onClick={() => chain().unsetAllMarks().run()}>
            <RemoveFormatting className="h-4 w-4" />
          </ToolButton>
          <span className="mx-1 h-6 w-px bg-slate-300" />
          <ToolButton title="復原" disabled={!st.canUndo} onClick={() => chain().undo().run()}>
            <Undo2 className="h-4 w-4" />
          </ToolButton>
          <ToolButton title="重做" disabled={!st.canRedo} onClick={() => chain().redo().run()}>
            <Redo2 className="h-4 w-4" />
          </ToolButton>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            className="hidden"
            aria-label="選擇簽名圖片"
            onChange={async (e) => {
              setErr("");
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              if (f.size > 10_000_000) return setErr("檔案超過 10MB，請換一張較小的圖片");
              try {
                const src = await shrinkImage(f);
                if (src.length > SIG_MAX_CHARS) return setErr("圖片太大，請換一張較小的圖片");
                chain().setImage({ src, width: 240 }).run();
              } catch (x) {
                setErr(x instanceof Error ? x.message : "無法讀取圖片");
              }
            }}
          />
        </div>

        {linkOpen && (
          <div className="flex flex-wrap items-center gap-2 border-x bg-blue-50 p-2">
            <Input
              autoFocus
              aria-label="連結網址"
              className="h-8 max-w-sm text-sm"
              placeholder="網址、Email 或電話，例如 wanda@thi.com.tw"
              value={linkValue}
              onChange={(e) => setLinkValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyLink();
                }
              }}
            />
            <Button size="sm" type="button" onClick={applyLink}>
              套用連結
            </Button>
            <Button size="sm" type="button" variant="ghost" onClick={() => setLinkOpen(false)}>
              取消
            </Button>
            <span className="text-xs text-muted-foreground">先選取文字再按連結；Email 會自動變成「寄信」連結，電話會變成撥號連結。</span>
          </div>
        )}

        {st.image && (
          <div className="flex flex-wrap items-center gap-2 border-x bg-amber-50 p-2 text-sm">
            <span>圖片寬度：</span>
            {[120, 180, 240, 320, 480].map((w) => (
              <Button
                key={w}
                type="button"
                size="xs"
                variant={st.imageWidth === w ? "default" : "outline"}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => chain().updateAttributes("image", { width: w, height: null }).run()}
              >
                {w}
              </Button>
            ))}
            <Input
              type="number"
              aria-label="圖片寬度（像素）"
              className="h-7 w-20 text-xs"
              min={30}
              max={600}
              value={st.imageWidth ?? ""}
              onChange={(e) => {
                const w = Math.max(30, Math.min(600, Number(e.target.value) || 0));
                if (w) editor.chain().updateAttributes("image", { width: w, height: null }).run();
              }}
            />
            <span className="text-xs text-muted-foreground">像素；也可以直接拖曳圖片右下角調整</span>
          </div>
        )}

        <EditorContent editor={editor} />
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <p className="text-xs text-muted-foreground">
        像 Word 一樣：先<strong>選取文字</strong>，再按上方按鈕調整字型、大小、顏色、粗體或加上超連結。按 Enter 換段、Shift+Enter 換行。
      </p>
      <div className="flex gap-2">
        <Button
          disabled={pending || !dirty}
          onClick={() =>
            run(() => saveSignatureHtmlAction(editor.getHTML()), {
              onSuccess: (html) => {
                if (typeof html === "string") {
                  editor.commands.setContent(html, { emitUpdate: false });
                  setSavedHtml(editor.getHTML());
                }
              },
            })
          }
        >
          {pending ? <Loader2 className="animate-spin" /> : <Save />}
          儲存簽名檔
        </Button>
        {dirty && <span className="self-center text-xs text-amber-700">有未儲存的變更</span>}
      </div>
    </div>
  );
}
