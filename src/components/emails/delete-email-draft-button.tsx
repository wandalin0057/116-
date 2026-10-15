"use client";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { deleteEmailDraftAction } from "@/app/actions/emails";
import { ActionButton } from "@/components/common/action-button";

export function DeleteEmailDraftButton({
  id,
  schoolName,
  sent,
  redirectTo,
  size = "xs",
}: {
  id: string;
  schoolName: string;
  sent: boolean;
  redirectTo?: string;
  size?: "xs" | "sm";
}) {
  const router = useRouter();
  return (
    <ActionButton
      size={size}
      variant="ghost"
      className="text-red-700 hover:bg-red-50 hover:text-red-800"
      action={() => deleteEmailDraftAction(id)}
      onDone={() => redirectTo && router.push(redirectTo)}
      confirm={{
        title: `確定刪除「${schoolName}」這份 Email 草稿？`,
        description: sent
          ? "這份 Email 已確認寄出。刪除後無法復原（操作紀錄會保留主旨與收件人），對應工作仍維持已完成。"
          : "刪除後無法復原。若只想停用而保留紀錄，請改用「作廢」。",
        confirmLabel: "永久刪除",
        destructive: true,
      }}
    >
      <Trash2 />
      刪除
    </ActionButton>
  );
}
