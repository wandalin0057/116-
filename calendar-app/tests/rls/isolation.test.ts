import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asAdmin, asAnon, asService, asUser, closePool, createUser, expectSqlError } from "./db";

/**
 * 驗收：兩個帳號資料完全隔離（直接驗證資料庫 RLS）。
 * 每個 asUser 都等同前端帶著該使用者的 JWT 透過 Supabase API 存取資料庫。
 */

let alice: string;
let bob: string;
let aliceProject: string;
let aliceEvent: string;

const RLS_DENIED = /row-level security|permission denied/;

beforeAll(async () => {
  alice = await createUser(`alice-${Date.now()}@example.com`, "Alice");
  bob = await createUser(`bob-${Date.now()}@example.com`, "Bob");

  aliceProject = await asUser(alice, async (c) => {
    const { rows } = await c.query<{ id: string }>(
      "insert into public.projects (name) values ('A 公司機密專案') returning id",
    );
    return rows[0]!.id;
  });
  aliceEvent = await asUser(alice, async (c) => {
    const { rows } = await c.query<{ id: string }>(
      `insert into public.calendar_events (title, event_type, start_at, project_id, notes)
       values ('A 的審查會議', 'meeting', '2026-10-20 10:00+08', $1, '機密備註') returning id`,
      [aliceProject],
    );
    return rows[0]!.id;
  });
});

afterAll(closePool);

describe("註冊後自動建立個人設定", () => {
  it("建立 profile、提醒偏好與 6 條預設期限模板", async () => {
    const result = await asUser(alice, async (c) => ({
      profile: (await c.query("select display_name, timezone from public.profiles")).rows,
      prefs: (await c.query("select default_offsets, default_time from public.notification_preferences")).rows,
      rules: (await c.query("select default_key, offset_business_days from public.deadline_rules order by sort_order")).rows,
    }));
    expect(result.profile).toEqual([{ display_name: "Alice", timezone: "Asia/Taipei" }]);
    expect(result.prefs).toEqual([{ default_offsets: [7, 3, 1, 0], default_time: "09:00:00" }]);
    expect(result.rules.map((r) => [r.default_key, r.offset_business_days])).toEqual([
      ["agency_notice_dispatch", 12],
      ["review_send_slides", -2],
      ["review_send_minutes", 1],
      ["review_send_revised_drawings", 3],
      ["site_upload_slides", -2],
      ["site_send_minutes", 1],
    ]);
  });
});

