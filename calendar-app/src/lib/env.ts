/**
 * 前端環境變數驗證。
 * 瀏覽器只能使用 Supabase「公開」金鑰；若誤把 service_role / secret key 放進
 * VITE_ 變數，會在啟動時直接拒絕，避免金鑰隨網站公開。
 */
export interface PublicEnv {
  supabaseUrl: string;
  supabaseAnonKey: string;
  siteUrl: string;
}

export type EnvResult = { ok: true; env: PublicEnv } | { ok: false; errors: string[] };

function decodeJwtRole(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1]!.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded)) as { role?: unknown };
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

/** 檢查金鑰是否為可公開的金鑰；回傳錯誤訊息或 null */
export function checkPublicKey(key: string): string | null {
  if (!key) return "未設定 VITE_SUPABASE_ANON_KEY";
  if (key.startsWith("sb_secret_")) return "VITE_SUPABASE_ANON_KEY 是 secret key，不可放在前端，請改用 Publishable key";
  if (key.startsWith("sb_publishable_")) return null;
  const role = decodeJwtRole(key);
  if (role === "service_role") return "VITE_SUPABASE_ANON_KEY 是 service_role key，不可放在前端，請改用 anon public key";
  if (role === "anon") return null;
  return "VITE_SUPABASE_ANON_KEY 格式不正確，請貼上 Supabase 的 Publishable key 或 anon public key";
}

export function parsePublicEnv(raw: Record<string, string | undefined>, fallbackSiteUrl?: string): EnvResult {
  const errors: string[] = [];
  const supabaseUrl = (raw.VITE_SUPABASE_URL ?? "").trim().replace(/\/+$/, "");
  const supabaseAnonKey = (raw.VITE_SUPABASE_ANON_KEY ?? "").trim();
  const siteUrl = (raw.VITE_SITE_URL ?? fallbackSiteUrl ?? "").trim().replace(/\/+$/, "");

  if (!supabaseUrl) errors.push("未設定 VITE_SUPABASE_URL");
  else if (!/^https:\/\/|^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(supabaseUrl)) {
    errors.push("VITE_SUPABASE_URL 必須是 https:// 開頭的網址");
  }
  const keyError = checkPublicKey(supabaseAnonKey);
  if (keyError) errors.push(keyError);
  if (!siteUrl) errors.push("未設定 VITE_SITE_URL");

  return errors.length ? { ok: false, errors } : { ok: true, env: { supabaseUrl, supabaseAnonKey, siteUrl } };
}
