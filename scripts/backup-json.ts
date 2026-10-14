/**
 * 匯出 JSON 備份至 backups/ 目錄（不含密碼雜湊與工作階段）。
 * 完整資料庫備份請使用 pg_dump（見 README）。
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/db";
import { exportBackup } from "../src/server/backup/backup-service";

async function main() {
  const data = await exportBackup(null);
  const dir = path.join(process.cwd(), "backups");
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(file, JSON.stringify(data, null, 2), { mode: 0o600 });
  console.log(`✓ 已匯出：${file}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
