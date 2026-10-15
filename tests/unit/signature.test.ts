import { describe, expect, it } from "vitest";
import { buildEmailHtml, DEFAULT_SIGNATURE_STYLE, linkifyEscaped, normalizeSignatureStyle, signatureHtml, signatureText } from "@/lib/signature";
import { sanitizeSignatureHtml, signatureHtmlToText } from "@/server/signature/sanitize";

const img = "data:image/png;base64,iVBORw0KGgo=";

describe("格式化簽名檔（逐字設定樣式）", () => {
  it("保留每段文字各自的大小、顏色、字型、粗體與超連結", () => {
    const raw =
      '<p><span style="font-size: 14pt; color: #1f4e79; font-family: Arial"><strong>林映辰</strong></span> <span style="font-size:9pt;color:#808080">規劃師</span></p>' +
      '<p><a href="mailto:wanda@example.com">wanda@example.com</a> <a href="tel:+886223456789">02-2345-6789</a></p>' +
      `<p><img src="${img}" width="180" style="width: 180px; height: auto"></p>`;
    const html = sanitizeSignatureHtml(raw);
    expect(html).toContain("font-size:14pt");
    expect(html).toContain("color:#1f4e79");
    expect(html).toContain("font-size:9pt;color:#808080");
    expect(html).toContain("<strong>林映辰</strong>");
    expect(html).toContain('href="mailto:wanda@example.com"');
    expect(html).toContain('href="tel:+886223456789"');
    expect(html).toContain('width="180"');
    expect(html).toContain(img);
    expect(signatureHtmlToText(html)).toBe("林映辰 規劃師\nwanda@example.com 02-2345-6789");
  });

  it("移除危險內容：script、javascript: 連結、事件屬性、非圖片 data URL、不允許的 CSS", () => {
    const html = sanitizeSignatureHtml(
      '<p onclick="x()">A<script>alert(1)</script><a href="javascript:alert(1)">B</a>' +
        '<img src="data:text/html;base64,PHNjcmlwdD4="><img src="https://evil.example/x.png">' +
        '<span style="position:fixed;background-image:url(x);color:red;color:#ff0000">C</span></p>',
    );
    expect(html).not.toMatch(/script|onclick|javascript:|text\/html|evil\.example|position|url\(/);
    expect(html).toContain("color:#ff0000");
    expect(html).toContain("C");
  });

  it("內文 {signature} 換成格式化簽名檔，內文中的 Email 與網址變成超連結", () => {
    const sig = { html: '<p style="margin:0"><span style="color:#ff0000">林映辰</span></p>', text: "林映辰" };
    const html = buildEmailHtml("您好，\n請查收 https://example.com/a\n聯絡 wanda@example.com\n\n{signature}", sig);
    expect(html).toContain('<p style="margin:0">您好，</p>');
    expect(html).toContain('<p style="margin:0">&nbsp;</p>');
    expect(html).toContain('<a href="https://example.com/a" style="color:#0563c1;text-decoration:underline">https://example.com/a</a>');
    expect(html).toContain('href="mailto:wanda@example.com" style="color:#0563c1;text-decoration:underline">wanda@example.com</a>');
    expect(html).toContain('<span style="color:#ff0000">林映辰</span>');
    expect(html).not.toContain("{signature}");
    expect("您好\n{signature}".split("{signature}").join(signatureText(sig))).toBe("您好\n林映辰");
  });

  it("內文中的 HTML 會被跳脫；網址裡的 @ 不會被重複轉成 mailto", () => {
    const html = buildEmailHtml("<b>x</b> https://a.example/u@b.com", null);
    expect(html).toContain("&lt;b&gt;");
    expect(html).not.toContain("mailto:");
    expect(linkifyEscaped("TEL：a@b.tw")).toBe('TEL：<a href="mailto:a@b.tw" style="color:#0563c1;text-decoration:underline">a@b.tw</a>');
  });

  it("舊版簽名設定可轉換成 HTML，Email 自動變成超連結", () => {
    const html = signatureHtml({ text: "林映辰 規劃師\nwanda@example.com", image: img, style: { ...DEFAULT_SIGNATURE_STYLE, imageWidth: 180 } });
    expect(html).toContain('href="mailto:wanda@example.com"');
    expect(html).toContain('width="180"');
    const s = normalizeSignatureStyle({ color: "red;background:url(x)", fontFamily: "evil" });
    expect(s.color).toBe(DEFAULT_SIGNATURE_STYLE.color);
    expect(s.fontFamily).toBe(DEFAULT_SIGNATURE_STYLE.fontFamily);
  });
});
