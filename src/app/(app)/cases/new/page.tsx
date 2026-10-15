import { CaseForm } from "@/components/cases/case-form";
import { caseToFormValues } from "@/components/cases/case-form-values";
import { PageHeader } from "@/components/common/page-header";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { listUsers } from "@/server/users/user-service";

export const metadata = { title: "新增學校案件" };

export default async function NewCasePage() {
  const user = await requireUser();
  const [users, names] = await Promise.all([
    listUsers(),
    prisma.schoolCase.findMany({ distinct: ["projectName"], select: { projectName: true }, orderBy: { projectName: "desc" } }),
  ]);
  return (
    <>
      <PageHeader title="新增學校案件" description="每所學校建立一筆案件；建立後系統依期限規則自動產生工作項目。" />
      <CaseForm
        mode="create"
        initial={caseToFormValues(null, {})}
        users={users.map((u) => ({ id: u.id, name: u.name, email: u.email }))}
        canCreateResponsible={user.role === "ADMIN"}
        projectNames={[...new Set(["115年度臺北市通學區規劃分析案", ...names.map((n) => n.projectName)])]}
      />
    </>
  );
}