describe("兩個帳號資料完全隔離", () => {
  it("SELECT：B 看不到 A 的專案、事件、設定、期限模板", async () => {
    const counts = await asUser(bob, async (c) => {
      const q = async (sql: string, params: unknown[] = []) => (await c.query(sql, params)).rowCount;
      return {
        projectById: await q("select 1 from public.projects where id = $1", [aliceProject]),
        eventById: await q("select 1 from public.calendar_events where id = $1", [aliceEvent]),
        aliceProfile: await q("select 1 from public.profiles where user_id = $1", [alice]),
        alicePrefs: await q("select 1 from public.notification_preferences where user_id = $1", [alice]),
        aliceRules: await q("select 1 from public.deadline_rules where user_id = $1", [alice]),
        allProjects: await q("select 1 from public.projects"),
        allEvents: await q("select 1 from public.calendar_events"),
        ownProfile: await q("select 1 from public.profiles"),
      };
    });
    expect(counts).toEqual({
      projectById: 0,
      eventById: 0,
      aliceProfile: 0,
      alicePrefs: 0,
      aliceRules: 0,
      allProjects: 0,
      allEvents: 0,
      ownProfile: 1,
    });
  });

  it("UPDATE：B 無法修改 A 的資料（影響 0 筆）", async () => {
    const affected = await asUser(bob, async (c) => ({
      event: (await c.query("update public.calendar_events set title = '被竄改' where id = $1", [aliceEvent])).rowCount,
      project: (await c.query("update public.projects set name = '被竄改' where id = $1", [aliceProject])).rowCount,
      profile: (await c.query("update public.profiles set display_name = '被竄改' where user_id = $1", [alice])).rowCount,
      rules: (await c.query("update public.deadline_rules set offset_business_days = 30 where user_id = $1", [alice])).rowCount,
    }));
    expect(affected).toEqual({ event: 0, project: 0, profile: 0, rules: 0 });

    const title = await asUser(alice, async (c) =>
      (await c.query<{ title: string }>("select title from public.calendar_events where id = $1", [aliceEvent])).rows[0]!.title,
    );
    expect(title).toBe("A 的審查會議");
  });

  it("DELETE：B 無法刪除 A 的資料（影響 0 筆）", async () => {
    const affected = await asUser(bob, async (c) => ({
      event: (await c.query("delete from public.calendar_events where id = $1", [aliceEvent])).rowCount,
      project: (await c.query("delete from public.projects where id = $1", [aliceProject])).rowCount,
      rules: (await c.query("delete from public.deadline_rules where user_id = $1", [alice])).rowCount,
    }));
    expect(affected).toEqual({ event: 0, project: 0, rules: 0 });
    const stillThere = await asAdmin(async (c) =>
      (await c.query("select 1 from public.calendar_events where id = $1", [aliceEvent])).rowCount,
    );
    expect(stillThere).toBe(1);
  });

  it("INSERT：B 傳入 A 的 user_id 會被資料庫拒絕（前端 user_id 不是安全依據）", async () => {
    for (const sql of [
      "insert into public.projects (user_id, name) values ($1, '偽造專案')",
      "insert into public.calendar_events (user_id, title, start_at) values ($1, '偽造事件', now())",
      "insert into public.deadline_rules (user_id, base_kind, offset_business_days, title) values ($1, 'site_visit', 1, '偽造')",
      "insert into public.holidays (user_id, date, kind) values ($1, '2026-12-25', 'holiday')",
      `insert into public.push_subscriptions (user_id, endpoint, p256dh, auth_secret)
         values ($1, 'https://push.example.com/forged', 'BPxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', 'authsecret')`,
    ]) {
      const msg = await expectSqlError(asUser(bob, (c) => c.query(sql, [alice])));
      expect(msg, sql).toMatch(RLS_DENIED);
    }
  });

  it("UPDATE：使用者不能把自己的資料轉移給別人（user_id 改為他人）", async () => {
    const bobProject = await asUser(bob, async (c) =>
      (await c.query<{ id: string }>("insert into public.projects (name) values ('B 專案') returning id")).rows[0]!.id,
    );
    const msg = await expectSqlError(
      asUser(bob, (c) => c.query("update public.projects set user_id = $1 where id = $2", [alice, bobProject])),
    );
    expect(msg).toMatch(RLS_DENIED);
  });

  it("未指定 user_id 時，資料庫自動以 auth.uid() 填入", async () => {
    const owner = await asUser(bob, async (c) =>
      (await c.query<{ user_id: string }>(
        "insert into public.calendar_events (title, start_at) values ('B 的工作', now()) returning user_id",
      )).rows[0]!.user_id,
    );
    expect(owner).toBe(bob);
  });

  it("B 不能把自己的事件掛到 A 的專案底下（複合外鍵阻擋跨帳號參照）", async () => {
    const msg = await expectSqlError(
      asUser(bob, (c) =>
        c.query("insert into public.calendar_events (title, start_at, project_id) values ('掛到別人專案', now(), $1)", [
          aliceProject,
        ]),
      ),
    );
    expect(msg).toMatch(/foreign key/);
  });

  it("B 不能建立以 A 的事件為來源的期限事件", async () => {
    const msg = await expectSqlError(
      asUser(bob, (c) =>
        c.query("insert into public.calendar_events (title, start_at, source_event_id) values ('偷接', now(), $1)", [
          aliceEvent,
        ]),
      ),
    );
    expect(msg).toMatch(/foreign key/);
  });
});

describe("未登入（anon）", () => {
  it("無法讀取或寫入任何資料表", async () => {
    for (const table of [
      "profiles",
      "projects",
      "calendar_events",
      "deadline_rules",
      "holidays",
      "holiday_years",
      "notification_preferences",
      "push_subscriptions",
      "notification_jobs",
      "notification_logs",
    ]) {
      const msg = await expectSqlError(asAnon((c) => c.query(`select * from public.${table}`)));
      expect(msg, table).toMatch(/permission denied/);
    }
    const msg = await expectSqlError(
      asAnon((c) => c.query("insert into public.calendar_events (title, start_at) values ('x', now())")),
    );
    expect(msg).toMatch(/permission denied/);
  });

  it("無法呼叫匯出與推播註冊函式", async () => {
    expect(await expectSqlError(asAnon((c) => c.query("select public.export_my_data()")))).toMatch(/permission denied/);
    expect(
      await expectSqlError(
        asAnon((c) =>
          c.query("select public.register_push_subscription('https://x.example/1', $1, 'abcdefgh')", ["p".repeat(30)]),
        ),
      ),
    ).toMatch(/permission denied/);
  });
});

