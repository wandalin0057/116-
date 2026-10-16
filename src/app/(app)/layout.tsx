import { Sidebar } from "@/components/layout/sidebar";
import { ViewerProvider } from "@/components/layout/viewer-context";
import { headers } from "next/headers";
import { requireUser } from "@/lib/auth";
import { rememberSiteUrl } from "@/server/settings/site-url";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  await rememberSiteUrl(await headers());
  return (
    <ViewerProvider role={user.role}>
    <div className="min-h-screen">
      <Sidebar user={{ name: user.name, role: user.role }} />
      <main className="lg:pl-60">
        <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6">{children}</div>
      </main>
    </div>
    </ViewerProvider>
  );
}
