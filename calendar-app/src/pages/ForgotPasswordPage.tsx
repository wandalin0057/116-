import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { AuthLayout } from "@/components/AuthLayout";
import { Alert, Button, Field } from "@/components/ui";
import { translateAuthError } from "@/lib/auth-errors";
import { validateEmail } from "@/lib/validation";

export function ForgotPasswordPage() {
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const emailError = validateEmail(email);
    if (emailError) {
      setError(emailError);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await sendPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(translateAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout title="重設密碼" subtitle="輸入註冊時的 Email，我們會寄送重設密碼連結。">
      {sent ? (
        <div className="space-y-4">
          {/* 不透露該 Email 是否已註冊 */}
          <Alert tone="success">若此 Email 已註冊，您將在幾分鐘內收到重設密碼信。連結僅能使用一次。</Alert>
          <Link to="/login" className="block text-center text-sm text-blue-700 hover:underline dark:text-blue-400">
            回到登入
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {error && <Alert>{error}</Alert>}
          <Field id="email" label="Email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button type="submit" className="w-full" loading={submitting}>
            寄送重設連結
          </Button>
          <Link to="/login" className="block text-center text-sm text-blue-700 hover:underline dark:text-blue-400">
            回到登入
          </Link>
        </form>
      )}
    </AuthLayout>
  );
}
