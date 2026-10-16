import { describe, expect, it } from "vitest";
import { checkPublicKey, parsePublicEnv } from "@/lib/env";

function fakeJwt(payload: object): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64(payload)}.signature`;
}

describe("前端金鑰檢查（防止 service role key 外洩到瀏覽器）", () => {
  it("接受 publishable key 與 anon JWT", () => {
    expect(checkPublicKey("sb_publishable_abc123")).toBeNull();
    expect(checkPublicKey(fakeJwt({ role: "anon", iss: "supabase" }))).toBeNull();
  });

  it("拒絕 secret key 與 service_role JWT", () => {
    expect(checkPublicKey("sb_secret_abc123")).toMatch(/secret key/);
    expect(checkPublicKey(fakeJwt({ role: "service_role" }))).toMatch(/service_role/);
  });

  it("拒絕空值與格式錯誤", () => {
    expect(checkPublicKey("")).toMatch(/未設定/);
    expect(checkPublicKey("not-a-key")).toMatch(/格式不正確/);
  });
});

describe("parsePublicEnv", () => {
  it("正常設定", () => {
    const r = parsePublicEnv({
      VITE_SUPABASE_URL: "https://abc.supabase.co/",
      VITE_SUPABASE_ANON_KEY: "sb_publishable_x",
      VITE_SITE_URL: "https://cal.example.com/",
    });
    expect(r).toEqual({
      ok: true,
      env: { supabaseUrl: "https://abc.supabase.co", supabaseAnonKey: "sb_publishable_x", siteUrl: "https://cal.example.com" },
    });
  });

  it("未設定 VITE_SITE_URL 時使用目前網址", () => {
    const r = parsePublicEnv(
      { VITE_SUPABASE_URL: "https://abc.supabase.co", VITE_SUPABASE_ANON_KEY: "sb_publishable_x" },
      "http://localhost:5173",
    );
    expect(r.ok && r.env.siteUrl).toBe("http://localhost:5173");
  });

  it("列出所有錯誤", () => {
    const r = parsePublicEnv({ VITE_SUPABASE_URL: "ftp://x", VITE_SUPABASE_ANON_KEY: "sb_secret_x", VITE_SITE_URL: "x" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toHaveLength(2);
  });
});
