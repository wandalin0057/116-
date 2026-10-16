import type { Session, User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { siteUrl, supabase } from "@/lib/supabase";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  /** 使用者是從密碼重設連結進來的 */
  passwordRecovery: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ needsEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function client() {
  if (!supabase) throw new Error("Supabase 尚未設定");
  return supabase;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
      if (event === "SIGNED_OUT") setPasswordRecovery(false);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      passwordRecovery,
      async signIn(email, password) {
        const { error } = await client().auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      },
      async signUp(email, password, displayName) {
        const { data, error } = await client().auth.signUp({
          email: email.trim(),
          password,
          options: {
            // 註冊後由資料庫觸發程序自動建立個人設定（profiles 等）
            data: { display_name: displayName.trim() },
            emailRedirectTo: `${siteUrl()}/`,
          },
        });
        if (error) throw error;
        return { needsEmailConfirmation: !data.session };
      },
      async signOut() {
        // scope: 'local' 只登出這台裝置，其他裝置保持登入
        const { error } = await client().auth.signOut({ scope: "local" });
        if (error) throw error;
      },
      async sendPasswordReset(email) {
        const { error } = await client().auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${siteUrl()}/reset-password`,
        });
        if (error) throw error;
      },
      async updatePassword(password) {
        const { error } = await client().auth.updateUser({ password });
        if (error) throw error;
        setPasswordRecovery(false);
      },
    }),
    [session, loading, passwordRecovery],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth 必須在 AuthProvider 內使用");
  return ctx;
}
