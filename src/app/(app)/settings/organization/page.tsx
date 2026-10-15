import { PageHeader } from "@/components/common/page-header";
import { OrganizationForm } from "@/components/settings/account-forms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdminPage } from "@/lib/auth";
import { getOrganization } from "@/server/settings/settings-service";

export const metadata = { title: "發文單位資訊" };

export default async function OrganizationPage() {
  await requireAdminPage();
  const org = await getOrganization();
  return (
    <>
      <PageHeader title="發文單位資訊" description="顯示於公文抬頭：公司名稱、地址、聯絡人、電話、傳真、電子郵件。修改後，公文預覽與匯出立即套用。" />
      <Card>
        <CardHeader>
          <CardTitle>公文抬頭</CardTitle>
        </CardHeader>
        <CardContent>
          <OrganizationForm initial={org} />
        </CardContent>
      </Card>
    </>
  );
}
