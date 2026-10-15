import { PageHeader } from "@/components/common/page-header";
import { ChangePasswordForm, SignatureForm, SignatureImageForm } from "@/components/settings/account-forms";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "個人帳號" };

export default async function AccountPage() {
  const user = await requireUser();
  const me = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { emailSignature: true, signatureImage: true } });
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
      <Card className="mb-5">
        <CardHeader>
          <CardTitle>Email 簽名圖片</CardTitle>
          <p className="text-sm text-muted-foreground">圖片會接在 Email 內文最後面。使用 Email 草稿頁的「複製內文（含簽名圖片）」，再貼到 Outlook 即可帶入圖片。</p>
        </CardHeader>
        <CardContent>
          <SignatureImageForm initial={me.signatureImage} />
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
