// next build（output: standalone）後，將靜態資源複製到 standalone 目錄，供 `npm start` 與 Docker 使用
import { cpSync, existsSync } from "node:fs";

if (existsSync(".next/standalone")) {
  cpSync(".next/static", ".next/standalone/.next/static", { recursive: true });
  if (existsSync("public")) cpSync("public", ".next/standalone/public", { recursive: true });
  cpSync("data", ".next/standalone/data", { recursive: true });
  console.log("✓ 已複製靜態資源至 .next/standalone");
}
