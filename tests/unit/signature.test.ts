import { describe, expect, it } from "vitest";
import { buildEmailHtml, DEFAULT_SIGNATURE_STYLE, normalizeSignatureStyle, signatureHtml, signatureText } from "@/lib/signature";

const img = "data:image/png;base64,iVBORw0KGgo=";
const sig = { text: "林映辰 規劃師\nwanda@example.com", image: img, style: { ...DEFAULT_SIGNATURE_STYLE, imageWidth: 180, color: "#ff0000", firstLineColor: "#0000ff", firstLineSizePt: 14 } };

describe("簽名檔樣式與 HTML", () => {
  it("第一行套用獨立大小顏色粗體，其餘行套用文字顏色，圖片寬度可調", () => {
    const html = signatureHtml(sig);
    expect(html).toContain("font-size:14pt;color:#0000ff;font-weight:bold;");
    expect(html).toContain("color:#ff0000");
    expect(html).toContain('width="180"');
    expect(html.indexOf("<img")).toBeGreaterThan(html.indexOf("林映辰"));
  });

  it("圖片可放在文字上方", () => {
    const html = signatureHtml({ ...sig, style: { ...sig.style, imagePosition: "above" } });
    expect(html.indexOf("<img")).toBeLessThan(html.indexOf("林映辰"));
  });

  it("內文 {signature} 換成樣式化簽名檔；純文字版本換成簽名文字", () => {
    const html = buildEmailHtml("您好，\n請查收。\n\n{signature}", sig);
    expect(html).toContain("您好，<br>請查收。");
    expect(html).toContain("林映辰 規劃師");
    expect(html).not.toContain("{signature}");
    expect("您好\n{signature}".split("{signature}").join(signatureText(sig))).toBe("您好\n林映辰 規劃師\nwanda@example.com");
  });

  it("不合法的樣式值一律改用預設（防止注入 CSS）", () => {
    const s = normalizeSignatureStyle({ color: "red;background:url(x)", fontFamily: "evil", imageWidth: 99999, fontSizePt: 12 });
    expect(s.color).toBe(DEFAULT_SIGNATURE_STYLE.color);
    expect(s.fontFamily).toBe(DEFAULT_SIGNATURE_STYLE.fontFamily);
    expect(s.imageWidth).toBe(DEFAULT_SIGNATURE_STYLE.imageWidth);
    expect(s.fontSizePt).toBe(12);
  });

  it("文字中的 HTML 會被跳脫，非圖片 data URL 不會輸出", () => {
    const html = signatureHtml({ text: "<script>alert(1)</script>", image: "data:text/html;base64,AAAA", style: DEFAULT_SIGNATURE_STYLE });
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<img");
  });

  it("舊草稿（內文無 {signature}）仍會接上簽名圖片", () => {
    expect(buildEmailHtml("您好", sig)).toContain("<img");
  });
});
