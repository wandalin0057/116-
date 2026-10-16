import { describe, expect, it } from "vitest";
import { normalizeSiteUrl } from "@/server/settings/site-url";

describe("網站網址整理", () => {
  it("補上 https://、去除結尾斜線與路徑", () => {
    expect(normalizeSiteUrl("school-zone.onrender.com")).toBe("https://school-zone.onrender.com");
    expect(normalizeSiteUrl("https://school-zone.onrender.com/")).toBe("https://school-zone.onrender.com");
    expect(normalizeSiteUrl(" https://school-zone.onrender.com/login ")).toBe("https://school-zone.onrender.com");
    expect(normalizeSiteUrl("http://localhost:3000")).toBe("http://localhost:3000");
  });
  it("無效網址回傳 null", () => {
    expect(normalizeSiteUrl("")).toBeNull();
    expect(normalizeSiteUrl("不是網址")).toBeNull();
    expect(normalizeSiteUrl(undefined)).toBeNull();
  });
});
