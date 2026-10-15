import type { DocumentLayout } from "@/server/documents/document-layout";

/** 公文排版預覽（列印頁與編輯頁共用） */
export function DocumentPreview({ layout }: { layout: DocumentLayout }) {
  return (
    <div className="mx-auto max-w-[210mm] bg-white p-8 font-serif text-[15px] leading-relaxed text-black shadow-sm print:p-0 print:shadow-none" style={{ fontFamily: '"DFKai-SB","BiauKai","標楷體","Noto Serif TC",serif' }}>
      <p className="text-right text-xs text-red-700">草稿（{layout.statusLabel}）</p>
      <div className="ml-auto w-fit text-sm">
        {layout.fileFields.map((f) => (
          <p key={f.label}>
            {f.label}：{f.value}
          </p>
        ))}
      </div>
      <h2 className="my-4 text-center text-2xl font-bold tracking-widest">{layout.title}</h2>
      {layout.orgLines.length > 0 && (
        <div className="mb-4 ml-auto w-fit max-w-[60%] text-sm">
          {layout.orgLines.map((l) => (
            <p key={l.label}>
              {l.label}：{l.value}
            </p>
          ))}
        </div>
      )}
      <div className="space-y-0.5 text-sm">
        {layout.headerFields.map((f) => (
          <p key={f.label}>
            {f.label}：{f.value}
          </p>
        ))}
      </div>
      <div className="mt-5 flex text-lg">
        <span className="shrink-0">主旨：</span>
        <span>{layout.subject}</span>
      </div>
      <p className="mt-3 text-lg">說明：</p>
      <div className="space-y-1 pl-12 text-lg">
        {layout.bodyLines.map((l, i) => (
          <p key={i} className="flex">
            {l.marker && <span className="shrink-0">{l.marker}</span>}
            <span className="break-all">{l.text}</span>
          </p>
        ))}
      </div>
      <div className="mt-8 space-y-0.5 text-sm">
        <p>正本：{layout.primaryRecipients}</p>
        <p>副本：{layout.ccRecipients}</p>
      </div>
      <p className="mt-10 border-t pt-2 text-center text-xs text-slate-500">{layout.notice}</p>
    </div>
  );
}
