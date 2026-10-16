export function ConfigMissingPage({ errors }: { errors: string[] }) {
  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <h1 className="mb-3 text-xl font-semibold">系統尚未完成設定</h1>
      <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
        請在 <code>.env.local</code>（本機）或 Cloudflare Pages 的環境變數中設定以下項目，詳見 <code>docs/01-supabase-setup.md</code>。
      </p>
      <ul className="list-disc space-y-1 pl-5 text-sm text-red-700 dark:text-red-300">
        {errors.map((e) => (
          <li key={e}>{e}</li>
        ))}
      </ul>
    </div>
  );
}
