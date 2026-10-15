import { PageHeader } from "@/components/common/page-header";
import { ChangePasswordForm } from "@/components/settings/account-forms";
import { SignatureRichEditor } from "@/components/settings/signature-rich-editor";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { resolveSignatureHtml } from "@/server/users/user-service";

export const metadata = { title: "個人帳號" };

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export default async function AccountPage() {
  const user = await requireUser();
  const me = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { emailSignature: true, signatureImage: true, signatureStyle: true, signatureHtml: true },
  });
  const initialHtml =
    resolveSignatureHtml(me) ||
    `<p><strong>${esc(user.name)}</strong> 規劃師</p><p><a href="mailto:${esc(user.email)}">${esc(user.email)}</a></p><p>TEL +886-2-0000-0000 ext.0000</p>`;
  return (
    <>
      <PageHeader title="個人帳號" description={`${user.name}（${user.email}）`} />
      <Card className="mb-5">
        <CardHeader>
          <CardTitle>Email 簽名檔</CardTitle>
          <p className="text-sm text-muted-foreground">像 Word 一樣編輯：先選取文字，再用上方工具列調整字型、大小、顏色、粗體，或加上超連結；圖片可插入並調整大小。</p>
        </CardHeader>
        <CardContent>
          <SignatureRichEditor initialHtml={initialHtml} />
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
