import { Sidebar } from "@/components/layout/sidebar";
import { ViewerProvider } from "@/components/layout/viewer-context";
import { headers } from "next/headers";
import { requireUser } from "@/lib/auth";
import { rememberSiteUrl } from "@/server/settings/site-url";
import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  await rememberSiteUrl(await headers());
  const mustChange = (await prisma.user.findUnique({ where: { id: user.id }, select: { mustChangePassword: true } }))?.mustChangePassword;
  return (
    <ViewerProvider role={user.role}>
    <div className="min-h-screen">
      <Sidebar user={{ name: user.name, role: user.role }} />
      <main className="lg:pl-60">
        <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6">
          {mustChange && (
            <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
              你目前使用的是初始密碼，請盡快
              <Link href="/settings/account" className="mx-1 font-medium text-blue-700 underline">
                變更密碼
              </Link>
              。
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
    </ViewerProvider>
  );
}
