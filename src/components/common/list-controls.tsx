"use client";
import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";

/** 搜尋與篩選列：變更後更新網址參數（伺服器端查詢） */
export function ListControls({
  searchPlaceholder = "搜尋…",
  filters = [],
  showSearch = true,
}: {
  searchPlaceholder?: string;
  showSearch?: boolean;
  filters?: { name: string; label: string; options: { value: string; label: string }[]; allLabel?: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [pending, start] = useTransition();

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete("page");
    start(() => router.push(`${pathname}?${next.toString()}`));
  };

  const hasFilters = !!params.get("q") || filters.some((f) => params.get(f.name));

  return (
    <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
      {showSearch && (
        <form
          className="relative md:w-72"
          onSubmit={(e) => {
            e.preventDefault();
            update({ q: q.trim() || null });
          }}
        >
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={searchPlaceholder} className="pl-8" aria-label="搜尋" />
        </form>
      )}
      {filters.map((f) => (
        <Select key={f.name} aria-label={f.label} className="md:w-44" value={params.get(f.name) ?? ""} onChange={(e) => update({ [f.name]: e.target.value || null })}>
          <option value="">{f.allLabel ?? `全部${f.label}`}</option>
          {f.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      ))}
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setQ("");
            start(() => router.push(pathname));
          }}
        >
          <X />
          清除條件
        </Button>
      )}
      {pending && <span className="text-xs text-muted-foreground">載入中…</span>}
    </div>
  );
}
