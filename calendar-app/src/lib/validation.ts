/** 表單驗證（前端提示用；真正的驗證由 Supabase Auth 與資料庫執行） */
export const PASSWORD_MIN_LENGTH = 8;

export function validateEmail(email: string): string | null {
  const v = email.trim();
  if (!v) return "請輸入 Email";
  if (v.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "Email 格式不正確";
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return "請輸入密碼";
  if (password.length < PASSWORD_MIN_LENGTH) return `密碼至少需要 ${PASSWORD_MIN_LENGTH} 碼`;
  if (password.length > 72) return "密碼最多 72 碼";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "密碼需同時包含英文字母與數字";
  return null;
}

export function validatePasswordConfirm(password: string, confirm: string): string | null {
  return password === confirm ? null : "兩次輸入的密碼不一致";
}
