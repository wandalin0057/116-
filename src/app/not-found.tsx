import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-2xl font-bold">找不到頁面</h1>
      <p className="text-sm text-muted-foreground">資料不存在，或您沒有存取權限。</p>
      <Link href="/" className="text-primary hover:underline">
        回到儀表板
      </Link>
    </main>
  );
}
