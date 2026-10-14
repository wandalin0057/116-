import { describe, expect, it } from "vitest";
import { isoToDbDate, parseTaipeiDateTime } from "@/lib/dates";
import { buildDocumentLayout } from "@/server/documents/document-layout";
import { buildDocumentVariables, buildEmailVariables, splitBodyLines } from "@/server/documents/document-variables";
import { DEFAULT_DOCUMENT_TEMPLATES, DEFAULT_EMAIL_TEMPLATES } from "@/server/templates/default-templates";
import { renderTemplate } from "@/server/templates/template-renderer";

const schoolCase = {
  projectName: "115年度臺北市通學區規劃分析案",
  schoolName: "臺北市大安區仁愛國民小學",
  agencyName: "臺北市政府交通局",
  agencyContact: "張承辦",
  notificationDate: isoToDbDate("2026-10-14"),
  reviewMeetingDateTime: parseTaipeiDateTime("2026-10-22T14:00"),
  siteVisitDateTime: null,
};
const vars = buildDocumentVariables({
  schoolCase,
  attachmentUrl: "https://files.example.com/abc",
  attachmentPassword: "pw1234",
  downloadDeadline: "2026-11-30",
  companyName: "測試顧問公司",
});
const tpl = (type: string) => DEFAULT_DOCUMENT_TEMPLATES.find((t) => t.type === type)!;

describe("14. 三種公文範本正確帶入資料", () => {
  it("事前規劃及分析報告書", () => {
    const subject = renderTemplate(tpl("PRE_REPORT").subject, vars);
    const body = renderTemplate(tpl("PRE_REPORT").body, vars);
    expect(subject.text).toBe("檢送「115年度臺北市通學區規劃分析案」臺北市大安區仁愛國民小學事前－規劃及分析報告書，附件詳如說明三，請查照。");
    expect(splitBodyLines(body.text)).toEqual([
      "一、依據本案徵求服務建議書第肆點規定辦理。",
      "二、依據貴局115年10月14日電子郵件辦理。",
      "三、附件網址：https://files.example.com/abc，下載密碼：pw1234（請於115年11月30日前下載）。",
    ]);
    expect(subject.missing).toEqual([]);
    expect(body.missing).toEqual([]);
  });

  it("審查會議後修正圖說", () => {
    expect(renderTemplate(tpl("REVIEW_DRAWING").subject, vars).text).toBe(
      "檢送「115年度臺北市通學區規劃分析案」臺北市大安區仁愛國民小學審查會議後修正規劃圖說，附件詳如說明二，請查照。",
    );
    expect(renderTemplate(tpl("REVIEW_DRAWING").body, vars).text).toContain("二、附件網址：https://files.example.com/abc，下載密碼：pw1234（請於115年11月30日前下載）。");
  });

  it("會勘後修正圖說", () => {
    expect(renderTemplate(tpl("SITE_VISIT_DRAWING").subject, vars).text).toBe(
      "檢送「115年度臺北市通學區規劃分析案」臺北市大安區仁愛國民小學會勘後修正規劃圖說，附件詳如說明二，請查照。",
    );
    expect(renderTemplate(tpl("SITE_VISIT_DRAWING").body, vars).text).toContain("密碼：pw1234（請於115年11月30日前下載）");
  });

  it("缺少之欄位保留變數並回報", () => {
    const r = renderTemplate(tpl("PRE_REPORT").body, { ...vars, attachmentUrl: "" });
    expect(r.missing).toEqual(["attachmentUrl"]);
    expect(r.text).toContain("{attachmentUrl}");
  });

  it("指定保留之變數不代入（下載密碼不以明文儲存）", () => {
    const r = renderTemplate(tpl("PRE_REPORT").body, vars, { keep: ["attachmentPassword"] });
    expect(r.text).toContain("{attachmentPassword}");
    expect(r.text).not.toContain("pw1234");
  });

  it("排版文件標示為草稿，發文字號未輸入時保持空白", () => {
    const layout = buildDocumentLayout({
      companyName: "測試顧問公司",
      status: "DRAFT",
      recipient: "臺北市政府交通局",
      dispatchDate: null,
      documentNumber: null,
      attachments: "如說明",
      subject: "主旨",
      bodyLines: ["一、說明一", "二、說明二"],
      primaryRecipients: "臺北市政府交通局",
      ccRecipients: null,
    });
    expect(layout.notice).toContain("非機關電子公文系統");
    expect(layout.headerFields.find((f) => f.label === "發文字號")?.value).toBe("");
    expect(layout.bodyLines[0]).toEqual({ marker: "一、", text: "說明一" });
  });
});

describe("Email 範本", () => {
  it("帶入計畫、學校、會議日期、承辦人、附件名稱", () => {
    const ev = buildEmailVariables({
      schoolCase,
      eventDateTime: schoolCase.reviewMeetingDateTime,
      eventLocation: "交通局會議室",
      attachmentNames: "簡報.pdf",
      companyName: "測試顧問公司",
      senderName: "陳工程師",
    });
    const t = DEFAULT_EMAIL_TEMPLATES.find((x) => x.type === "REVIEW_SLIDES_EMAIL")!;
    const body = renderTemplate(t.body, ev);
    expect(renderTemplate(t.subject, ev).text).toBe("【115年度臺北市通學區規劃分析案】臺北市大安區仁愛國民小學審查會議簡報");
    expect(body.text).toContain("張承辦 您好");
    expect(body.text).toContain("115年10月22日（星期四）下午2時於交通局會議室召開");
    expect(body.text).toContain("簡報.pdf");
    expect(body.missing).toEqual([]);
  });
});
