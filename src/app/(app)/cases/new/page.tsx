import { CaseForm } from "@/components/cases/case-form";
import { caseToFormValues } from "@/components/cases/case-form-values";
import { PageHeader } from "@/components/common/page-header";
import { requireUser } from "@/lib/auth";
import { listUsers } from "@/server/users/user-service";
import { listProjectNames } from "@/server/cases/projects";

export const metadata = { title: "新增學校案件" };

export default async function NewCasePage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const user = await requireUser();
  const { project } = await searchParams;
  const [users, names] = await Promise.all([
    listUsers(),
    listProjectNames(),
  ]);
  return (
    <>
      <PageHeader title="新增學校案件" description="每所學校建立一筆案件；建立後系統依期限規則自動產生工作項目。" />
      <CaseForm
        mode="create"
        initial={caseToFormValues(null, { projectName: project && names.includes(project) ? project : names[0] })}
        users={users.map((u) => ({ id: u.id, name: u.name, email: u.email }))}
        canCreateResponsible={user.role === "ADMIN"}
        projectNames={names}
      />
    </>
  );
}
