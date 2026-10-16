"use client";
import { KeyRound, Loader2, Pencil, UserPlus } from "lucide-react";
import { useState } from "react";
import { applyDefaultPasswordAction, createUserAction, resetUserPasswordAction, setDefaultPasswordAction, updateUserAction } from "@/app/actions/settings";
import { ActionButton } from "@/components/common/action-button";
import { useAction } from "@/components/common/use-action";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Role = "ADMIN" | "USER";

export function CreateUserDialog({ hasDefault = false }: { hasDefault?: boolean }) {
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
            <Input
              id="u-pw"
              type="password"
              autoComplete="new-password"
              value={v.password}
              onChange={(e) => setV((s) => ({ ...s, password: e.target.value }))}
              required={!(hasDefault && v.role === "USER")}
              placeholder={hasDefault && v.role === "USER" ? "留空＝使用一般使用者初始密碼" : undefined}
            />
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

export function DefaultPasswordCard({ hasDefault, userCount }: { hasDefault: boolean; userCount: number }) {
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const { run, pending } = useAction();
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="default-pw">一般使用者初始密碼</Label>
          <Input
            id="default-pw"
            type={show ? "text" : "password"}
            autoComplete="new-password"
            className="w-64"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder={hasDefault ? "已設定（輸入新密碼可更換）" : "例如：至少 10 碼含英數"}
          />
        </div>
        <label className="flex h-9 items-center gap-1.5 text-sm">
          <input type="checkbox" className="h-4 w-4" checked={show} onChange={(e) => setShow(e.target.checked)} />
          顯示
        </label>
        <Button disabled={pending || !pw} onClick={() => void run(() => setDefaultPasswordAction(pw), { onSuccess: () => setPw("") })}>
          {pending && <Loader2 className="animate-spin" />}
          儲存初始密碼
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        新增一般使用者（含新增案件時自動建立的負責人帳號）會使用此密碼；同事用此密碼登入後，系統會提醒他變更。密碼只以加密形式保存。
      </p>
      <div className="flex flex-wrap items-center gap-2 border-t pt-3">
        <ActionButton
          variant="outline"
          disabled={!hasDefault || !userCount}
          action={() => applyDefaultPasswordAction()}
          confirm={{
            title: `將 ${userCount} 位一般使用者的密碼統一重設為初始密碼？`,
            description: "所有啟用中的一般使用者（不含管理員）密碼都會改成初始密碼，並需重新登入；他們之前自己設定的密碼將失效。",
            confirmLabel: "確認重設",
          }}
        >
          <KeyRound />
          將所有一般使用者密碼重設為初始密碼
        </ActionButton>
        {!hasDefault && <span className="text-xs text-amber-700">請先儲存初始密碼</span>}
      </div>
    </div>
  );
}
