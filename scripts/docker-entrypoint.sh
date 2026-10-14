#!/bin/sh
# 網站啟動：先套用資料庫 migration（RUN_MIGRATIONS=false 可停用），再啟動 Next.js
set -e
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "套用資料庫 migration…"
  npx prisma migrate deploy
fi
if [ "${RUN_SEED:-true}" = "true" ]; then
  # 冪等：建立期限規則、預設範本、115 年辦公日曆；設定 INITIAL_ADMIN_* 時建立初始管理員
  npx tsx prisma/seed.ts
fi
exec node .next/standalone/server.js
