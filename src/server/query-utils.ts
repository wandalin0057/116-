/** 產生 Prisma 排序條件；僅可為 null 之欄位才指定 nulls: last */
export function orderBy(field: string, dir: "asc" | "desc", nullable: readonly string[]) {
  return { [field]: nullable.includes(field) ? { sort: dir, nulls: "last" as const } : dir };
}

export function pageParams(page?: number, pageSize?: number, max = 100) {
  const size = Math.min(Math.max(pageSize ?? 20, 5), max);
  const p = Math.max(page ?? 1, 1);
  return { page: p, pageSize: size, skip: (p - 1) * size, take: size };
}
