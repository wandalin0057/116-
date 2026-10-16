#!/usr/bin/env bash
# 本機測試用 PostgreSQL（模擬 Supabase 的 auth schema 與角色），用於直接驗證 RLS。
# 用法：bash scripts/local-db.sh up | down | reset
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${LOCAL_DB_PORT:-54329}"
DATA_DIR="$(pwd)/.tmp/pgdata"
SOCK_DIR="$(pwd)/.tmp/pgsock"
DB=calendar_test
PG_BIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1 || true)"
[ -n "$PG_BIN" ] || PG_BIN="$(dirname "$(command -v pg_ctl)")"

as_pg() {
  if [ "$(id -u)" = "0" ]; then su postgres -s /bin/bash -c "$*"; else bash -c "$*"; fi
}

up() {
  mkdir -p "$DATA_DIR" "$SOCK_DIR"
  [ "$(id -u)" = "0" ] && chown -R postgres "$(pwd)/.tmp"
  if [ ! -f "$DATA_DIR/PG_VERSION" ]; then
    as_pg "'$PG_BIN/initdb' -D '$DATA_DIR' -U postgres --auth=trust -E UTF8 --locale=C.UTF-8 >/dev/null"
  fi
  if ! as_pg "'$PG_BIN/pg_ctl' -D '$DATA_DIR' status >/dev/null 2>&1"; then
    as_pg "'$PG_BIN/pg_ctl' -D '$DATA_DIR' -l '$DATA_DIR/server.log' -o \"-p $PORT -k $SOCK_DIR -c listen_addresses=localhost\" -w start >/dev/null"
  fi
  psql -h localhost -p "$PORT" -U postgres -tAc "select 1 from pg_database where datname='$DB'" | grep -q 1 \
    || psql -h localhost -p "$PORT" -U postgres -c "create database $DB" >/dev/null
  echo "本機資料庫已啟動：postgresql://postgres@localhost:$PORT/$DB"
}

down() {
  as_pg "'$PG_BIN/pg_ctl' -D '$DATA_DIR' stop -m fast" || true
}

case "${1:-up}" in
  up) up ;;
  down) down ;;
  reset) down; rm -rf "$(pwd)/.tmp"; up ;;
  *) echo "用法：$0 up|down|reset"; exit 1 ;;
esac
