"use client";
import { KeyRound, Loader2, Pencil, UserPlus } from "lucide-react";
import { useState } from "react";
import { createUserAction, resetUserPasswordAction, updateUserAction } from "@/app/actions/settings";
import { useAction } from "@/components/common/use-action";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Role = "ADMIN" | "USER";

export function CreateUserDialog() {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ email: "", name: "", role: "USER" as Role, password: "" });
  const { run, pending } = useAction();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus />
          新增使用者
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新增使用者</DialogTitle>
          <DialogDescription>請將初始密碼以安全管道告知使用者，並提醒登入後變更。</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void run(() => createUserAction(v), {
              onSuccess: () => {
                setOpen(false);
                setV({ email: "", name: "", role: "USER", password: "" });
              },
            });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="u-email">Email</Label>
            <Input id="u-email" type="email" value={v.email} onChange={(e) => setV((s) => ({ ...s, email: e.target.value }))} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="u-name">姓名</Label>
            <Input id="u-name" value={v.name} onChange={(e) => setV((s) => ({ ...s, name: e.target.value }))} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="u-role">角色</Label>
            <Select id="u-role" value={v.role} onChange={(e) => setV((s) => ({ ...s, role: e.target.value as Role }))}>
              <option value="USER">一般使用者</option>
              <option value="ADMIN">管理員</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="u-pw">初始密碼</Label>
            <Input id="u-pw" type="password" autoComplete="new-password" value={v.password} onChange={(e) => setV((s) => ({ ...s, password: e.target.value }))} required />
            <p className="text-xs text-muted-foreground">至少 10 碼，需含英文字母與數字。</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              建立
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EditUserDialog({ user }: { user: { id: string; name: string; role: Role; isActive: boolean; email: string } }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ name: user.name, role: user.role, isActive: user.isActive });
  const [pw, setPw] = useState("");
  const { run, pending } = useAction();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="xs">
          <Pencil />
          編輯
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>編輯使用者</DialogTitle>
          <DialogDescription>{user.email}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor={`n-${user.id}`}>姓名</Label>
            <Input id={`n-${user.id}`} value={v.name} onChange={(e) => setV((s) => ({ ...s, name: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`r-${user.id}`}>角色</Label>
            <Select id={`r-${user.id}`} value={v.role} onChange={(e) => setV((s) => ({ ...s, role: e.target.value as Role }))}>
              <option value="USER">一般使用者</option>
              <option value="ADMIN">管理員</option>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4" checked={v.isActive} onChange={(e) => setV((s) => ({ ...s, isActive: e.target.checked }))} />
            啟用帳號（停用後立即登出且無法登入，資料保留）
          </label>
          <Button disabled={pending} onClick={() => run(() => updateUserAction(user.id, v), { onSuccess: () => setOpen(false) })}>
            {pending && <Loader2 className="animate-spin" />}
            儲存
          </Button>
          <div className="space-y-1.5 border-t pt-3">
            <Label htmlFor={`p-${user.id}`}>重設密碼</Label>
            <div className="flex gap-2">
              <Input id={`p-${user.id}`} type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="新密碼" />
              <Button variant="outline" disabled={pending || !pw} onClick={() => run(() => resetUserPasswordAction(user.id, pw), { onSuccess: () => setPw("") })}>
                <KeyRound />
                重設
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
