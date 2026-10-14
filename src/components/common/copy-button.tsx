"use client";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";

export function CopyButton({ text, label = "複製", ...props }: { text: string | (() => string); label?: string } & Omit<ButtonProps, "onClick">) {
  const [done, setDone] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      {...props}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(typeof text === "function" ? text() : text);
          setDone(true);
          toast.success("已複製到剪貼簿");
          setTimeout(() => setDone(false), 1500);
        } catch {
          toast.error("複製失敗，請手動選取文字");
        }
      }}
    >
      {done ? <Check /> : <Copy />}
      {label}
    </Button>
  );
}
