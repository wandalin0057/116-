import { PageHeader } from "@/components/common/page-header";
import { CreateUserDialog, DefaultPasswordCard, EditUserDialog } from "@/components/settings/user-admin";
import { hasDefaultPassword } from "@/server/users/default-password";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth";
import { formatROCDateTime } from "@/lib/dates";

export const metadata = { title: "使用者管理" };

export default async function UsersPage() {
  await requireAdminPage();
  const users = await prisma.user.findMany({
    orderBy: [{ isActive: "desc" }, { role: "asc" }, { name: "asc" }],
    select: { id: true, email: true, name: true, role: true, isActive: true, lastLoginAt: true, mustChangePassword: true, _count: { select: { responsibleCases: true, assignedTasks: true } } },
  });
  const hasDefault = await hasDefaultPassword();
  const userCount = users.filter((u) => u.role === "USER" && u.isActive).length;
  return (
    <>
      <PageHeader title="使用者管理" description="使用者不可刪除，以「停用」保留歷史紀錄。" actions={<CreateUserDialog hasDefault={hasDefault} />} />
      <Card className="mb-5">
        <CardHeader>
          <CardTitle>一般使用者初始密碼</CardTitle>
        </CardHeader>
        <CardContent>
          <DefaultPasswordCard hasDefault={hasDefault} userCount={userCount} />
        </CardContent>
      </Card>
      <Card>
        <Table>
          <THead>
            <TR>
              <TH>姓名</TH>
              <TH>Email</TH>
              <TH>角色</TH>
              <TH>狀態</TH>
              <TH>負責案件</TH>
              <TH>最後登入</TH>
              <TH />
            </TR>
          </THead>
          <TBody>
            {users.map((u) => (
              <TR key={u.id} className={u.isActive ? undefined : "opacity-60"}>
                <TD className="font-medium">{u.name}</TD>
                <TD className="text-xs">{u.email}</TD>
                <TD>
                  <Badge variant={u.role === "ADMIN" ? "default" : "outline"}>{u.role === "ADMIN" ? "管理員" : "一般使用者"}</Badge>
                </TD>
                <TD>
                  <Badge variant={u.isActive ? "success" : "muted"}>{u.isActive ? "啟用" : "停用"}</Badge>
                  {u.mustChangePassword && u.isActive && (
                    <Badge variant="warning" className="ml-1">
                      初始密碼
                    </Badge>
                  )}
                </TD>
                <TD className="tabular">{u._count.responsibleCases}</TD>
                <TD className="whitespace-nowrap text-xs tabular">{formatROCDateTime(u.lastLoginAt)}</TD>
                <TD>
                  <EditUserDialog user={{ id: u.id, name: u.name, role: u.role, isActive: u.isActive, email: u.email }} />
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </>
  );
}
