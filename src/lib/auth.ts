import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { SESSION_COOKIE, validateSessionToken } from "@/server/auth/session";
import { isAdmin, type AuthUser } from "@/server/auth/types";
import { ForbiddenError, UnauthorizedError } from "@/server/errors";

/** 取得目前登入者（同一請求內快取） */
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const result = await validateSessionToken(token);
  return result?.user ?? null;
});

/** 頁面使用：未登入導向登入頁 */
export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** 頁面使用：非管理員導向首頁 */
export async function requireAdminPage(): Promise<AuthUser> {
  const user = await requireUser();
  if (!isAdmin(user)) redirect("/?error=forbidden");
  return user;
}

/** Server Action / API 使用：未登入拋出錯誤 */
export async function requireUserForAction(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

export async function requireAdminForAction(): Promise<AuthUser> {
  const user = await requireUserForAction();
  if (!isAdmin(user)) throw new ForbiddenError("此功能僅限管理員使用");
  return user;
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getRequestMeta() {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return { ipAddress: forwarded || h.get("x-real-ip") || null, userAgent: h.get("user-agent") };
}
