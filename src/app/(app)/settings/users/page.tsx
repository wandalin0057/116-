import { PageHeader } from "@/components/common/page-header";
import { CreateUserDialog, EditUserDialog } from "@/components/settings/user-admin";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth";
import { formatROCDateTime } from "@/lib/dates";

export const metadata = { title: "使用者管理" };

export default async function UsersPage() {
  await requireAdminPage();
  const users = await prisma.user.findMany({
    orderBy: [{ isActive: "desc" }, { role: "asc" }, { name: "asc" }],
    select: { id: true, email: true, name: true, role: true, isActive: true, lastLoginAt: true, _count: { select: { responsibleCases: true, assignedTasks: true } } },
  });
  return (
    <>
      <PageHeader title="使用者管理" description="使用者不可刪除，以「停用」保留歷史紀錄。" actions={<CreateUserDialog />} />
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
