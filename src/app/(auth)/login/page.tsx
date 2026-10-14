import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata = { title: "登入" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getCurrentUser()) redirect("/");
  const { next } = await searchParams;
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
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <LoginForm next={next} />
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">忘記密碼請聯絡系統管理員重設</p>
      </div>
    </main>
  );
}
