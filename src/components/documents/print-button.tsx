"use client";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintButton() {
  return (
    <Button onClick={() => window.print()}>
      <Printer />
      列印／另存 PDF
    </Button>
  );
}
