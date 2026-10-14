import { PageHeader } from "@/components/common/page-header";
import { ApplyRecalculationForm, CaseDiffList } from "@/components/settings/calendar-admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdminPage } from "@/lib/auth";
import { previewRecalculation } from "@/server/business-days/calendar-admin-service";

export const metadata = { title: "期限重新計算" };

export default async function RecalculatePage() {
  await requireAdminPage();
  const diffs = await previewRecalculation();
  return (
    <>
      <PageHeader title="期限重新計算" description="依目前之工作日曆與期限規則，比對所有執行中與暫停案件之工作期限。已完成工作保留紀錄、人工鎖定期限不變更。" />
      <Card>
        <CardHeader>
          <CardTitle>差異預覽</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <CaseDiffList diffs={diffs} />
          <ApplyRecalculationForm count={diffs.filter((d) => d.changes.some((c) => c.action !== "SKIP_LOCKED")).length} />
        </CardContent>
      </Card>
    </>
  );
}
