import sanitizeHtml from "sanitize-html";
import { LINK_STYLE } from "@/lib/signature";

/**
 * 簽名檔 HTML 白名單過濾（伺服器端）。
 * 只保留文字格式（字型、大小、顏色、粗斜體底線）、連結（http/https/mailto/tel）與 data:image 圖片。
 */
const IMAGE_DATA_URL = /^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/;
const COLOR = [/^#[0-9a-fA-F]{3,8}$/, /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\)$/];
const SIZE = [/^\d{1,2}(\.\d{1,2})?(pt|px)$/];
const FONT = [/^[A-Za-z0-9\s,'"\-㐀-鿿]{1,120}$/];

export const SIGNATURE_HTML_MAX_CHARS = 600_000;

export function sanitizeSignatureHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ["p", "br", "div", "span", "strong", "b", "em", "i", "u", "s", "a", "img"],
    allowedAttributes: {
      a: ["href", "target", "rel"],
      img: ["src", "alt", "width", "height", "style"],
      "*": ["style"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: { img: ["data"] },
    allowProtocolRelative: false,
    allowedStyles: {
      "*": {
        color: COLOR,
        "background-color": COLOR,
        "font-size": SIZE,
        "font-family": FONT,
        "font-weight": [/^(bold|normal|[1-9]00)$/],
        "font-style": [/^(italic|normal)$/],
        "text-decoration": [/^(underline|line-through|none)$/],
        "text-align": [/^(left|center|right)$/],
        "line-height": [/^\d(\.\d{1,2})?$/],
        margin: [/^0$/],
        width: [/^\d{1,4}px$/],
        height: [/^(\d{1,4}px|auto)$/],
      },
    },
    transformTags: {
      // 段落之間不留空白（與 Outlook 簽名檔一致）
      p: (tagName, attribs) => ({ tagName, attribs: { ...attribs, style: `${attribs.style ? `${attribs.style};` : ""}margin:0` } }),
      // 連結一律藍色底線（使用者另設的顏色寫在內層 span，仍會優先顯示）
      a: (tagName, attribs) => ({ tagName, attribs: { ...attribs, style: attribs.style || LINK_STYLE, target: "_blank", rel: "noopener noreferrer" } }),
    },
    exclusiveFilter: (frame) => frame.tag === "img" && !IMAGE_DATA_URL.test(frame.attribs.src ?? ""),
  });
}

/** 由 HTML 取得純文字（供純文字複製、以郵件程式開啟） */
export function signatureHtmlToText(html: string): string {
  return sanitizeHtml(html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div)>/gi, "\n"), { allowedTags: [], allowedAttributes: {} })
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
