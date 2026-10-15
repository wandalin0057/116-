import { z } from "zod";

/**
 * Email 簽名檔樣式與 HTML 產生（純函式，前後端共用）。
 * 樣式值皆經過白名單／格式驗證，避免注入任意 CSS。
 */
export const SIGNATURE_FONTS = {
  jhenghei: { label: "微軟正黑體", css: "'Microsoft JhengHei','PingFang TC','Noto Sans TC',sans-serif" },
  mingliu: { label: "新細明體", css: "PMingLiU,'MingLiU','Noto Serif TC',serif" },
  kai: { label: "標楷體", css: "DFKai-SB,BiauKai,'標楷體',serif" },
  arial: { label: "Arial", css: "Arial,Helvetica,sans-serif" },
} as const;

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "顏色格式錯誤");

export const signatureStyleSchema = z.object({
  fontFamily: z.enum(["jhenghei", "mingliu", "kai", "arial"]),
  fontSizePt: z.number().int().min(8).max(24),
  color: hex,
  firstLineBold: z.boolean(),
  firstLineSizePt: z.number().int().min(8).max(28),
  firstLineColor: hex,
  imageWidth: z.number().int().min(40).max(600),
  imagePosition: z.enum(["below", "above"]),
});

export type SignatureStyle = z.infer<typeof signatureStyleSchema>;

export const DEFAULT_SIGNATURE_STYLE: SignatureStyle = {
  fontFamily: "jhenghei",
  fontSizePt: 10,
  color: "#404040",
  firstLineBold: true,
  firstLineSizePt: 12,
  firstLineColor: "#1f3864",
  imageWidth: 240,
  imagePosition: "below",
};

/** 讀取資料庫中的樣式；缺漏或不合法的欄位使用預設值 */
export function normalizeSignatureStyle(raw: unknown): SignatureStyle {
  const base = { ...DEFAULT_SIGNATURE_STYLE };
  if (!raw || typeof raw !== "object") return base;
  for (const key of Object.keys(base) as (keyof SignatureStyle)[]) {
    const r = signatureStyleSchema.shape[key].safeParse((raw as Record<string, unknown>)[key]);
    if (r.success) (base as Record<string, unknown>)[key] = r.data;
  }
  return base;
}

export interface SignatureData {
  text: string;
  image: string | null;
  style: SignatureStyle;
}

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const linkify = (s: string) => s.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>');
const isSafeImage = (src: string) => /^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(src);

/** 簽名檔 HTML：第一行（姓名職稱）可獨立設定大小顏色粗體 */
export function signatureHtml(sig: SignatureData): string {
  const s = sig.style;
  const font = SIGNATURE_FONTS[s.fontFamily].css;
  const lines = sig.text.replace(/\r\n/g, "\n").split("\n");
  const textHtml = lines
    .map((line, i) => {
      const content = linkify(escapeHtml(line)) || "&nbsp;";
      return i === 0
        ? `<div style="font-size:${s.firstLineSizePt}pt;color:${s.firstLineColor};${s.firstLineBold ? "font-weight:bold;" : ""}">${content}</div>`
        : `<div>${content}</div>`;
    })
    .join("");
  const text = sig.text.trim() ? `<div style="font-family:${font};font-size:${s.fontSizePt}pt;color:${s.color};line-height:1.5">${textHtml}</div>` : "";
  const img =
    sig.image && isSafeImage(sig.image)
      ? `<div style="margin:6px 0"><img src="${sig.image}" alt="簽名圖片" width="${s.imageWidth}" style="width:${s.imageWidth}px;max-width:100%;height:auto;border:0"></div>`
      : "";
  return s.imagePosition === "above" ? img + text : text + img;
}

/** 純文字版本中 {signature} 的替代文字 */
export function signatureText(sig: SignatureData | null, fallback = ""): string {
  return sig?.text.trim() || fallback;
}

/**
 * Email 內文轉 HTML：內文保留換行、網址轉連結；{signature} 換成樣式化簽名檔。
 * 內文沒有 {signature}（舊草稿）時，簽名圖片接在最後。
 */
export function buildEmailHtml(body: string, sig: SignatureData | null): string {
  const part = (t: string) => linkify(escapeHtml(t)).replace(/\n/g, "<br>");
  const segments = body.split("{signature}");
  let html: string;
  if (segments.length > 1) {
    html = segments.map(part).join(sig ? signatureHtml(sig) : "");
  } else {
    html = part(body) + (sig?.image ? signatureHtml({ ...sig, text: "" }) : "");
  }
  return `<div style="font-family:${SIGNATURE_FONTS.jhenghei.css};font-size:12pt">${html}</div>`;
}
