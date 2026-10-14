import { PageHeader } from "@/components/common/page-header";
import { ChangePasswordForm } from "@/components/settings/account-forms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "個人帳號" };

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <>
      <PageHeader title="個人帳號" description={`${user.name}（${user.email}）`} />
      <Card>
        <CardHeader>
          <CardTitle>變更密碼</CardTitle>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </>
  );
}