describe("官方假日（共用唯讀）與個人特殊辦公日", () => {
  beforeAll(async () => {
    await asService(async (c) => {
      await c.query(
        "insert into public.holidays (user_id, date, kind, description) values (null, '2026-10-10', 'holiday', '國慶日')",
      );
      await c.query("insert into public.holiday_years (year, is_complete, source) values (2026, true, 'test')");
    });
  });

  it("所有登入使用者都可讀官方假日，但不能修改或刪除", async () => {
    const res = await asUser(bob, async (c) => ({
      read: (await c.query("select description from public.holidays where user_id is null")).rows,
      years: (await c.query("select year from public.holiday_years")).rowCount,
      update: (await c.query("update public.holidays set description = '改掉' where user_id is null")).rowCount,
      del: (await c.query("delete from public.holidays where user_id is null")).rowCount,
    }));
    expect(res).toEqual({ read: [{ description: "國慶日" }], years: 1, update: 0, del: 0 });

    expect(
      await expectSqlError(asUser(bob, (c) => c.query("insert into public.holidays (user_id, date, kind) values (null, '2026-12-31', 'holiday')"))),
    ).toMatch(RLS_DENIED);
    expect(
      await expectSqlError(asUser(bob, (c) => c.query("insert into public.holiday_years (year) values (2027)"))),
    ).toMatch(/permission denied/);
  });

  it("A 的特殊辦公日只有 A 看得到", async () => {
    await asUser(alice, (c) =>
      c.query("insert into public.holidays (date, kind, description) values ('2026-10-24', 'workday', 'A 公司補班')"),
    );
    const bobSees = await asUser(bob, async (c) =>
      (await c.query("select 1 from public.holidays where date = '2026-10-24'")).rowCount,
    );
    const aliceSees = await asUser(alice, async (c) =>
      (await c.query("select 1 from public.holidays where date = '2026-10-24'")).rowCount,
    );
    expect({ bobSees, aliceSees }).toEqual({ bobSees: 0, aliceSees: 1 });
  });
});

describe("系統管理的提醒資料表", () => {
  let aliceJob: string;
  beforeAll(async () => {
    aliceJob = await asService(async (c) => {
      const { rows } = await c.query<{ id: string }>(
        `insert into public.notification_jobs (user_id, event_id, offset_days, scheduled_for)
         values ($1, $2, 1, '2026-10-19 09:00+08') returning id`,
        [alice, aliceEvent],
      );
      await c.query("insert into public.notification_logs (user_id, job_id, success) values ($1, $2, true)", [
        alice,
        rows[0]!.id,
      ]);
      return rows[0]!.id;
    });
  });

  it("使用者只能讀自己的提醒工作與發送紀錄", async () => {
    const res = await asUser(bob, async (c) => ({
      jobs: (await c.query("select 1 from public.notification_jobs")).rowCount,
      logs: (await c.query("select 1 from public.notification_logs")).rowCount,
    }));
    expect(res).toEqual({ jobs: 0, logs: 0 });
    const own = await asUser(alice, async (c) => (await c.query("select 1 from public.notification_jobs")).rowCount);
    expect(own).toBe(1);
  });

  it("使用者（包含擁有者）不能新增、修改、刪除提醒工作或紀錄", async () => {
    const attempts = [
      () => asUser(alice, (c) => c.query("update public.notification_jobs set status = 'pending' where id = $1", [aliceJob])),
      () => asUser(alice, (c) => c.query("delete from public.notification_jobs where id = $1", [aliceJob])),
      () =>
        asUser(alice, (c) =>
          c.query(
            "insert into public.notification_jobs (user_id, event_id, offset_days, scheduled_for) values ($1, $2, 3, now())",
            [alice, aliceEvent],
          ),
        ),
      () => asUser(alice, (c) => c.query("insert into public.notification_logs (user_id, success) values ($1, true)", [alice])),
      () => asUser(alice, (c) => c.query("delete from public.notification_logs")),
    ];
    for (const attempt of attempts) expect(await expectSqlError(attempt())).toMatch(/permission denied/);
  });
});

