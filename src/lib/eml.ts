/**
 * 產生 Outlook 郵件檔（.eml）。
 * 加上 X-Unsent: 1，Outlook 開啟後會是「可直接編輯、按傳送」的新郵件，
 * 內文格式與簽名圖片完整保留（不經過剪貼簿，不受 Outlook 貼上設定影響）。
 * 圖片由 data: URL 轉為內嵌附件（cid），Outlook 才會顯示。
 */

const CRLF = "\r\n";

function utf8Base64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

const wrap76 = (b64: string) => b64.replace(/.{1,76}/g, (l) => l + CRLF).trimEnd();

/** 標頭中的中文（RFC 2047） */
function encodeHeader(s: string): string {
  // eslint-disable-next-line no-control-regex
  return /^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${utf8Base64(s)}?=`;
}

const splitAddresses = (s: string) =>
  s
    .split(/[,;，；\s]+/)
    .filter(Boolean)
    .join(", ");

const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp" };

export function buildEml(input: { to: string; cc?: string; subject: string; html: string }): string {
  const boundary = `----=_szm_${Math.random().toString(36).slice(2)}`;
  const images: { cid: string; mime: string; data: string; name: string }[] = [];
  const html = input.html.replace(/src=(["'])data:(image\/(?:png|jpeg|gif|webp));base64,([A-Za-z0-9+/=\s]+)\1/g, (_m, q: string, mime: string, data: string) => {
    const n = images.length + 1;
    const cid = `image${n}@szm`;
    images.push({ cid, mime, data: data.replace(/\s/g, ""), name: `image${n}.${EXT[mime] ?? "png"}` });
    return `src=${q}cid:${cid}${q}`;
  });
  const body = html.replace(/<!--(Start|End)Fragment-->/g, "");
  const doc = /<html[\s>]/i.test(body) ? body : `<html><head><meta charset="utf-8"></head><body>${body}</body></html>`;

  const headers = [
    "X-Unsent: 1",
    `To: ${splitAddresses(input.to)}`,
    ...(input.cc?.trim() ? [`Cc: ${splitAddresses(input.cc)}`] : []),
    `Subject: ${encodeHeader(input.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/related; type="text/html"; boundary="${boundary}"`,
  ];
  const parts = [
    [`--${boundary}`, 'Content-Type: text/html; charset="utf-8"', "Content-Transfer-Encoding: base64", "", wrap76(utf8Base64(doc))].join(CRLF),
    ...images.map((img) =>
      [
        `--${boundary}`,
        `Content-Type: ${img.mime}; name="${img.name}"`,
        "Content-Transfer-Encoding: base64",
        `Content-ID: <${img.cid}>`,
        `Content-Disposition: inline; filename="${img.name}"`,
        "",
        wrap76(img.data),
      ].join(CRLF),
    ),
  ];
  return [...headers, "", ...parts, `--${boundary}--`, ""].join(CRLF);
}

/** 檔名不可含的字元 */
export function emlFileName(subject: string): string {
  return `${(subject || "郵件").replace(/[\\/:*?"<>|]/g, "").slice(0, 80)}.eml`;
}
