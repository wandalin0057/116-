import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Params = Record<string, string | string[] | undefined>;

export function buildHref(pathname: string, params: Params, changes: Record<string, string | null>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (typeof v === "string" && v) sp.set(k, v);
  for (const [k, v] of Object.entries(changes)) {
    if (v === null) sp.delete(k);
    else sp.set(k, v);
  }
  const s = sp.toString();
  return s ? `${pathname}?${s}` : pathname;
}

/** 可排序表頭（伺服器端排序） */
export function SortHeader({ label, field, pathname, params, defaultSort }: { label: string; field: string; pathname: string; params: Params; defaultSort?: string }) {
  const current = (params.sort as string) ?? defaultSort;
  const dir = (params.dir as string) ?? "asc";
  const active = current === field;
  const nextDir = active && dir === "asc" ? "desc" : "asc";
  const Icon = active ? (dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <Link href={buildHref(pathname, params, { sort: field, dir: nextDir, page: null })} className={cn("inline-flex items-center gap-1 hover:text-primary", active && "text-primary")}>
      {label}
      <Icon className="h-3 w-3" />
    </Link>
  );
}

export function Pagination({ total, page, pageSize, pathname, params }: { total: number; page: number; pageSize: number; pathname: string; params: Params }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(page * pageSize, total);
  const link = (p: number, children: React.ReactNode, disabled: boolean, label: string) =>
    disabled ? (
      <span className="inline-flex h-8 items-center rounded-md border px-2 text-slate-300" aria-disabled>
        {children}
      </span>
    ) : (
      <Link aria-label={label} href={buildHref(pathname, params, { page: String(p) })} className="inline-flex h-8 items-center rounded-md border bg-white px-2 hover:bg-accent">
        {children}
      </Link>
    );
  return (
    <div className="flex flex-col items-center justify-between gap-2 border-t px-3 py-2 text-sm text-muted-foreground sm:flex-row">
      <span>
        共 {total} 筆，顯示第 {from}–{to} 筆
      </span>
      <div className="flex items-center gap-2">
        {link(page - 1, <ChevronLeft className="h-4 w-4" />, page <= 1, "上一頁")}
        <span className="tabular">
          第 {page} / {pages} 頁
        </span>
        {link(page + 1, <ChevronRight className="h-4 w-4" />, page >= pages, "下一頁")}
      </div>
    </div>
  );
}
