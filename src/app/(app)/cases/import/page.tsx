import { PageHeader } from "@/components/common/page-header";
import { ScheduleImport } from "@/components/import/schedule-import";
import { requireAdminPage } from "@/lib/auth";

export const metadata = { title: "匯入排程" };

export default async function ScheduleImportPage() {
  await requireAdminPage();
  return (
    <>
      <PageHeader
        title="匯入排程（Excel）"
        description="上傳排程甘特圖，系統依每所學校的派案、交初規、審查會議、會勘日期建立或更新案件。可一次選擇多個檔案（例如 115 年與 116 年）。"
      />
      <ScheduleImport />
    </>
  );
}
