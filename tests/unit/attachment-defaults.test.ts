import { describe, expect, it } from "vitest";
import { downloadDeadlineFor, passwordForDate } from "@/server/documents/attachment-defaults";

describe("公文附件預設值", () => {
  it("下載密碼＝CD80@＋提供日期月日（萬大國小 10/19 → CD80@1019）", () => {
    expect(passwordForDate("2026-10-19")).toBe("CD80@1019");
    expect(passwordForDate("2027-03-04")).toBe("CD80@0304");
  });
  it("下載期限＝創稿日期＋14 天（跨月）", () => {
    expect(downloadDeadlineFor("2026-10-16")).toBe("2026-10-30");
    expect(downloadDeadlineFor("2026-12-25")).toBe("2027-01-08");
  });
});
