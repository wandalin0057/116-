import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { LoginForm } from "./login-form";

export const metadata = { title: "登入" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getCurrentUser()) redirect("/");
  const { next } = await searchParams;
  // 系統尚未建立任何管理員時，提示部署設定問題（僅在未初始化時顯示）
  const noAdmin = (await prisma.user.count({ where: { role: "ADMIN", isActive: true } })) === 0;
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-100 to-slate-200 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--sidebar))] text-white">
            <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden>
              <path d="M9 22l7-12 7 12z" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
              <circle cx="16" cy="19" r="1.6" fill="#fbbf24" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-900">通學區案件期程暨發文管理系統</h1>
          <p className="mt-1 text-sm text-muted-foreground">請以公司帳號登入</p>
        </div>
        {noAdmin && (
          <div role="status" className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-semibold">系統尚未建立管理員帳號</p>
            <p className="mt-1">
              請到 Render → Environment 確認 <code>INITIAL_ADMIN_EMAIL</code> 與 <code>INITIAL_ADMIN_PASSWORD</code> 已填寫，密碼需至少 10 個字元且同時包含英文字母與數字；修改後按 Save Changes，等網站重新啟動再登入。
            </p>
          </div>
        )}
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <LoginForm next={next} />
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">忘記密碼請聯絡系統管理員重設</p>
      </div>
    </main>
  );
}
