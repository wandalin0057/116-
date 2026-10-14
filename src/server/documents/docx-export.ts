import { AlignmentType, Document, Footer, Header, Packer, Paragraph, TextRun } from "docx";
import type { DocumentLayout } from "./document-layout";

const FONT = "標楷體";
const pt = (n: number) => n * 2; // docx 以半點為單位

function fieldParagraph(label: string, value: string) {
  return new Paragraph({
    spacing: { after: 60 },
    children: [new TextRun({ text: `${label}：`, font: FONT, size: pt(12) }), new TextRun({ text: value, font: FONT, size: pt(12) })],
  });
}

export async function renderDocx(layout: DocumentLayout): Promise<Buffer> {
  const indent = 640; // twips：主旨／說明 懸掛縮排
  const children: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [new TextRun({ text: layout.title, font: FONT, size: pt(20), bold: true })],
    }),
    ...layout.headerFields.map((f) => fieldParagraph(f.label, f.value)),
    new Paragraph({
      spacing: { before: 240, after: 120, line: 400 },
      indent: { left: indent * 1.5, hanging: indent * 1.5 },
      children: [new TextRun({ text: "主旨：", font: FONT, size: pt(16) }), new TextRun({ text: layout.subject, font: FONT, size: pt(16) })],
    }),
    new Paragraph({ spacing: { before: 120, after: 60 }, children: [new TextRun({ text: "說明：", font: FONT, size: pt(16) })] }),
    ...layout.bodyLines.map(
      (l) =>
        new Paragraph({
          spacing: { after: 60, line: 400 },
          indent: { left: indent * 2, hanging: l.marker ? indent : 0 },
          children: [new TextRun({ text: `${l.marker}${l.text}`, font: FONT, size: pt(16) })],
        }),
    ),
    new Paragraph({ spacing: { before: 360 }, children: [] }),
    fieldParagraph("正本", layout.primaryRecipients),
    fieldParagraph("副本", layout.ccRecipients),
  ];
  const doc = new Document({
    creator: "通學區案件期程暨發文管理系統",
    title: layout.subject.slice(0, 80),
    description: layout.notice,
    sections: [
      {
        properties: { page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
        headers: {
          default: new Header({
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `草稿（${layout.statusLabel}）`, font: FONT, size: pt(10), color: "B91C1C" })] })],
          }),
        },
        footers: {
          default: new Footer({
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: layout.notice, font: FONT, size: pt(9), color: "666666" })] })],
          }),
        },
        children,
      },
    ],
  });
  return Packer.toBuffer(doc);
}
