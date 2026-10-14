import { Sidebar } from "@/components/layout/sidebar";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="min-h-screen">
      <Sidebar user={{ name: user.name, role: user.role }} />
      <main className="lg:pl-60">
        <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6">{children}</div>
      </main>
    </div>
  );
}
