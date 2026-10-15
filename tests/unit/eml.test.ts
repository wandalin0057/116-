import { describe, expect, it } from "vitest";
import { buildEml, emlFileName } from "@/lib/eml";

const decode = (eml: string, header: string) => {
  const part = eml.split(header)[1]!.split("\r\n\r\n")[1]!.split("\r\n--")[0]!;
  return Buffer.from(part.replace(/\r\n/g, ""), "base64").toString("utf8");
};

describe("Outlook 郵件檔（.eml）", () => {
  it("新郵件格式：收件人、副本、中文主旨，內文與圖片轉為內嵌附件", () => {
    const png = "iVBORw0KGgo=";
    const eml = buildEml({
      to: "a@example.com；b@example.com",
      cc: "c@example.com",
      subject: "【116年度】會勘紀錄",
      html: `<p style="color:#c00000">林映辰</p><img src="data:image/png;base64,${png}" width="180" height="40">`,
    });
    expect(eml).toContain("X-Unsent: 1\r\n");
    expect(eml).toContain("To: a@example.com, b@example.com\r\n");
    expect(eml).toContain("Cc: c@example.com\r\n");
    expect(eml).toContain(`Subject: =?UTF-8?B?${Buffer.from("【116年度】會勘紀錄").toString("base64")}?=`);
    const html = decode(eml, 'Content-Type: text/html; charset="utf-8"');
    expect(html).toContain('<p style="color:#c00000">林映辰</p>');
    expect(html).toContain('src="cid:image1@szm"');
    expect(html).not.toContain("data:image");
    expect(eml).toContain("Content-ID: <image1@szm>");
    expect(eml).toContain(`\r\n\r\n${png}\r\n`);
    expect(eml.trimEnd().endsWith("--")).toBe(true);
  });

  it("檔名移除不合法字元", () => {
    expect(emlFileName('a/b:c*?"<>|')).toBe("abc.eml");
  });
});