describe("推播訂閱綁定使用者與裝置", () => {
  const endpoint = "https://fcm.googleapis.com/fcm/send/shared-device-1";
  const p256dh = "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM";

  it("透過 register_push_subscription 註冊後，只有本人看得到", async () => {
    await asUser(alice, (c) =>
      c.query("select public.register_push_subscription($1, $2, $3, 'A 的 iPhone')", [endpoint, p256dh, "authsecret01"]),
    );
    const res = await asUser(bob, async (c) => (await c.query("select 1 from public.push_subscriptions")).rowCount);
    expect(res).toBe(0);
  });

  it("同一台裝置換 B 登入時，訂閱轉移給 B，A 不再收到這台裝置的通知", async () => {
    await asUser(bob, (c) =>
      c.query("select public.register_push_subscription($1, $2, $3, 'B 借用')", [endpoint, p256dh, "authsecret02"]),
    );
    const owners = await asAdmin(async (c) =>
      (await c.query<{ user_id: string }>("select user_id from public.push_subscriptions where endpoint = $1", [endpoint]))
        .rows,
    );
    expect(owners).toEqual([{ user_id: bob }]);
  });

  it("B 無法刪除或讀取 A 其他裝置的訂閱", async () => {
    await asUser(alice, (c) =>
      c.query("select public.register_push_subscription($1, $2, $3, 'A 的電腦')", [
        "https://web.push.apple.com/alice-pc",
        p256dh,
        "authsecret03",
      ]),
    );
    const deleted = await asUser(bob, async (c) =>
      (await c.query("delete from public.push_subscriptions where endpoint = 'https://web.push.apple.com/alice-pc'")).rowCount,
    );
    expect(deleted).toBe(0);
  });
});

describe("匯出自己的資料", () => {
  it("export_my_data 只包含呼叫者自己的資料", async () => {
    const data = await asUser(alice, async (c) =>
      (await c.query<{ d: Record<string, unknown> }>("select public.export_my_data() as d")).rows[0]!.d,
    );
    const events = data.calendar_events as Array<{ user_id: string }>;
    const projects = data.projects as Array<{ user_id: string }>;
    expect(data.user_id).toBe(alice);
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((e) => e.user_id === alice)).toBe(true);
    expect(projects.every((p) => p.user_id === alice)).toBe(true);
    expect((data.deadline_rules as unknown[]).length).toBe(6);
    // 推播金鑰不匯出
    expect(JSON.stringify(data.push_subscriptions)).not.toMatch(/auth_secret|p256dh/);

    const bobData = await asUser(bob, async (c) =>
      (await c.query<{ d: Record<string, unknown> }>("select public.export_my_data() as d")).rows[0]!.d,
    );
    expect(JSON.stringify(bobData)).not.toContain("A 公司機密專案");
    expect(JSON.stringify(bobData)).not.toContain("機密備註");
  });
});

describe("其他所有權規則", () => {
  it("使用者可以還原自己的預設模板，但無法替別人建立", async () => {
    await asUser(bob, (c) => c.query("delete from public.deadline_rules"));
    await asUser(bob, (c) => c.query("select public.restore_default_deadline_rules()"));
    const n = await asUser(bob, async (c) => (await c.query("select 1 from public.deadline_rules")).rowCount);
    expect(n).toBe(6);
    expect(
      await expectSqlError(asUser(bob, (c) => c.query("select public.seed_default_deadline_rules($1)", [alice]))),
    ).toMatch(/permission denied/);
  });

  it("工作狀態改為完成時自動記錄完成時間", async () => {
    const row = await asUser(alice, async (c) =>
      (await c.query<{ completed_at: Date | null }>(
        "update public.calendar_events set status = 'done' where id = $1 returning completed_at",
        [aliceEvent],
      )).rows[0]!,
    );
    expect(row.completed_at).toBeInstanceOf(Date);
    const reopened = await asUser(alice, async (c) =>
      (await c.query<{ completed_at: Date | null }>(
        "update public.calendar_events set status = 'todo' where id = $1 returning completed_at",
        [aliceEvent],
      )).rows[0]!,
    );
    expect(reopened.completed_at).toBeNull();
  });
});
