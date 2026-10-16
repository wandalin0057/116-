import { prisma } from "@/lib/db";

/**
 * 網站對外網址（提醒信中的連結使用）。
 * 每日提醒由 GitHub Actions 執行，若 SITE_URL 設定錯誤或漏填，信中連結會打不開；
 * 因此網站被瀏覽時自動記住實際網址，寄信時優先使用。
 */
const KEY = "siteUrl";
let cached: string | null = null;

/** 將使用者輸入的網址整理為 https://host（補上 https://、去除結尾斜線與多餘路徑） */
export function normalizeSiteUrl(raw: string | null | undefined): string | null {
  const v = raw?.trim();
  if (!v) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    if (!u.hostname.includes(".") && u.hostname !== "localhost") return null;
    return u.origin;
  } catch {
    return null;
  }
}

const isLocal = (url: string) => /\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|$)/.test(url);

/** 由網站請求標頭記住對外網址（僅公開網址；內容相同時不寫入） */
export async function rememberSiteUrl(headers: Headers): Promise<void> {
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  if (!host) return;
  const proto = headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
  const url = normalizeSiteUrl(`${proto}://${host.split(",")[0]!.trim()}`);
  if (!url || isLocal(url) || url === cached) return;
  try {
    const row = await prisma.systemSetting.findUnique({ where: { key: KEY } });
    if ((row?.value as { url?: string } | null)?.url !== url) {
      await prisma.systemSetting.upsert({ where: { key: KEY }, create: { key: KEY, value: { url } }, update: { value: { url } } });
    }
    cached = url;
  } catch {
    // 記錄網址失敗不影響頁面
  }
}

/** 提醒信連結使用的網址：網站實際網址 → APP_URL 環境變數 → 本機 */
export async function resolveSiteUrl(): Promise<string> {
  const row = await prisma.systemSetting.findUnique({ where: { key: KEY } }).catch(() => null);
  const stored = normalizeSiteUrl((row?.value as { url?: string } | null)?.url);
  if (stored) return stored;
  const env = normalizeSiteUrl(process.env.APP_URL);
  return env && !isLocal(env) ? env : env ?? "http://localhost:3000";
}
