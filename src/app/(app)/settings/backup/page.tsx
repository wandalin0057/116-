import { Download } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdminPage } from "@/lib/auth";

export const metadata = { title: "資料備份" };

export default async function BackupPage() {
  await requireAdminPage();
  return (
    <>
      <PageHeader title="資料備份" />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>匯出 JSON 備份</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>匯出所有案件、工作、公文、Email 草稿、範本、日曆與設定。為降低外洩風險，不含密碼雜湊與工作階段；附件下載密碼僅保留加密值。</p>
            <p className="text-amber-700">備份檔含業務資料，請妥善保存於受控位置，勿以 Email 傳送。</p>
            <Button asChild>
              <a href="/api/backup">
                <Download />
                下載備份檔
              </a>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>資料庫完整備份（正式環境）</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>正式環境請以 PostgreSQL 備份為主：</p>
            <ul className="list-inside list-disc space-y-1">
              <li>Render PostgreSQL 付費方案提供每日自動備份與時間點還原（PITR），請於 Render 控制台確認已啟用。</li>
              <li>
                亦可定期執行：<code className="rounded bg-slate-100 px-1">pg_dump --format=custom &quot;$DATABASE_URL&quot; &gt; backup.dump</code>
              </li>
              <li>
                還原：<code className="rounded bg-slate-100 px-1">pg_restore --clean --no-owner -d &quot;$DATABASE_URL&quot; backup.dump</code>
              </li>
              <li>還原後請確認 DATA_ENCRYPTION_KEY 與原環境相同，否則無法解密附件下載密碼。</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
