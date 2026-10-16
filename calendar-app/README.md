# 工作期限行事曆（多使用者 SaaS）

個人專案行事曆暨工作期限提醒系統。所有客戶共用同一個網站，但每個帳號的資料、期限模板、提醒設定完全獨立，由資料庫 Row Level Security 強制隔離。

- 前端：React + TypeScript + Vite + Tailwind CSS（Cloudflare Pages）
- 後端：Supabase Auth + PostgreSQL + RLS；Cloudflare Workers + Cron Triggers（提醒）
- PWA + Service Worker + Web Push（VAPID）
- 測試：Vitest（單元測試＋直接連線 PostgreSQL 的 RLS 測試）
- 介面：繁體中文；時區 Asia/Taipei

> 與 repository 根目錄的舊專案（Next.js「通學區案件期程暨發文管理系統」）互相獨立，未修改舊專案。
> 舊專案的臺灣工作天計算（`BusinessDayService`）、官方辦公日曆匯入解析與 2026 年假日資料將於第三階段移植沿用。

## 開發進度

| 階段 | 內容 | 狀態 |
| --- | --- | --- |
| 1 | 資料庫設計、帳號登入、RLS | ✅ 完成 |
| 2 | 行事曆及工作管理 | 未開始 |
| 3 | 臺灣工作天計算及自動期限 | 未開始 |
| 4 | PWA 及跨裝置同步 | 未開始 |
| 5 | Web Push 與雲端排程 | 未開始 |
| 6 | 部署、實機測試及文件 | 未開始 |

## 檔案架構

```
calendar-app/
├─ index.html                     進入點（含深色模式防閃爍）
├─ public/                        靜態檔：icon、_redirects（SPA 路由）；第四階段加入 manifest、sw
├─ src/
│  ├─ main.tsx / App.tsx          路由
│  ├─ auth/                       AuthProvider（Supabase Auth）、RequireAuth / GuestOnly
│  ├─ pages/                      登入、註冊、忘記密碼、重設密碼、首頁
│  ├─ components/                 共用 UI、主題切換
│  └─ lib/
│     ├─ env.ts                   前端環境變數驗證（拒絕 service_role / secret key）
│     ├─ supabase.ts              瀏覽器端 Supabase client（只用公開金鑰）
│     ├─ auth-errors.ts           錯誤訊息中文化
│     ├─ validation.ts            表單驗證
│     └─ theme.tsx                淺色／深色／跟隨系統
├─ supabase/
│  ├─ migrations/                 依序套用到 Supabase 的 SQL
│  │  ├─ …000100_schema.sql       9 張資料表、列舉、索引、複合外鍵
│  │  ├─ …000200_rls.sql          RLS 政策與 GRANT
│  │  └─ …000300_auth_functions.sql 註冊後建立個人設定、推播訂閱註冊、資料匯出
│  └─ tests/supabase-shim.sql     僅測試用：在一般 PostgreSQL 模擬 Supabase 的 auth schema 與角色
├─ tests/
│  ├─ unit/                       純函式測試
│  └─ rls/                        直接連資料庫驗證 RLS（以 authenticated / anon / service_role 角色執行）
├─ scripts/local-db.sh            啟動本機測試用 PostgreSQL
├─ docs/                          部署與使用文件
└─ (第五階段) workers/notifier/   Cloudflare Worker：Cron 定時發送 Web Push
```

## 指令

```bash
npm install
npm run dev            # 本機開發 http://localhost:5173（需先設定 .env.local）
npm run typecheck      # TypeScript 檢查
npm test               # 單元測試
npm run build          # 正式建置到 dist/

# RLS 測試：需要 PostgreSQL（本機或 CI）
npm run db:local:up    # 在 .tmp/ 啟動本機 PostgreSQL（port 54329）
TEST_DATABASE_URL=postgresql://postgres@localhost:54329/calendar_test npm run test:rls
```

RLS 測試每次都會**清空並重建** `TEST_DATABASE_URL` 指向的資料庫，請勿指向 Supabase 正式資料庫。

## 安全設計（第一階段）

1. **每張客戶資料表都有 `user_id`**，預設值為 `auth.uid()`。
2. **所有資料表啟用 RLS**，客戶資料表皆明確定義 SELECT / INSERT / UPDATE / DELETE 四種政策，一律以 `auth.uid()` 比對。
3. **前端傳入的 user_id 不是安全依據**：`WITH CHECK (user_id = auth.uid())` 讓偽造他人 user_id 的寫入直接被資料庫拒絕。
4. **跨帳號參照防護**：事件→專案、期限事件→來源事件、提醒工作→事件，全部使用 `(id, user_id)` 複合外鍵。外鍵檢查不受 RLS 限制，若只用單欄外鍵，猜到他人 UUID 就能建立參照。
5. **anon 沒有任何資料表權限**；系統管理的表（`notification_jobs`、`notification_logs`、`holiday_years`）一般使用者只能讀自己的資料，寫入只能由後端 service_role 進行。
6. **沒有「管理員看全部」的政策**：任何客戶端（包括系統管理者自己登入的帳號）都無法讀取其他客戶的行程。
7. **SECURITY DEFINER 函式**一律固定 `search_path = ''`、只使用 `auth.uid()`、收回 PUBLIC 執行權。
8. **推播訂閱綁定使用者＋裝置**：同一個瀏覽器 endpoint 全系統唯一；換人登入時訂閱轉移給新使用者，前一位不會再收到。
9. **伺服器金鑰**（service_role、VAPID 私鑰）只存在 Cloudflare Worker Secret；前端偵測到 secret key 會拒絕啟動。

### RLS 權限矩陣（authenticated 角色）

| 資料表 | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| profiles / projects / calendar_events / deadline_rules / notification_preferences / push_subscriptions | 自己的 | 自己的 | 自己的 | 自己的 |
| holidays | 官方（user_id 為 null）＋自己的 | 自己的 | 自己的 | 自己的 |
| holiday_years | 全部（公開參考資料） | 拒絕 | 拒絕 | 拒絕 |
| notification_jobs / notification_logs | 自己的 | 拒絕 | 拒絕 | 拒絕 |

anon（未登入）：所有資料表皆無權限。

### RLS 測試涵蓋（`tests/rls/`）

- 結構檢查：所有表都啟用 RLS、四種政策齊全、政策只給 authenticated、以 auth.uid() 驗證、anon 無權限、SECURITY DEFINER 函式安全設定
- 兩個帳號資料完全隔離：SELECT / UPDATE / DELETE 他人資料影響 0 筆；偽造 user_id 的 INSERT 被拒；不能把資料轉給他人
- 複合外鍵阻擋跨帳號參照專案與來源事件
- 官方假日共用唯讀；個人特殊辦公日互不可見
- 提醒工作與紀錄：只能讀自己的，連擁有者也不能修改
- 推播訂閱：本人可見、換人登入時轉移
- 資料匯出只包含自己的資料、不含推播金鑰
- 註冊時自動建立個人設定與 6 條預設期限模板
