import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { AuthLayout } from "@/components/AuthLayout";
import { Alert, Button, Field, FullPageSpinner } from "@/components/ui";
import { translateAuthError } from "@/lib/auth-errors";
import { PASSWORD_MIN_LENGTH, validatePassword, validatePasswordConfirm } from "@/lib/validation";

/** 使用者點擊重設密碼信的連結後到達此頁（Supabase 會自動以連結建立暫時登入狀態） */
export function ResetPasswordPage() {
  const { session, loading, updatePassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (loading) return <FullPageSpinner />;

  if (!session) {
    return (
      <AuthLayout title="連結已失效">
        <div className="space-y-4">
          <Alert>重設密碼連結已過期或已使用過，請重新申請。</Alert>
          <Link to="/forgot-password" className="block text-center text-sm text-blue-700 hover:underline dark:text-blue-400">
            重新申請重設密碼
          </Link>
        </div>
      </AuthLayout>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const err = validatePassword(password) ?? validatePasswordConfirm(password, confirm);
    if (err) {
      setError(err);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await updatePassword(password);
      navigate("/", { replace: true, state: { flash: "密碼已更新" } });
    } catch (e2) {
      setError(translateAuthError(e2));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout title="設定新密碼">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && <Alert>{error}</Alert>}
        <Field id="password" label="新密碼" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} hint={`至少 ${PASSWORD_MIN_LENGTH} 碼，需包含英文字母與數字`} />
        <Field id="confirm" label="確認新密碼" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        <Button type="submit" className="w-full" loading={submitting}>
          更新密碼
        </Button>
      </form>
    </AuthLayout>
  );
}
