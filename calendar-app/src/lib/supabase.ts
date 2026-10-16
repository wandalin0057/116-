import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { parsePublicEnv, type EnvResult } from "./env";

/**
 * 瀏覽器端 Supabase 用戶端（只使用公開金鑰）。
 * 資料安全由資料庫 RLS 保障；這裡不做任何權限判斷。
 */
export const envResult: EnvResult = parsePublicEnv(
  import.meta.env as unknown as Record<string, string | undefined>,
  typeof window !== "undefined" ? window.location.origin : undefined,
);

export const supabase: SupabaseClient | null = envResult.ok
  ? createClient(envResult.env.supabaseUrl, envResult.env.supabaseAnonKey, {
      auth: {
        persistSession: true, // 保持登入狀態（重新開啟瀏覽器仍登入）
        autoRefreshToken: true,
        detectSessionInUrl: true, // 處理 Email 確認與密碼重設連結
        flowType: "pkce",
      },
    })
  : null;

export function requireSupabase(): SupabaseClient {
  if (!supabase) throw new Error("Supabase 尚未設定");
  return supabase;
}

export function siteUrl(): string {
  return envResult.ok ? envResult.env.siteUrl : window.location.origin;
}
