import type { TemplateCategory, TemplateType } from "@prisma/client";

export interface TemplateDef {
  type: TemplateType;
  category: TemplateCategory;
  name: string;
  subject: string;
  body: string;
}

export const DOCUMENT_TEMPLATE_TYPES = ["PRE_REPORT", "REVIEW_DRAWING", "SITE_VISIT_DRAWING"] as const;
export const EMAIL_TEMPLATE_TYPES = ["REVIEW_SLIDES_EMAIL", "REVIEW_MINUTES_EMAIL", "SITE_VISIT_MINUTES_EMAIL"] as const;

export const TEMPLATE_TYPE_LABELS: Record<TemplateType, string> = {
  PRE_REPORT: "事前規劃及分析報告書",
  REVIEW_DRAWING: "審查會議後修正圖說",
  SITE_VISIT_DRAWING: "會勘後修正圖說",
  REVIEW_SLIDES_EMAIL: "審查會議前寄送簡報",
  REVIEW_MINUTES_EMAIL: "審查會議後寄送會議紀錄",
  SITE_VISIT_MINUTES_EMAIL: "會勘後寄送會勘紀錄",
};

/** 三種預設公文範本（主旨＝subject；說明＝body，每行一點） */
export const DEFAULT_DOCUMENT_TEMPLATES: TemplateDef[] = [
  {
    type: "PRE_REPORT",
    category: "DOCUMENT",
    name: "事前規劃及分析報告書",
    subject: "檢送「{projectName}」{schoolName}事前－規劃及分析報告書，附件詳如說明三，請查照。",
    body: [
      "一、依據本案徵求服務建議書第肆點規定辦理。",
      "二、依據貴局{notificationDateROC}電子郵件辦理。",
      "三、附件網址：{attachmentUrl}，下載密碼：{attachmentPassword}（請於{downloadDeadlineROC}前下載）。",
    ].join("\n"),
  },
  {
    type: "REVIEW_DRAWING",
    category: "DOCUMENT",
    name: "審查會議後修正圖說",
    subject: "檢送「{projectName}」{schoolName}審查會議後修正規劃圖說，附件詳如說明二，請查照。",
    body: [
      "一、依據本案徵求服務建議書第肆點規定辦理。",
      "二、附件網址：{attachmentUrl}，下載密碼：{attachmentPassword}（請於{downloadDeadlineROC}前下載）。",
    ].join("\n"),
  },
  {
    type: "SITE_VISIT_DRAWING",
    category: "DOCUMENT",
    name: "會勘後修正圖說",
    subject: "檢送「{projectName}」{schoolName}會勘後修正規劃圖說，附件詳如說明二，請查照。",
    body: [
      "一、依據本案徵求服務建議書第肆點規定辦理。",
      "二、附件網址：{attachmentUrl}，密碼：{attachmentPassword}（請於{downloadDeadlineROC}前下載）。",
    ].join("\n"),
  },
];

export const DEFAULT_EMAIL_TEMPLATES: TemplateDef[] = [
  {
    type: "REVIEW_SLIDES_EMAIL",
    category: "EMAIL",
    name: "審查會議前寄送簡報",
    subject: "【{projectName}】{schoolName}審查會議簡報",
    body: [
      "{agencyContact} 您好：",
      "",
      "有關「{projectName}」{schoolName}審查會議訂於{eventDateTime}{eventLocationText}召開，",
      "檢附審查會議簡報（附件：{attachmentNames}），敬請參閱。",
      "",
      "如有任何問題，歡迎隨時與我們聯繫，謝謝。",
      "",
      "{companyName}",
      "{senderName} 敬上",
    ].join("\n"),
  },
  {
    type: "REVIEW_MINUTES_EMAIL",
    category: "EMAIL",
    name: "審查會議後寄送會議紀錄",
    subject: "【{projectName}】{schoolName}審查會議紀錄",
    body: [
      "{agencyContact} 您好：",
      "",
      "有關「{projectName}」{schoolName}於{eventDateTime}召開之審查會議，",
      "檢附會議紀錄（附件：{attachmentNames}），敬請查閱；如有需修正之處，請不吝告知。",
      "",
      "謝謝。",
      "",
      "{companyName}",
      "{senderName} 敬上",
    ].join("\n"),
  },
  {
    type: "SITE_VISIT_MINUTES_EMAIL",
    category: "EMAIL",
    name: "會勘後寄送會勘紀錄",
    subject: "【{projectName}】{schoolName}現場會勘紀錄",
    body: [
      "{agencyContact} 您好：",
      "",
      "有關「{projectName}」{schoolName}於{eventDateTime}辦理之現場會勘，",
      "檢附會勘紀錄（附件：{attachmentNames}），敬請查閱；如有需修正之處，請不吝告知。",
      "",
      "謝謝。",
      "",
      "{companyName}",
      "{senderName} 敬上",
    ].join("\n"),
  },
];

export const ALL_DEFAULT_TEMPLATES = [...DEFAULT_DOCUMENT_TEMPLATES, ...DEFAULT_EMAIL_TEMPLATES];

/** 範本可用之變數說明 */
export const TEMPLATE_VARIABLES: Record<TemplateCategory, { key: string; label: string }[]> = {
  DOCUMENT: [
    { key: "projectName", label: "計畫名稱" },
    { key: "schoolName", label: "學校名稱" },
    { key: "district", label: "行政區" },
    { key: "agencyName", label: "機關名稱" },
    { key: "notificationDateROC", label: "機關通知日（民國）" },
    { key: "reviewMeetingDateROC", label: "審查會議日（民國）" },
    { key: "siteVisitDateROC", label: "會勘日（民國）" },
    { key: "attachmentUrl", label: "附件網址" },
    { key: "attachmentPassword", label: "下載密碼" },
    { key: "downloadDeadlineROC", label: "下載期限（民國）" },
    { key: "companyName", label: "公司名稱" },
  ],
  EMAIL: [
    { key: "projectName", label: "計畫名稱" },
    { key: "schoolName", label: "學校名稱" },
    { key: "agencyName", label: "機關名稱" },
    { key: "agencyContact", label: "機關承辦人" },
    { key: "eventDateTime", label: "會議或會勘日期時間" },
    { key: "eventDate", label: "會議或會勘日期" },
    { key: "eventLocation", label: "地點" },
    { key: "eventLocationText", label: "「於○○」地點文字" },
    { key: "attachmentNames", label: "附件名稱" },
    { key: "companyName", label: "公司名稱" },
    { key: "senderName", label: "寄件人姓名" },
  ],
};
