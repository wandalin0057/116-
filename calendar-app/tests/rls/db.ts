import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

/**
 * RLS 測試工具：直接連線 PostgreSQL，以 Supabase 相同方式切換角色與 JWT claims，
 * 驗證「資料庫本身」是否阻擋越權存取（不經過前端畫面）。
 */
const ROOT = join(import.meta.dirname, "..", "..");

export function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error(
      "未設定 TEST_DATABASE_URL。請先執行 `npm run db:local:up`，再以 " +
        "TEST_DATABASE_URL=postgresql://postgres@localhost:54329/calendar_test npm run test:rls 執行",
    );
  }
  return url;
}

export function migrationFiles(): string[] {
  const dir = join(ROOT, "supabase", "migrations");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => join(dir, f));
}

/** 重建資料庫：模擬 Supabase 平台物件 → 依序套用所有 migration */
export async function resetDatabase(): Promise<void> {
  const client = new pg.Client({ connectionString: testDatabaseUrl() });
  await client.connect();
  try {
    await client.query("drop schema if exists public cascade; drop schema if exists auth cascade; create schema public;");
    await client.query(readFileSync(join(ROOT, "supabase", "tests", "supabase-shim.sql"), "utf8"));
    for (const file of migrationFiles()) {
      try {
        await client.query(readFileSync(file, "utf8"));
      } catch (err) {
        throw new Error(`套用 migration 失敗：${file}\n${(err as Error).message}`);
      }
    }
  } finally {
    await client.end();
  }
}

let pool: pg.Pool | null = null;
export function getPool(): pg.Pool {
  pool ??= new pg.Pool({ connectionString: testDatabaseUrl(), max: 4 });
  return pool;
}
export async function closePool(): Promise<void> {
  await pool?.end();
  pool = null;
}

type Role = "anon" | "authenticated" | "service_role";

async function withRole<T>(role: Role, sub: string | null, fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query(`set local role ${role}`);
    const claims = sub ? { sub, role } : { role };
    await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (err) {
    await client.query("rollback").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

/** 以登入使用者身分（等同前端帶著該使用者的 JWT 呼叫 Supabase）執行 */
export const asUser = <T>(userId: string, fn: (c: pg.PoolClient) => Promise<T>) => withRole("authenticated", userId, fn);
/** 以未登入訪客身分執行 */
export const asAnon = <T>(fn: (c: pg.PoolClient) => Promise<T>) => withRole("anon", null, fn);
/** 以後端 service_role 身分執行（僅 Cloudflare Worker 使用） */
export const asService = <T>(fn: (c: pg.PoolClient) => Promise<T>) => withRole("service_role", null, fn);

/** 以超級使用者執行（測試準備資料、模擬 Supabase Auth 建立帳號） */
export async function asAdmin<T>(fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

/** 模擬 Supabase Auth 註冊：寫入 auth.users，觸發 handle_new_user */
export async function createUser(email: string, displayName?: string): Promise<string> {
  return asAdmin(async (c) => {
    const { rows } = await c.query<{ id: string }>(
      "insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id",
      [email, JSON.stringify(displayName ? { display_name: displayName } : {})],
    );
    return rows[0]!.id;
  });
}

/** 預期 SQL 失敗；回傳錯誤訊息 */
export async function expectSqlError(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (err) {
    return (err as Error).message;
  }
  throw new Error("預期資料庫拒絕此操作，但操作成功了");
}
