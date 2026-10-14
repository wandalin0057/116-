"use client";
import * as React from "react";
import * as AlertPrimitive from "@radix-ui/react-alert-dialog";
import { cn } from "@/lib/utils";
import { buttonVariants } from "./button";

export const AlertDialog = AlertPrimitive.Root;
export const AlertDialogTrigger = AlertPrimitive.Trigger;

export function AlertDialogContent({ className, children, ...props }: React.ComponentPropsWithoutRef<typeof AlertPrimitive.Content>) {
  return (
    <AlertPrimitive.Portal>
      <AlertPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-900/50" />
      <AlertPrimitive.Content
        className={cn("fixed left-1/2 top-1/2 z-50 grid w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border bg-white p-5 shadow-lg", className)}
        {...props}
      >
        {children}
      </AlertPrimitive.Content>
    </AlertPrimitive.Portal>
  );
}
export const AlertDialogTitle = ({ className, ...p }: React.ComponentPropsWithoutRef<typeof AlertPrimitive.Title>) => (
  <AlertPrimitive.Title className={cn("text-lg font-semibold", className)} {...p} />
);
export const AlertDialogDescription = ({ className, ...p }: React.ComponentPropsWithoutRef<typeof AlertPrimitive.Description>) => (
  <AlertPrimitive.Description className={cn("text-sm text-muted-foreground", className)} {...p} />
);
export const AlertDialogFooter = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...p} />
);
export const AlertDialogCancel = ({ className, ...p }: React.ComponentPropsWithoutRef<typeof AlertPrimitive.Cancel>) => (
  <AlertPrimitive.Cancel className={cn(buttonVariants({ variant: "outline" }), className)} {...p} />
);
export const AlertDialogAction = AlertPrimitive.Action;
