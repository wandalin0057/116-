import Link from "next/link";
import { PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdminPage } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { previewDigestForUser } from "@/server/reminders/reminder-job";
import { resolveSiteUrl } from "@/server/settings/site-url";
import { ResendDigestButton } from "@/components/settings/resend-digest-button";

export const metadata = { title: "預覽提醒信" };

export default async function DigestPreviewPage({ searchParams }: { searchParams: Promise<{ user?: string }> }) {
  await requireAdminPage();
  const sp = await searchParams;
  const users = await prisma.user.findMany({ where: { isActive: true }, orderBy: [{ role: "asc" }, { name: "asc" }], select: { id: true, name: true, email: true, role: true } });
  const selected = users.find((u) => u.id === sp.user) ?? users.find((u) => u.role === "USER") ?? users[0];
  const preview = selected ? await previewDigestForUser(selected.id) : null;
  const siteUrl = await resolveSiteUrl();

  return (
    <>
      <PageHeader
        title="預覽提醒信"
        description="選擇一位使用者，查看他今天會收到的每日提醒信內容。只是預覽，不會寄出任何信件。"
        actions={
          <Button asChild variant="outline">
            <Link href="/notifications">回提醒紀錄</Link>
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap gap-1.5">
        {users.map((u) => (
          <Button key={u.id} asChild size="sm" variant={u.id === selected?.id ? "default" : "outline"}>
            <Link href={`/notifications/preview?user=${u.id}`}>
              {u.name}
              {u.role === "ADMIN" && <span className="text-xs opacity-80">（管理員）</span>}
            </Link>
          </Button>
        ))}
      </div>
      {preview && selected && (
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-base">{preview.subject}</CardTitle>
            <p className="text-sm text-muted-foreground">收件人：{preview.to}</p>
            <p className="text-sm text-muted-foreground">信中連結網址：{siteUrl}（在預覽中點連結會開新分頁）</p>
            <div className="flex flex-wrap items-center gap-3">
              {preview.note ? <Badge variant="warning">{preview.note}</Badge> : <Badge variant="success">共 {preview.itemCount} 項工作</Badge>}
              <ResendDigestButton userId={selected.id} name={selected.name} to={preview.to} disabled={!preview.itemCount} />
            </div>
          </CardHeader>
          <CardContent>
            {/* 信中連結一律開新分頁（網站禁止被嵌入框架，直接在框內開啟會顯示「拒絕連線」） */}
            <iframe
              title="提醒信預覽"
              srcDoc={`<base target="_blank">${preview.html}`}
              sandbox="allow-popups allow-popups-to-escape-sandbox"
              className="h-[70vh] w-full rounded-md border bg-white"
            />
          </CardContent>
        </Card>
      )}
    </>
  );
}
