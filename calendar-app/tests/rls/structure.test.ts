import { afterAll, describe, expect, it } from "vitest";
import { asAdmin, closePool } from "./db";

/** 結構性檢查：確保日後新增資料表或政策時不會漏掉 RLS */

const CUSTOMER_TABLES = [
  "profiles",
  "projects",
  "calendar_events",
  "deadline_rules",
  "holidays",
  "notification_preferences",
  "push_subscriptions",
  "notification_jobs",
  "notification_logs",
];

afterAll(closePool);

describe("資料庫結構安全檢查", () => {
  it("需求列出的資料表全部存在，且每張客戶資料表都有 user_id", async () => {
    const { rows } = await asAdmin((c) =>
      c.query<{ table_name: string }>(
        `select table_name from information_schema.columns
         where table_schema = 'public' and column_name = 'user_id'`,
      ),
    );
    const withUserId = new Set(rows.map((r) => r.table_name));
    for (const t of CUSTOMER_TABLES) expect(withUserId, t).toContain(t);
  });

  it("public schema 所有資料表皆啟用 RLS", async () => {
    const { rows } = await asAdmin((c) =>
      c.query<{ relname: string; relrowsecurity: boolean }>(
        `select c.relname, c.relrowsecurity from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relkind = 'r'`,
      ),
    );
    expect(rows.length).toBeGreaterThanOrEqual(CUSTOMER_TABLES.length);
    for (const r of rows) expect(r.relrowsecurity, `${r.relname} 未啟用 RLS`).toBe(true);
  });

  it("每張客戶資料表都有 SELECT、INSERT、UPDATE、DELETE 政策", async () => {
    const { rows } = await asAdmin((c) =>
      c.query<{ tablename: string; cmd: string }>(
        `select tablename, cmd from pg_policies where schemaname = 'public'`,
      ),
    );
    for (const t of CUSTOMER_TABLES) {
      const cmds = new Set(rows.filter((r) => r.tablename === t).map((r) => r.cmd));
      for (const cmd of ["SELECT", "INSERT", "UPDATE", "DELETE"]) {
        expect(cmds.has(cmd), `${t} 缺少 ${cmd} 政策`).toBe(true);
      }
      expect(cmds.has("ALL"), `${t} 不應使用 FOR ALL 政策`).toBe(false);
    }
  });

  it("政策只套用於 authenticated，沒有開放給 anon 或 public", async () => {
    const { rows } = await asAdmin((c) =>
      c.query<{ tablename: string; policyname: string; roles: string[] }>(
        `select tablename, policyname, roles::text[] as roles from pg_policies where schemaname = 'public'`,
      ),
    );
    for (const r of rows) expect(r.roles, `${r.tablename}.${r.policyname}`).toEqual(["authenticated"]);
  });

  it("客戶資料表的政策都以 auth.uid() 驗證所有權", async () => {
    const { rows } = await asAdmin((c) =>
      c.query<{ tablename: string; policyname: string; qual: string | null; with_check: string | null }>(
        `select tablename, policyname, qual, with_check from pg_policies
         where schemaname = 'public' and tablename = any($1)`,
        [CUSTOMER_TABLES],
      ),
    );
    for (const r of rows) {
      // 系統表的寫入政策為 false（一律拒絕），其餘必須比對 auth.uid()
      if ([r.qual, r.with_check].every((e) => e === null || e === "false")) continue;
      const expr = `${r.qual ?? ""} ${r.with_check ?? ""}`;
      expect(expr, `${r.tablename}.${r.policyname}`).toMatch(/auth\.uid\(\)/);
    }
  });

  it("anon 角色對任何資料表都沒有權限", async () => {
    const { rows } = await asAdmin((c) =>
      c.query(
        `select table_name, privilege_type from information_schema.role_table_grants
         where table_schema = 'public' and grantee = 'anon'`,
      ),
    );
    expect(rows).toEqual([]);
  });

  it("authenticated 對系統管理的表只有 SELECT 權限", async () => {
    const { rows } = await asAdmin((c) =>
      c.query<{ table_name: string; privilege_type: string }>(
        `select table_name, privilege_type from information_schema.role_table_grants
         where table_schema = 'public' and grantee = 'authenticated'
           and table_name in ('notification_jobs', 'notification_logs', 'holiday_years')`,
      ),
    );
    for (const r of rows) expect(r.privilege_type, r.table_name).toBe("SELECT");
  });

  it("SECURITY DEFINER 函式都固定 search_path，且 anon 不能執行", async () => {
    const { rows } = await asAdmin((c) =>
      c.query<{ proname: string; config: string[] | null; anon_exec: boolean }>(
        `select p.proname, p.proconfig as config, has_function_privilege('anon', p.oid, 'execute') as anon_exec
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.prosecdef`,
      ),
    );
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.config ?? [], r.proname).toContain('search_path=""');
      expect(r.anon_exec, `anon 可執行 ${r.proname}`).toBe(false);
    }
  });

  it("內部函式 seed_default_deadline_rules 不能被一般使用者呼叫", async () => {
    const { rows } = await asAdmin((c) =>
      c.query<{ ok: boolean }>(
        `select has_function_privilege('authenticated', 'public.seed_default_deadline_rules(uuid)', 'execute') as ok`,
      ),
    );
    expect(rows[0]!.ok).toBe(false);
  });
});
