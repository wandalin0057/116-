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
    expect(subject.text).toBe("檢送「115年度臺北市通學區規劃分析案」臺北市大安區仁愛國民小學事前－規劃及分析報告書，附件詳如說明二，請查照。");
    expect(splitBodyLines(body.text)).toEqual([
      "一、依據本案徵求服務建議書第肆點規定及貴局115年10月14日電子郵件辦理。",
      "二、附件網址：https://files.example.com/abc，下載密碼：pw1234(請於115年11月30日前下載)。",
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

describe("Email 範本（使用者提供之格式）", () => {
  const sig = "林映辰 規劃師\nwanda@example.com\nTEL +886-2-2748-8822 ext.6685";
  it("審查會議前寄送簡報：第N次通知、下載連結、簽名檔", () => {
    const ev = buildEmailVariables({ schoolCase: { ...schoolCase, schoolName: "辛亥國小" }, eventDateTime: schoolCase.reviewMeetingDateTime, signature: sig, notificationRound: 11 });
    const t = DEFAULT_EMAIL_TEMPLATES.find((x) => x.type === "REVIEW_SLIDES_EMAIL")!;
    const body = renderTemplate(t.body, { ...ev, attachmentUrl: "https://drive.google.com/drive/folders/abc" });
    expect(body.text).toBe(
      [
        "您好，",
        "有關「115年度臺北市通學區規劃分析案」第11次通知之辛亥國小，審查簡報因檔案較大，煩請至以下連結下載，",
        "",
        "https://drive.google.com/drive/folders/abc",
        "",
        "請您查收，謝謝。",
        "",
        sig,
      ].join("\n"),
    );
  });

  it("會議紀錄：昨日10/5辦理之○○審查會議", () => {
    const meeting = parseTaipeiDateTime("2026-10-05T14:00");
    const ev = buildEmailVariables({ schoolCase: { ...schoolCase, schoolName: "劍潭國小" }, eventDateTime: meeting, signature: sig, now: new Date("2026-10-06T01:00:00Z") });
    const t = DEFAULT_EMAIL_TEMPLATES.find((x) => x.type === "REVIEW_MINUTES_EMAIL")!;
    const body = renderTemplate(t.body, ev);
    expect(body.text.split("\n").slice(0, 4)).toEqual(["您好，", "有關昨日10/5辦理之劍潭國小審查會議，會議記錄如附件所示，", "", "請查收，謝謝。"]);
    expect(body.text.endsWith(sig)).toBe(true);
    expect(body.missing).toEqual([]);
  });

  it("會勘紀錄；超過兩天不加相對日期；未設定簽名檔以姓名代替", () => {
    const visit = parseTaipeiDateTime("2026-10-05T09:30");
    const ev = buildEmailVariables({ schoolCase, eventDateTime: visit, senderName: "陳工程師", now: new Date("2026-10-09T01:00:00Z") });
    const t = DEFAULT_EMAIL_TEMPLATES.find((x) => x.type === "SITE_VISIT_MINUTES_EMAIL")!;
    const body = renderTemplate(t.body, ev).text;
    expect(body).toContain("有關10/5辦理之臺北市大安區仁愛國民小學現場會勘，會勘紀錄如附件所示，");
    expect(body.endsWith("陳工程師")).toBe(true);
  });
});

describe("公文抬頭", () => {
  it("顯示發文單位資訊、檔號／保存年限，發文日期月日補零", () => {
    const layout = buildDocumentLayout({
      companyName: "鼎漢國際工程顧問股份有限公司",
      organization: { address: "110048 臺北市信義區松山路130號5樓", contactName: "林映辰", phone: "02-2748-8822#6685", fax: "", email: "x@example.com" },
      status: "DISPATCHED",
      recipient: "如行文單位",
      dispatchDate: isoToDbDate("2026-10-07"),
      documentNumber: "鼎業交字第1150001761號",
      attachments: "",
      subject: "主旨",
      bodyLines: ["一、說明"],
      primaryRecipients: "臺北市政府交通局",
      ccRecipients: null,
    });
    expect(layout.title).toBe("鼎漢國際工程顧問股份有限公司　函");
    expect(layout.orgLines.map((l) => l.label)).toEqual(["地址", "聯絡人", "電話", "電子郵件"]);
    expect(layout.fileFields.map((f) => f.label)).toEqual(["檔　　號", "保存年限"]);
    expect(layout.headerFields.find((f) => f.label === "發文日期")?.value).toBe("中華民國115年10月07日");
  });
});
