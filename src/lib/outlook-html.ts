/**
 * 將 Email HTML 轉成 Outlook 貼上時不會跑版的格式（僅限瀏覽器使用）。
 *
 * Outlook（Word 排版引擎）不支援 CSS 繼承、rgb() 顏色與只寫在 CSS 的圖片尺寸，
 * 中文字也要另外指定 mso-fareast-font-family。因此先在畫面外實際排版，
 * 再把每個元素「實際呈現的」字型、大小、顏色寫成行內樣式，圖片補上 width/height 屬性。
 */

const BLOCKS = new Set(["P", "DIV"]);
const SKIP = new Set(["BR", "IMG"]);

function toHex(color: string): string | null {
  const m = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/);
  if (!m) return null;
  if (m[4] !== undefined && Number(m[4]) === 0) return null; // 透明
  return "#" + [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, "0")).join("");
}

/** 字型清單的第一個字型名稱（去掉引號） */
function firstFont(list: string): string {
  return (list.split(",")[0] ?? "").trim().replace(/^["']|["']$/g, "");
}

function pt(px: string): string {
  return `${Math.round(parseFloat(px) * 0.75 * 2) / 2}pt`;
}

export async function toOutlookHtml(html: string): Promise<string> {
  const host = document.createElement("div");
  // 畫面外排版；all:initial 避免網站本身的 CSS 影響計算結果
  host.style.cssText = "all:initial;position:fixed;left:-10000px;top:0;width:800px;display:block;color:#000;font-family:'Microsoft JhengHei',sans-serif;font-size:12pt";
  host.innerHTML = html;
  document.body.appendChild(host);
  try {
    const imgs = Array.from(host.querySelectorAll("img"));
    await Promise.all(imgs.map((i) => i.decode().catch(() => undefined)));

    for (const el of Array.from(host.querySelectorAll<HTMLElement>("*"))) {
      if (el.tagName === "IMG") {
        const img = el as HTMLImageElement;
        const attrW = Number(img.getAttribute("width")) || 0;
        const w = Math.round(attrW || img.getBoundingClientRect().width || img.naturalWidth);
        const h = img.naturalWidth ? Math.round((w * img.naturalHeight) / img.naturalWidth) : Math.round(img.getBoundingClientRect().height);
        img.setAttribute("width", String(w));
        if (h) img.setAttribute("height", String(h));
        img.setAttribute("style", `width:${w}px;${h ? `height:${h}px;` : ""}border:0`);
        img.setAttribute("border", "0");
        continue;
      }
      if (SKIP.has(el.tagName)) continue;

      const cs = getComputedStyle(el);
      const font = cs.fontFamily.replace(/"/g, "'");
      const styles = [`font-family:${font}`, `mso-fareast-font-family:'${firstFont(font)}'`, `font-size:${pt(cs.fontSize)}`];
      const color = toHex(cs.color);
      if (color) styles.push(`color:${color}`);
      const bg = toHex(cs.backgroundColor);
      if (bg) styles.push(`background:${bg}`);
      if (Number(cs.fontWeight) >= 600) styles.push("font-weight:bold");
      if (cs.fontStyle === "italic") styles.push("font-style:italic");
      if (cs.textDecorationLine.includes("underline")) styles.push("text-decoration:underline");
      else if (cs.textDecorationLine.includes("line-through")) styles.push("text-decoration:line-through");
      if (BLOCKS.has(el.tagName)) {
        if (cs.textAlign === "center" || cs.textAlign === "right") styles.push(`text-align:${cs.textAlign}`);
        // 段落間不留空白；放在最後並帶單位，部分 Office 版本才會正確套用
        styles.push("margin:0cm");
      }
      el.setAttribute("style", styles.join(";"));
      if (el.tagName === "P") {
        el.className = "MsoNormal";
        // Outlook 會吃掉空白段落，補上空白字元保留空行
        if (!el.textContent?.trim() && !el.querySelector("img")) el.innerHTML = "&nbsp;";
      } else {
        el.removeAttribute("class");
      }
    }
    return `<html><head><meta charset="utf-8"></head><body><!--StartFragment-->${host.innerHTML}<!--EndFragment--></body></html>`;
  } finally {
    host.remove();
  }
}
