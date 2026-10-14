import { existsSync } from "node:fs";
import PDFDocument from "pdfkit";
import { AppError } from "@/server/errors";
import type { DocumentLayout } from "./document-layout";

/** 中文字型候選路徑（Docker 映像檔會安裝 Noto Sans CJK） */
const FONT_CANDIDATES: { path: string; family?: string }[] = [
  { path: "/usr/share/fonts/noto/NotoSansCJK-Regular.ttc", family: "NotoSansCJKtc-Regular" },
  { path: "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc", family: "NotoSansCJKtc-Regular" },
  { path: "/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc", family: "NotoSansCJKtc-Regular" },
  { path: "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc", family: "WenQuanYiZenHei" },
];

export function resolvePdfFont(): { path: string; family?: string } | null {
  const custom = process.env.PDF_FONT_PATH;
  if (custom) return existsSync(custom) ? { path: custom, family: process.env.PDF_FONT_FAMILY || undefined } : null;
  return FONT_CANDIDATES.find((c) => existsSync(c.path)) ?? null;
}

export async function renderPdf(layout: DocumentLayout): Promise<Buffer> {
  const font = resolvePdfFont();
  if (!font) {
    throw new AppError("伺服器未安裝中文字型，無法產生 PDF。請設定 PDF_FONT_PATH，或使用「列印／另存 PDF」功能。", 501, "PDF_FONT_MISSING");
  }
  const doc = new PDFDocument({ size: "A4", bufferPages: true, margins: { top: 56, bottom: 64, left: 64, right: 64 }, info: { Title: layout.subject.slice(0, 80), Subject: layout.notice } });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  if (font.family) doc.registerFont("cjk", font.path, font.family);
  else doc.registerFont("cjk", font.path);
  doc.font("cjk");

  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  doc.fontSize(9).fillColor("#B91C1C").text(`草稿（${layout.statusLabel}）`, { align: "right" });
  doc.moveDown(0.5);
  doc.fillColor("#000").fontSize(20).text(layout.title, { align: "center" });
  doc.moveDown(1);
  doc.fontSize(12);
  for (const f of layout.headerFields) doc.text(`${f.label}：${f.value}`, { lineGap: 3 });
  doc.moveDown(1);

  doc.fontSize(16);
  const labelW = doc.widthOfString("主旨：");
  const y0 = doc.y;
  doc.text("主旨：", doc.page.margins.left, y0, { continued: false });
  doc.text(layout.subject, doc.page.margins.left + labelW, y0, { width: width - labelW, lineGap: 6 });
  doc.moveDown(0.6);
  doc.text("說明：", doc.page.margins.left, doc.y);
  const markerX = doc.page.margins.left + labelW;
  for (const line of layout.bodyLines) {
    const y = doc.y;
    const mw = line.marker ? doc.widthOfString(line.marker) : 0;
    if (line.marker) doc.text(line.marker, markerX, y);
    doc.text(line.text, markerX + mw, y, { width: width - labelW - mw, lineGap: 6 });
    doc.moveDown(0.2);
  }
  doc.moveDown(1.5);
  doc.fontSize(12);
  doc.text(`正本：${layout.primaryRecipients}`, doc.page.margins.left, doc.y, { width });
  doc.text(`副本：${layout.ccRecipients}`, { width });

  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const bottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.fontSize(8).fillColor("#666").text(layout.notice, doc.page.margins.left, doc.page.height - 40, { width, align: "center", lineBreak: false });
    doc.page.margins.bottom = bottom;
  }
  doc.end();
  return done;
}
