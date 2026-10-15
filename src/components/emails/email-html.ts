/** Email 草稿轉為可貼到 Outlook 的 HTML（純函式） */
const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** 組成可貼到 Outlook 的 HTML：保留換行、網址轉為連結、簽名圖片接在最後 */
export function buildEmailHtml(text: string, signatureImage: string | null) {
  const body = escapeHtml(text)
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>')
    .replace(/\n/g, "<br>");
  const img = signatureImage ? `<br><img src="${signatureImage}" alt="簽名圖片" style="max-width:480px;height:auto">` : "";
  return `<div style="font-family:'Microsoft JhengHei','PingFang TC',sans-serif;font-size:12pt">${body}${img}</div>`;
}
