import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { renderDocx } from "@/server/documents/docx-export";
import { auditExport, getDocumentLayout } from "@/server/documents/document-export-service";
import { renderPdf } from "@/server/documents/pdf-export";
import { AppError } from "@/server/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "請先登入" }, { status: 401 });
  const { id } = await params;
  const format = req.nextUrl.searchParams.get("format") === "pdf" ? "pdf" : "docx";
  try {
    const { layout, fileBase } = await getDocumentLayout(user, id);
    const buffer = format === "pdf" ? await renderPdf(layout) : await renderDocx(layout);
    await auditExport(user, id, format);
    const filename = `${fileBase}.${format}`;
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="draft.${format}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof AppError) return NextResponse.json({ error: err.message }, { status: err.status });
    logger.error("公文匯出失敗", { err, id, format });
    return NextResponse.json({ error: "匯出失敗" }, { status: 500 });
  }
}
