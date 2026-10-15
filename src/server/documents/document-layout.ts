import { dbDateToISOOrNull, parseISODate } from "@/lib/dates";

/** 發文單位聯絡資訊（公文抬頭下方） */
export interface LayoutOrganization {
  address?: string;
  contactName?: string;
  phone?: string;
  fax?: string;
  email?: string;
}

/** 中華民國115年10月07日（公文發文日期格式，月日補零） */
export function formatDispatchDate(iso: string): string {
  const { year, month, day } = parseISODate(iso);
  return `中華民國${year - 1911}年${String(month).padStart(2, "0")}月${String(day).padStart(2, "0")}日`;
}
import { DOCUMENT_STATUS_LABELS } from "./document-variables";

/**
 * 公文排版模型（DOCX、PDF、列印頁共用，純函式）。
 * 匯出檔僅為草稿／排版文件，一律標示非正式電子公文。
 */
export const DRAFT_NOTICE = "【草稿】本文件為系統產生之排版草稿，非機關電子公文系統之正式發文。";

export interface DocumentLayoutInput {
  companyName: string;
  organization?: LayoutOrganization;
  status: keyof typeof DOCUMENT_STATUS_LABELS;
  recipient: string | null;
  dispatchDate: Date | null;
  documentNumber: string | null;
  attachments: string | null;
  subject: string;
  bodyLines: string[];
  primaryRecipients: string | null;
  ccRecipients: string | null;
}

export interface DocumentLayout {
  title: string;
  /** 檔號、保存年限（右上角） */
  fileFields: { label: string; value: string }[];
  /** 地址、聯絡人、電話、傳真、電子郵件 */
  orgLines: { label: string; value: string }[];
  notice: string;
  statusLabel: string;
  headerFields: { label: string; value: string }[];
  subject: string;
  bodyLines: { marker: string; text: string }[];
  primaryRecipients: string;
  ccRecipients: string;
}

/** 將「一、內容」拆成項次與內文，以利懸掛縮排 */
export function splitMarker(line: string): { marker: string; text: string } {
  const m = /^([一二三四五六七八九十]+、|\(?[一二三四五六七八九十]+\)|\d+\.)(.*)$/.exec(line.trim());
  return m ? { marker: m[1], text: m[2].trim() } : { marker: "", text: line.trim() };
}

export function buildDocumentLayout(input: DocumentLayoutInput): DocumentLayout {
  const dispatch = dbDateToISOOrNull(input.dispatchDate);
  return {
    title: `${input.companyName}　函`,
    fileFields: [
      { label: "檔　　號", value: "" },
      { label: "保存年限", value: "" },
    ],
    orgLines: [
      { label: "地址", value: input.organization?.address ?? "" },
      { label: "聯絡人", value: input.organization?.contactName ?? "" },
      { label: "電話", value: input.organization?.phone ?? "" },
      { label: "傳真", value: input.organization?.fax ?? "" },
      { label: "電子郵件", value: input.organization?.email ?? "" },
    ].filter((l) => l.value),
    notice: DRAFT_NOTICE,
    statusLabel: DOCUMENT_STATUS_LABELS[input.status],
    headerFields: [
      { label: "受文者", value: input.recipient ?? "" },
      { label: "發文日期", value: dispatch ? formatDispatchDate(dispatch) : "" },
      // 正式發文字號由使用者輸入，未輸入前保持空白
      { label: "發文字號", value: input.documentNumber ?? "" },
      { label: "速別", value: "普通件" },
      { label: "密等及解密條件或保密期限", value: "" },
      { label: "附件", value: input.attachments ?? "" },
    ],
    subject: input.subject,
    bodyLines: input.bodyLines.map(splitMarker),
    primaryRecipients: input.primaryRecipients ?? "",
    ccRecipients: input.ccRecipients ?? "",
  };
}
