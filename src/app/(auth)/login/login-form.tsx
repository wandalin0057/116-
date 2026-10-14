"use client";
import { Loader2 } from "lucide-react";
import { useActionState } from "react";
import { loginAction, type LoginState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(loginAction, {});
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input key={state.email ?? ""} id="email" name="email" type="email" autoComplete="username" defaultValue={state.email} required autoFocus={!state.email} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">密碼</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required autoFocus={!!state.email} />
      </div>
      {state.error && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        登入
      </Button>
    </form>
  );
}
