// Prisma 設定檔（取代 package.json 中的 "prisma" 設定）
// 使用設定檔時 Prisma 不會自動讀取 .env，因此在此載入；正式環境（Render）直接使用環境變數，.env 不存在亦不影響。
import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed.ts",
  },
});
