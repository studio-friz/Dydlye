import { useEffect, useState } from "react";
import { AlertTriangle, LogOut, ShieldCheck } from "lucide-react";
import { Button, Card, Input, Label, Spinner } from "@/components/ui";
import { adminApi, AdminApiError } from "@/lib/adminApi";
import { supabase } from "@/lib/supabase";

/**
 * Admin sign-in.
 *
 * Two independent checks happen here:
 *   1. Supabase Auth accepts the credentials and returns a session.
 *   2. `admin-api` reports the user as an administrator (row in `public.admins`).
 *
 * A valid account that is not an admin therefore still gets no access, and the
 * browser never holds a key that can bypass RLS.
 */
export function Login({ onSignedIn }: { onSignedIn: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void adminApi
      .whoami()
      .then(() => {
        if (active) onSignedIn();
      })
      .catch(() => {
        /* Not signed in yet — show the form. */
      });
    return () => {
      active = false;
    };
  }, [onSignedIn]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) throw new Error(signInError.message);

      await adminApi.whoami();
      onSignedIn();
    } catch (err) {
      if (err instanceof AdminApiError) {
        setError(
          err.status === 403
            ? "هذا الحساب مسجل لكنه ليس حساب مشرف. أضف بريده إلى جدول admins."
            : err.message,
        );
      } else {
        setError(err instanceof Error ? err.message : "تعذّر تسجيل الدخول");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div dir="rtl" className="flex min-h-dvh w-full items-center justify-center bg-background p-6">
      <Card className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-border bg-white p-1">
            <img src="/Dydlye.png" alt="Dydlye" className="h-full w-full object-contain" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-foreground">لوحة تحكم Dydlye</h1>
            <p className="mt-1 text-xs text-muted-foreground">الدخول مخصص لحسابات المشرفين فقط</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="email">البريد الإلكتروني</Label>
            <Input
              id="email"
              type="email"
              dir="ltr"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
            />
          </div>
          <div>
            <Label htmlFor="password">كلمة المرور</Label>
            <Input
              id="password"
              type="password"
              dir="ltr"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-2xl bg-destructive/10 p-3 text-xs leading-relaxed text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? <Spinner className="h-4 w-4 border-2" /> : <ShieldCheck className="h-4 w-4" />}
            {busy ? "جاري التحقق..." : "تسجيل الدخول"}
          </Button>
        </form>

        <p className="mt-5 text-center text-[11px] leading-relaxed text-muted-foreground">
          يتم التحقق من الصلاحيات على الخادم عبر دالة <code>admin-api</code>، ولا يتم تخزين أي مفتاح
          يملك صلاحيات كاملة في المتصفح.
        </p>
      </Card>
    </div>
  );
}

export function SignOutButton() {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="secondary"
      disabled={busy}
      className="w-full"
      onClick={() => {
        setBusy(true);
        void supabase.auth.signOut().finally(() => window.location.reload());
      }}
    >
      <LogOut className="h-4 w-4" />
      {busy ? "جاري الخروج..." : "تسجيل الخروج"}
    </Button>
  );
}
