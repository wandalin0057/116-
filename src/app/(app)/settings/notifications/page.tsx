import { PageHeader } from "@/components/common/page-header";
import { EmailSettingsForm, ReminderPreferenceForm } from "@/components/settings/account-forms";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { isAdmin } from "@/server/auth/types";
import { getEmailSettings } from "@/server/settings/settings-service";
import { getReminderPreference } from "@/server/users/user-service";

export const metadata = { title: "通知設定" };

export default async function NotificationSettingsPage() {
  const user = await requireUser();
  const [pref, email] = await Promise.all([getReminderPreference(user.id), isAdmin(user) ? getEmailSettings() : null]);
  return (
    <>
      <PageHeader title="通知設定" />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>我的提醒設定</CardTitle>
          </CardHeader>
          <CardContent>
            <ReminderPreferenceForm
              initial={{ emailEnabled: pref.emailEnabled, leadBusinessDays: pref.leadBusinessDays, overdueEnabled: pref.overdueEnabled, dailyDigestEnabled: pref.dailyDigestEnabled }}
            />
          </CardContent>
        </Card>
        {email && (
          <Card>
            <CardHeader>
              <CardTitle>Email 寄送設定（管理員）</CardTitle>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline">寄送服務：{email.provider === "console" ? "Console（僅記錄、不實際寄送）" : email.provider.toUpperCase()}</Badge>
                <Badge variant={email.providerConfigured ? "success" : "danger"}>{email.providerConfigured ? "金鑰已設定" : "金鑰未設定"}</Badge>
                <Badge variant="outline">寄件者：{email.from || "—"}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">寄送服務與 API 金鑰僅能於伺服器環境變數設定，不會顯示於前端。</p>
            </CardHeader>
            <CardContent>
              <EmailSettingsForm initial={{ testMode: email.testMode, testRecipient: email.testRecipient ?? "", skipNonBusinessDays: email.skipNonBusinessDays }} />
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
