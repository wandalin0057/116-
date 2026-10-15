import { describe, expect, it } from "vitest";
import { buildEmailHtml } from "@/components/emails/email-html";

describe("Email 內文 HTML（含簽名圖片）", () => {
  it("保留換行、網址轉連結、跳脫特殊字元、簽名圖片接在最後", () => {
    const img = "data:image/png;base64,iVBORw0KGgo=";
    const html = buildEmailHtml("您好，\n連結：https://drive.google.com/x?usp=sharing\n<測試>&", img);
    expect(html).toContain("您好，<br>連結：");
    expect(html).toContain('<a href="https://drive.google.com/x?usp=sharing">https://drive.google.com/x?usp=sharing</a>');
    expect(html).toContain("&lt;測試&gt;&amp;");
    expect(html.indexOf("<img")).toBeGreaterThan(html.indexOf("&amp;"));
    expect(html).toContain(`src="${img}"`);
  });
  it("沒有簽名圖片時不含 img", () => {
    expect(buildEmailHtml("文字", null)).not.toContain("<img");
  });
});
