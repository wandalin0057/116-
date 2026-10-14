"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { clearSessionCookie, getCurrentUser, getRequestMeta, setSessionCookie } from "@/lib/auth";
import { writeAudit } from "@/server/audit/audit";
import { authenticate } from "@/server/auth/login";
import { revokeSessionToken, SESSION_COOKIE } from "@/server/auth/session";

export interface LoginState {
  error?: string;
  /** 登入失敗時保留 Email（React 表單送出後會重設欄位） */
  email?: string;
}

const loginSchema = z.object({
  email: z.string().trim().email("請輸入有效的 Email"),
  password: z.string().min(1, "請輸入密碼").max(200),
  next: z.string().optional(),
});

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").slice(0, 200);
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "請輸入帳號密碼", email };
  const meta = await getRequestMeta();
  const result = await authenticate(parsed.data.email, parsed.data.password, meta);
  if (!result.ok) return { error: result.message, email };
  await setSessionCookie(result.token, result.expiresAt);
  // 僅允許站內相對路徑，避免開放式重新導向
  const next = parsed.data.next && /^\/(?!\/)/.test(parsed.data.next) ? parsed.data.next : "/";
  redirect(next);
}

export async function logoutAction() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const user = await getCurrentUser();
  if (token) await revokeSessionToken(token);
  await clearSessionCookie();
  if (user) await writeAudit({ actorId: user.id, action: "LOGOUT", entityType: "User", entityId: user.id, summary: "登出系統" });
  redirect("/login");
}
