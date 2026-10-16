import { describe, expect, it } from "vitest";
import { translateAuthError } from "@/lib/auth-errors";
import { validateEmail, validatePassword, validatePasswordConfirm } from "@/lib/validation";

describe("登入錯誤訊息中文化", () => {
  it("依錯誤代碼翻譯", () => {
    expect(translateAuthError({ code: "invalid_credentials", message: "Invalid login credentials" })).toBe("Email 或密碼錯誤");
    expect(translateAuthError({ code: "email_not_confirmed" })).toMatch(/尚未完成驗證/);
  });
  it("無代碼時依訊息翻譯", () => {
    expect(translateAuthError({ message: "User already registered" })).toMatch(/已經註冊/);
    expect(translateAuthError(new TypeError("Failed to fetch"))).toMatch(/無法連線/);
  });
  it("未知錯誤不洩漏原始訊息", () => {
    expect(translateAuthError({ message: "internal stack trace xyz" })).toBe("發生錯誤，請稍後再試");
  });
});

describe("表單驗證", () => {
  it("Email", () => {
    expect(validateEmail("")).toBe("請輸入 Email");
    expect(validateEmail("abc")).toBe("Email 格式不正確");
    expect(validateEmail(" user@example.com ")).toBeNull();
  });
  it("密碼", () => {
    expect(validatePassword("abc1")).toMatch(/至少需要 8 碼/);
    expect(validatePassword("abcdefgh")).toMatch(/英文字母與數字/);
    expect(validatePassword("abcd1234")).toBeNull();
    expect(validatePasswordConfirm("abcd1234", "abcd1235")).toMatch(/不一致/);
  });
});
