import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Alert, Button } from "@/components/ui";
import { requireSupabase } from "@/lib/supabase";

interface Profile {
  display_name: string | null;
  timezone: string;
}

/** 第一階段首頁：確認登入狀態與個人資料讀取（行事曆於第二階段加入） */
export function HomePage() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const flash = (location.state as { flash?: string } | null)?.flash;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ruleCount, setRuleCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const db = requireSupabase();
    // 不需要帶 user_id 條件：RLS 只會回傳自己的資料
    db.from("profiles")
      .select("display_name, timezone")
      .maybeSingle()
      .then(({ data, error: e }) => (e ? setError("無法讀取個人設定") : setProfile(data)));
    db.from("deadline_rules")
      .select("id", { count: "exact", head: true })
      .then(({ count }) => setRuleCount(count ?? 0));
  }, []);

  async function exportData() {
    setExporting(true);
    try {
      const { data, error: e } = await requireSupabase().rpc("export_my_data");
      if (e) throw e;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `我的行事曆資料-${new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" })}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("匯出失敗，請稍後再試");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <img src="/icon.svg" alt="" className="h-9 w-9" />
          <h1 className="text-lg font-semibold">工作期限行事曆</h1>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="secondary" onClick={() => void signOut()}>
            登出
          </Button>
        </div>
      </header>

      <div className="space-y-4">
        {flash && <Alert tone="success">{flash}</Alert>}
        {error && <Alert>{error}</Alert>}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-3 font-semibold">帳號資訊</h2>
          <dl className="grid grid-cols-[6rem_1fr] gap-y-2 text-sm">
            <dt className="text-slate-500 dark:text-slate-400">顯示名稱</dt>
            <dd>{profile?.display_name ?? "—"}</dd>
            <dt className="text-slate-500 dark:text-slate-400">Email</dt>
            <dd className="break-all">{user?.email}</dd>
            <dt className="text-slate-500 dark:text-slate-400">時區</dt>
            <dd>{profile?.timezone ?? "Asia/Taipei"}</dd>
            <dt className="text-slate-500 dark:text-slate-400">期限模板</dt>
            <dd>{ruleCount === null ? "—" : `${ruleCount} 條規則`}</dd>
          </dl>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-2 font-semibold">我的資料</h2>
          <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">下載您帳號內的所有資料（JSON 格式）。</p>
          <Button variant="secondary" onClick={() => void exportData()} loading={exporting}>
            匯出我的資料
          </Button>
        </section>
        <Alert tone="info">行事曆、工作管理與提醒功能將在後續階段加入。</Alert>
      </div>
    </div>
  );
}
