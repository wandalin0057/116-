import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { AuthLayout } from "@/components/AuthLayout";
import { Alert, Button, Field } from "@/components/ui";
import { translateAuthError } from "@/lib/auth-errors";
import { PASSWORD_MIN_LENGTH, validateEmail, validatePassword, validatePasswordConfirm } from "@/lib/validation";

export function RegisterPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ displayName: "", email: "", password: "", confirm: "" });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({});
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const errs = {
      displayName: form.displayName.trim() ? null : "請輸入顯示名稱",
      email: validateEmail(form.email),
      password: validatePassword(form.password),
      confirm: validatePasswordConfirm(form.password, form.confirm),
    };
    setFieldErrors(errs);
    if (Object.values(errs).some(Boolean)) return;
    setSubmitting(true);
    setError(null);
    try {
      const { needsEmailConfirmation } = await signUp(form.email, form.password, form.displayName);
      if (needsEmailConfirmation) setDone(true);
      else navigate("/", { replace: true });
    } catch (err) {
      setError(translateAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <AuthLayout title="請確認您的 Email">
        <div className="space-y-4">
          <Alert tone="success">
            我們已寄出確認信到 <strong>{form.email.trim()}</strong>，請點擊信中的連結完成註冊。若沒有收到，請檢查垃圾郵件匣。
          </Alert>
          <Link to="/login" className="block text-center text-sm text-blue-700 hover:underline dark:text-blue-400">
            回到登入
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="註冊新帳號" subtitle="每個帳號的資料與提醒設定完全獨立，其他使用者無法查看。">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && <Alert>{error}</Alert>}
        <Field id="displayName" label="顯示名稱" autoComplete="name" maxLength={100} value={form.displayName} onChange={set("displayName")} error={fieldErrors.displayName} />
        <Field id="email" label="Email" type="email" autoComplete="email" inputMode="email" value={form.email} onChange={set("email")} error={fieldErrors.email} />
        <Field
          id="password"
          label="密碼"
          type="password"
          autoComplete="new-password"
          value={form.password}
          onChange={set("password")}
          error={fieldErrors.password}
          hint={`至少 ${PASSWORD_MIN_LENGTH} 碼，需包含英文字母與數字`}
        />
        <Field id="confirm" label="確認密碼" type="password" autoComplete="new-password" value={form.confirm} onChange={set("confirm")} error={fieldErrors.confirm} />
        <Button type="submit" className="w-full" loading={submitting}>
          註冊
        </Button>
        <p className="text-center text-sm">
          已有帳號？
          <Link to="/login" className="text-blue-700 hover:underline dark:text-blue-400">
            登入
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
