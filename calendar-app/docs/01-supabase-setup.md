# 一、Supabase 免費專案建立教學

> 本文件只使用 Supabase **Free 方案**。過程中若畫面要求輸入信用卡或升級 Pro，請停止並不要繼續。

## 1. 建立專案

1. 前往 <https://supabase.com>，用 GitHub 或 Email 註冊並登入。
2. 建立 Organization 時，Plan 選 **Free**。
3. 按「New project」：
   - **Name**：例如 `deadline-calendar`
   - **Database Password**：按「Generate a password」，**另外存到密碼管理工具**（之後用 CLI 套用 migration 會用到，Supabase 不會再顯示）
   - **Region**：選 **Northeast Asia (Tokyo)** 或 **Southeast Asia (Singapore)**，離臺灣最近
4. 等候約 1–2 分鐘專案建立完成。

## 2. 取得金鑰（哪些可以公開、哪些絕對不行）

到 **Project Settings → API Keys**（舊版介面為 Project Settings → API）：

| 名稱 | 放在哪裡 | 可公開？ |
| --- | --- | --- |
| Project URL（`https://xxxx.supabase.co`） | 前端 `VITE_SUPABASE_URL` | 可以 |
| **Publishable key**（`sb_publishable_...`）或舊版 **anon public** key | 前端 `VITE_SUPABASE_ANON_KEY` | 可以（資料由 RLS 保護） |
| **Secret key**（`sb_secret_...`）或舊版 **service_role** key | **只放** Cloudflare Worker 的 Secret（第五階段） | **絕對不行** |

- 前端若誤填 secret / service_role key，網站啟動時會直接拒絕並顯示錯誤（`src/lib/env.ts`）。
- 請勿把任何金鑰提交到 Git；`.env.local`、`.dev.vars` 已列在 `.gitignore`。

## 3. 套用資料庫 Migration

**這一步會修改您的雲端資料庫，請確認是新建立的專案再執行。**

### 方法 A：SQL Editor（最簡單，不需安裝任何程式）

1. 左側選單 **SQL Editor → New query**。
2. 依檔名順序，把 `supabase/migrations/` 內每個 `.sql` 檔的內容整份貼上並按 **Run**：
   1. `20261016000100_schema.sql`
   2. `20261016000200_rls.sql`
   3. `20261016000300_auth_functions.sql`
3. 每個檔案都應顯示 `Success. No rows returned`。

> 注意：**不要**執行 `supabase/tests/supabase-shim.sql`，那是本機測試用來模擬 Supabase 的檔案。

### 方法 B：Supabase CLI

```bash
cd calendar-app
npx supabase login                       # 開啟瀏覽器授權
npx supabase link --project-ref <專案 ref> # ref 是 Project URL 中 https://<ref>.supabase.co 的部分，會要求輸入資料庫密碼
npx supabase db push                     # 套用 supabase/migrations 下尚未套用的檔案
```

### 套用後檢查

在 SQL Editor 執行：

```sql
select relname, relrowsecurity from pg_class
where relnamespace = 'public'::regnamespace and relkind = 'r' order by 1;
```

所有資料表的 `relrowsecurity` 都必須是 `true`。也可以到 **Advisors → Security Advisor** 確認沒有 RLS 相關警告。

## 4. 設定登入（Authentication）

到 **Authentication → Sign In / Providers**：

- **Email** provider：啟用。
- **Confirm email**：建議啟用（使用者需點擊確認信才能登入）。

到 **Authentication → URL Configuration**：

- **Site URL**：正式網址，例如 `https://deadline-calendar.pages.dev`（第六階段部署後再改；開發期間可先填 `http://localhost:5173`）
- **Redirect URLs** 加入：
  - `http://localhost:5173/**`
  - `https://<您的 Pages 專案>.pages.dev/**`
  - 若有自訂網域，也加入 `https://<自訂網域>/**`

密碼重設信會導回 `<網站>/reset-password`，必須在上述清單內才會生效。

### 寄信限制（重要）

Supabase 內建的寄信服務**只供測試使用**：寄送數量有很低的上限，而且只會寄給專案團隊成員的 Email。
要讓**外部客戶**收到註冊確認信與密碼重設信，必須在 **Authentication → Emails → SMTP Settings** 設定自訂 SMTP（例如 Resend、Brevo 都有免費額度）。

> 設定自訂 SMTP 需要另外註冊寄信服務並驗證網域，屬於外部服務設定，**請先與我確認再進行**。
> 開發與自己測試期間可以先用內建寄信，或暫時關閉 Confirm email。

## 5. 本機開發設定

```bash
cd calendar-app
cp .env.example .env.local
# 編輯 .env.local，填入步驟 2 的 Project URL 與 Publishable key
npm install
npm run dev        # http://localhost:5173
```

## 6. 免費方案限制（第一階段相關）

| 項目 | Free 方案限制（以 Supabase 官網最新公告為準） |
| --- | --- |
| 專案數 | 每個帳號最多 2 個啟用中的免費專案 |
| 資料庫容量 | 500 MB |
| 每月活躍使用者 | 50,000 MAU |
| 閒置暫停 | 約 7 天沒有任何資料庫活動會被暫停，需到 Dashboard 手動恢復。第五階段的 Cloudflare Cron 會定期查詢資料庫，可避免閒置 |
| 備份 | 免費方案沒有自動備份可下載，請定期使用網站的「匯出我的資料」或 `pg_dump` |
