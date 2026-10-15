import { Archive, Bell, Building2, CalendarCog, FileStack, History, KeyRound, RefreshCw, Scale, Users } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/common/page-header";
import { requireUser } from "@/lib/auth";
import { isAdmin } from "@/server/auth/types";

export const metadata = { title: "系統設定" };

const ITEMS = [
  { href: "/settings/account", label: "個人帳號", desc: "Email 簽名檔、變更登入密碼", icon: KeyRound, admin: false },
  { href: "/settings/notifications", label: "通知設定", desc: "每日提醒、提前天數、逾期通知；管理員可設定 Email 測試模式", icon: Bell, admin: false },
  { href: "/settings/organization", label: "發文單位資訊", desc: "公文抬頭的公司名稱、地址、聯絡人、電話、傳真、電子郵件", icon: Building2, admin: true },
  { href: "/settings/users", label: "使用者管理", desc: "新增、停用使用者與重設密碼", icon: Users, admin: true },
  { href: "/settings/calendar", label: "工作天設定", desc: "官方辦公日曆匯入、休假日／補行上班日調整", icon: CalendarCog, admin: true },
  { href: "/settings/recalculate", label: "期限重新計算", desc: "日曆或規則更新後，預覽差異並套用", icon: RefreshCw, admin: true },
  { href: "/settings/rules", label: "期限規則管理", desc: "調整各工作之工作天位移", icon: Scale, admin: true },
  { href: "/settings/templates", label: "公文與 Email 範本", desc: "編輯範本、版本管理與回復", icon: FileStack, admin: true },
  { href: "/settings/backup", label: "資料備份", desc: "匯出 JSON 備份與資料庫備份說明", icon: Archive, admin: true },
  { href: "/settings/audit", label: "操作紀錄", desc: "查詢所有使用者之操作紀錄", icon: History, admin: true },
];

export default async function SettingsPage() {
  const user = await requireUser();
  const admin = isAdmin(user);
  return (
    <>
      <PageHeader title="系統設定" description={admin ? "管理員可調整系統規則與資料；一般使用者可調整個人設定。" : "個人設定"} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ITEMS.filter((i) => admin || !i.admin).map(({ href, label, desc, icon: Icon, admin: adm }) => (
          <Link key={href} href={href} className="flex gap-3 rounded-lg border bg-white p-4 shadow-sm transition-colors hover:border-primary/40">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent text-primary">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-slate-900">
                {label}
                {adm && <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-normal text-slate-600">管理員</span>}
              </p>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
