import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { AuthLayout } from "@/components/AuthLayout";
import { Alert, Button, Field } from "@/components/ui";
import { translateAuthError } from "@/lib/auth-errors";
import { validateEmail } from "@/lib/validation";

export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const emailError = validateEmail(email);
    if (emailError || !password) {
      setError(emailError ?? "請輸入密碼");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await signIn(email, password);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from !== "/login" ? from : "/", { replace: true });
    } catch (err) {
      setError(translateAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout title="登入">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && <Alert>{error}</Alert>}
        <Field id="email" label="Email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Field id="password" label="密碼" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <Button type="submit" className="w-full" loading={submitting}>
          登入
        </Button>
        <div className="flex justify-between text-sm">
          <Link to="/forgot-password" className="text-blue-700 hover:underline dark:text-blue-400">
            忘記密碼
          </Link>
          <Link to="/register" className="text-blue-700 hover:underline dark:text-blue-400">
            註冊新帳號
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
}
