"use client";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { deleteDocumentAction } from "@/app/actions/documents";
import { ActionButton } from "@/components/common/action-button";

export function DeleteDocumentButton({
  id,
  schoolName,
  dispatched,
  redirectTo,
  size = "xs",
}: {
  id: string;
  schoolName: string;
  dispatched: boolean;
  redirectTo?: string;
  size?: "xs" | "sm";
}) {
  const router = useRouter();
  return (
    <ActionButton
      size={size}
      variant="ghost"
      className="text-red-700 hover:bg-red-50 hover:text-red-800"
      action={() => deleteDocumentAction(id)}
      onDone={() => redirectTo && router.push(redirectTo)}
      confirm={{
        title: `確定刪除「${schoolName}」這份公文？`,
        description: dispatched
          ? "這份公文已標記發文，屬正式紀錄。刪除後無法復原（操作紀錄會保留主旨與發文字號）。若只是不再使用，建議保留。"
          : "刪除後無法復原。若只想停用而保留紀錄，請改用「作廢」。對應工作的完成狀態不會改變。",
        confirmLabel: "永久刪除",
        destructive: true,
      }}
    >
      <Trash2 />
      刪除
    </ActionButton>
  );
}
