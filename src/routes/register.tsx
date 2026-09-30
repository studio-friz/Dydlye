import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserCountry } from "@/hooks/useUserCountry";

import { Logo } from "@/components/dydlye/Logo";
import { CountryOnboarding } from "@/components/dydlye/CountryOnboarding";
import type { Country } from "@/data/worldCountries";
import { useSettings } from "@/i18n/useTranslation";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "إنشاء حساب - Dydlye" },
      { name: "description", content: "أنشئ حسابك على Dydlye لحجز العقارات والاستمتاع بالرحلات." },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const { isFirstLogin, setCountry, markFirstLoginDone } = useUserCountry();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const { t, dir } = useSettings();

  const handleOnboardingComplete = (country: Country) => {
    setCountry(country);
    markFirstLoginDone();
    navigate({ to: "/", replace: true });
  };

  useEffect(() => {
    if (!loading && session) {
      if (isFirstLogin) {
        setShowOnboarding(true);
      } else {
        navigate({ to: "/account", replace: true });
      }
    }
  }, [loading, session, navigate, isFirstLogin]);

  if (showOnboarding) {
    return <CountryOnboarding onComplete={handleOnboardingComplete} />;
  }

  const signInWithGoogle = async () => {
    setBusy(true);
    setError(null);
    try {
      const redirectTo = window.location.origin + "/auth";
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
      if (error) throw error;
    } catch (e: unknown) {
      const err = (e ?? {}) as { message?: unknown };
      setError(String(err?.message ?? "") || t("auth.error"));
      setBusy(false);
    }
  };

  const signInWithFacebook = async () => {
    setBusy(true);
    setError(null);
    try {
      const redirectTo = window.location.origin + "/auth";
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "facebook",
        options: { redirectTo },
      });
      if (error) throw error;
    } catch (e: unknown) {
      const err = (e ?? {}) as { message?: unknown };
      setError(String(err?.message ?? "") || t("auth.error"));
      setBusy(false);
    }
  };

  const signInWithTwitter = async () => {
    setBusy(true);
    setError(null);
    try {
      const redirectTo = window.location.origin + "/auth";
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "x",
        options: { redirectTo },
      });
      if (error) throw error;
    } catch (e: unknown) {
      const err = (e ?? {}) as { message?: unknown };
      setError(String(err?.message ?? "") || t("auth.error"));
      setBusy(false);
    }
  };

  return (
    <div
      dir={dir}
      className="relative flex min-h-[100dvh] min-h-[100svh] flex-col items-center overflow-x-hidden bg-background px-4 py-8 sm:px-6"
    >
      {/* Decorative background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="relative flex w-full max-w-sm flex-1 flex-col justify-center">
        {/* Brand */}
        <div className="mb-6 flex flex-col items-center text-center sm:mb-8">
          <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-3xl bg-white shadow-lg border border-border p-2 sm:h-16 sm:w-16">
            <Logo />
          </div>
          <h1 className="mt-3 bg-gradient-to-l from-primary to-primary-glow bg-clip-text text-2xl font-extrabold tracking-tight text-transparent uppercase sm:mt-4 sm:text-3xl">
            Dydlye
          </h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{t("app.tagline")}</p>
        </div>

        {/* Card */}
        <div className="rounded-3xl bg-card p-4 shadow-lg sm:p-6">
          <h2 className="text-center text-base font-extrabold text-foreground sm:text-lg">
            {t("auth.createAccount")} 🚀
          </h2>
          <p className="mt-1 text-center text-xs text-muted-foreground sm:text-sm">
            {t("auth.loginHint")}
          </p>

          {/* Google Button */}
          <button
            onClick={signInWithGoogle}
            disabled={busy}
            className="mt-4 flex w-full items-center justify-center gap-3 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-bold text-foreground shadow-sm transition hover:bg-secondary disabled:opacity-60 sm:mt-5 sm:py-3.5"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18A10.97 10.97 0 001 12c0 1.78.43 3.45 1.18 4.94l3.66-2.84z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>{t("auth.google")}</span>
          </button>

          {/* Divider */}
          <div className="mt-4 flex items-center gap-3 sm:mt-5">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[11px] font-semibold text-muted-foreground">{t("auth.or")}</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Facebook Button */}
          <div className="mt-4 space-y-2.5 sm:mt-5 sm:space-y-3">
            <button
              onClick={signInWithFacebook}
              disabled={busy}
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-[#1877F2] px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#166FE5] disabled:opacity-60 sm:py-3.5"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="white">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              <span>{t("auth.facebook")}</span>
            </button>

            {/* X/Twitter Button */}
            <button
              onClick={signInWithTwitter}
              disabled={busy}
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-black px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-gray-800 disabled:opacity-60 sm:py-3.5"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="white">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              <span>{t("auth.twitter")}</span>
            </button>
          </div>

          {error && (
            <p className="mt-2.5 text-center text-[11px] font-semibold text-destructive sm:mt-3 sm:text-xs">
              {error}
            </p>
          )}

          <p className="mt-4 text-center text-xs text-muted-foreground sm:mt-5 sm:text-sm">
            {t("auth.hasAccount")}{" "}
            <Link to="/auth" className="font-bold text-primary hover:underline">
              {t("auth.goLogin")}
            </Link>
          </p>

          <p className="mt-2 text-center text-[11px] leading-relaxed text-muted-foreground sm:mt-3">
            {t("auth.agree")} {t("auth.terms")} {t("auth.and")} {t("auth.privacy")} {t("auth.of")}
          </p>
        </div>
      </div>
    </div>
  );
}
