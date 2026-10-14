import type { TemplateType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/server/audit/audit";
import { assertAdmin } from "@/server/auth/permissions";
import type { AuthUser } from "@/server/auth/types";
import { NotFoundError, ValidationError } from "@/server/errors";
import { ALL_DEFAULT_TEMPLATES, type TemplateDef } from "./default-templates";

export interface ActiveTemplate extends TemplateDef {
  id: string | null;
  version: number;
}

export async function getActiveTemplate(type: TemplateType): Promise<ActiveTemplate> {
  const row = await prisma.documentTemplate.findFirst({ where: { type, isActive: true }, orderBy: { version: "desc" } });
  if (row) return { id: row.id, type: row.type, category: row.category, name: row.name, subject: row.subject, body: row.body, version: row.version };
  const def = ALL_DEFAULT_TEMPLATES.find((t) => t.type === type);
  if (!def) throw new NotFoundError("找不到範本");
  return { ...def, id: null, version: 0 };
}

export async function listTemplateVersions(type: TemplateType) {
  return prisma.documentTemplate.findMany({ where: { type }, orderBy: { version: "desc" }, include: { createdBy: { select: { name: true } } } });
}

const templateSchema = z.object({
  name: z.string().trim().min(1, "請輸入範本名稱").max(100),
  subject: z.string().trim().min(1, "請輸入主旨").max(1000),
  body: z.string().trim().min(1, "請輸入內容").max(10000),
  changeNote: z.string().trim().max(500).optional(),
});

/** 儲存新版本並設為啟用（舊版本保留，可回復） */
export async function saveTemplateVersion(user: AuthUser, type: TemplateType, input: z.input<typeof templateSchema>) {
  assertAdmin(user);
  const p = templateSchema.safeParse(input);
  if (!p.success) throw new ValidationError(p.error.issues[0]?.message ?? "資料格式錯誤");
  const def = ALL_DEFAULT_TEMPLATES.find((t) => t.type === type);
  if (!def) throw new NotFoundError("範本類型錯誤");
  const created = await prisma.$transaction(async (tx) => {
    const latest = await tx.documentTemplate.findFirst({ where: { type }, orderBy: { version: "desc" } });
    await tx.documentTemplate.updateMany({ where: { type, isActive: true }, data: { isActive: false } });
    return tx.documentTemplate.create({
      data: {
        type,
        category: def.category,
        version: (latest?.version ?? 0) + 1,
        name: p.data.name,
        subject: p.data.subject,
        body: p.data.body,
        changeNote: p.data.changeNote,
        isActive: true,
        createdById: user.id,
      },
    });
  });
  await writeAudit({ actorId: user.id, action: "TEMPLATE_SAVE", entityType: "DocumentTemplate", entityId: created.id, summary: `範本「${created.name}」新增第 ${created.version} 版` });
  return created;
}

export async function activateTemplateVersion(user: AuthUser, templateId: string) {
  assertAdmin(user);
  const t = await prisma.documentTemplate.findUnique({ where: { id: templateId } });
  if (!t) throw new NotFoundError("找不到範本版本");
  await prisma.$transaction([
    prisma.documentTemplate.updateMany({ where: { type: t.type, isActive: true }, data: { isActive: false } }),
    prisma.documentTemplate.update({ where: { id: templateId }, data: { isActive: true } }),
  ]);
  await writeAudit({ actorId: user.id, action: "TEMPLATE_ACTIVATE", entityType: "DocumentTemplate", entityId: templateId, summary: `範本「${t.name}」切換為第 ${t.version} 版` });
}
