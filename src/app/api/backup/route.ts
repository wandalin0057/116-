import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isAdmin } from "@/server/auth/types";
import { exportBackup } from "@/server/backup/backup-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "請先登入" }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: "僅限管理員" }, { status: 403 });
  const data = await exportBackup(user);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="school-zone-backup-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
