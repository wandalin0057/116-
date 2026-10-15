#!/bin/sh
# 網站啟動：套用資料庫 migration → 初始化資料 → 啟動 Next.js
# 初始化失敗（例如初始管理員密碼不符規則）不會阻止網站啟動，登入頁會顯示提示。
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "套用資料庫 migration…"
  if ! npx prisma migrate deploy; then
    echo "✗ 資料庫 migration 失敗：請確認 DATABASE_URL 是否正確（Neon 連線字串、需含 sslmode=require）"
    exit 1
  fi
fi
if [ "${RUN_SEED:-true}" = "true" ]; then
  # 冪等：建立期限規則、預設範本、115 年辦公日曆；設定 INITIAL_ADMIN_* 時建立初始管理員
  npx tsx prisma/seed.ts || echo "! 初始化資料未完全成功（見上方訊息），網站仍會啟動"
fi
echo "啟動網站…"
# 部分雲端平台會以容器名稱覆寫 HOSTNAME，這裡固定監聽所有網路介面
export HOSTNAME=0.0.0.0
exec node .next/standalone/server.js
