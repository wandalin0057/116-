import { notFound } from "next/navigation";
import { DocumentPreview } from "@/components/documents/document-preview";
import { PrintButton } from "@/components/documents/print-button";
import { requireUser } from "@/lib/auth";
import { getDocumentLayout } from "@/server/documents/document-export-service";
import { AppError } from "@/server/errors";

export const metadata = { title: "列印公文草稿" };

export default async function PrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const { layout } = await getDocumentLayout(user, id).catch((e) => {
    if (e instanceof AppError) notFound();
    throw e;
  });
  return (
    <>
      <div className="no-print mx-auto mb-4 flex max-w-[210mm] items-center justify-between px-4">
        <p className="text-sm text-slate-600">可使用瀏覽器「列印 → 另存為 PDF」輸出草稿。</p>
        <PrintButton />
      </div>
      <DocumentPreview layout={layout} />
    </>
  );
}
