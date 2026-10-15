import { PageHeader } from "@/components/common/page-header";
import { ChangePasswordForm, SignatureForm } from "@/components/settings/account-forms";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "個人帳號" };

export default async function AccountPage() {
  const user = await requireUser();
  const me = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { emailSignature: true } });
  return (
    <>
      <PageHeader title="個人帳號" description={`${user.name}（${user.email}）`} />
      <Card className="mb-5">
        <CardHeader>
          <CardTitle>Email 簽名檔</CardTitle>
        </CardHeader>
        <CardContent>
          <SignatureForm
            initial={me.emailSignature ?? ""}
            placeholder={`${user.name} 規劃師\n${user.email}\n110 台北市○○區○○路○號○樓\nTEL +886-2-0000-0000 ext.0000\nFAX +886-2-0000-0000`}
          />
        </CardContent>
      </Card>
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
