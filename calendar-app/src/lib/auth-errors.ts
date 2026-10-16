/** 將 Supabase Auth 錯誤轉為繁體中文訊息 */
interface AuthLikeError {
  message?: string;
  code?: string;
  status?: number;
}

const BY_CODE: Record<string, string> = {
  invalid_credentials: "Email 或密碼錯誤",
  email_not_confirmed: "此 Email 尚未完成驗證，請至信箱點擊確認連結",
  user_already_exists: "此 Email 已經註冊，請直接登入或使用忘記密碼",
  email_exists: "此 Email 已經註冊，請直接登入或使用忘記密碼",
  weak_password: "密碼強度不足，請使用至少 8 碼並混合英文與數字",
  same_password: "新密碼不可與舊密碼相同",
  over_email_send_rate_limit: "寄信次數過多，請稍後再試",
  over_request_rate_limit: "操作過於頻繁，請稍後再試",
  signup_disabled: "目前暫停開放註冊",
  email_address_invalid: "Email 格式不正確",
  session_expired: "登入已過期，請重新登入",
  session_not_found: "登入已過期，請重新登入",
  otp_expired: "連結已失效，請重新申請",
  validation_failed: "輸入資料格式不正確",
};

const BY_MESSAGE: Array<[RegExp, string]> = [
  [/invalid login credentials/i, BY_CODE.invalid_credentials!],
  [/email not confirmed/i, BY_CODE.email_not_confirmed!],
  [/already registered/i, BY_CODE.user_already_exists!],
  [/password should be at least/i, "密碼長度不足"],
  [/rate limit/i, BY_CODE.over_request_rate_limit!],
  [/expired|invalid.*(token|link)/i, BY_CODE.otp_expired!],
  [/failed to fetch|network/i, "無法連線到伺服器，請確認網路連線"],
];

export function translateAuthError(error: unknown): string {
  if (!error) return "";
  const e = error as AuthLikeError;
  if (e.code && BY_CODE[e.code]) return BY_CODE[e.code]!;
  const msg = e.message ?? String(error);
  for (const [re, zh] of BY_MESSAGE) if (re.test(msg)) return zh;
  if (e.status === 429) return BY_CODE.over_request_rate_limit!;
  return "發生錯誤，請稍後再試";
}
