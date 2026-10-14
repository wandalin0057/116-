import bcrypt from "bcryptjs";

const COST = 12;
// 用於帳號不存在時仍執行一次雜湊比對，避免以回應時間推測帳號是否存在
let dummyHash: string | null = null;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export async function verifyPassword(plain: string, hash: string | null | undefined): Promise<boolean> {
  if (!hash) {
    dummyHash ??= await bcrypt.hash("dummy-password-for-timing", COST);
    await bcrypt.compare(plain, dummyHash);
    return false;
  }
  return bcrypt.compare(plain, hash);
}

/** 密碼強度：至少 10 碼，需包含英文字母與數字 */
export function validatePasswordStrength(plain: string): string | null {
  if (plain.length < 10) return "密碼至少需 10 個字元";
  if (plain.length > 128) return "密碼不可超過 128 個字元";
  if (!/[A-Za-z]/.test(plain) || !/\d/.test(plain)) return "密碼需同時包含英文字母與數字";
  return null;
}
