import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/dydlye/AppShell";
import { useFavorites } from "@/hooks/useFavorites";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useTheme, themeLabels } from "@/hooks/useTheme";
import { useMyProperties } from "@/hooks/useMyProperties";
import { toast } from "sonner";
import { useSettings } from "@/i18n/useTranslation";
import { languageNames } from "@/i18n/translations";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "حسابي - Dydlye" },
      { name: "description", content: "إدارة ملفك الشخصي وإعدادات تطبيق Dydlye." },
    ],
  }),
  component: AccountPage,
});

const settings: {
  label: string;
  desc?: string;
  icon: string;
  to?:
    | "/settings/account"
    | "/settings/notifications"
    | "/settings/language"
    | "/settings/appearance";
}[] = [
  {
    label: "إعدادات الحساب",
    desc: "إدارة أو حذف حسابك نهائياً",
    icon: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
    to: "/settings/account",
  },
  {
    label: "الإشعارات",
    desc: "تنبيهات الحجوزات والعروض",
    icon: "M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0",
    to: "/settings/notifications",
  },
  {
    label: "اللغة والمنطقة",
    icon: "M12 2a10 10 0 100 20 10 10 0 000-20zM2 12h20M12 2a15 15 0 010 20M12 2a15 15 0 000 20",
    to: "/settings/language",
  },
  {
    label: "الوضع الداكن",
    icon: "M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z",
    to: "/settings/appearance",
  },
];

const links: {
  label: string;
  icon: string;
  to?: "/bookings" | "/my-properties" | "/support" | "/about";
  danger?: boolean;
}[] = [
  {
    label: "حجوزاتي",
    icon: "M8 2v4M16 2v4M3 10h18M5 6h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z",
    to: "/bookings",
  },
  {
    label: "إدارة عقاراتي",
    icon: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
    to: "/my-properties",
  },
  {
    label: "المساعدة والدعم",
    icon: "M12 22a10 10 0 100-20 10 10 0 000 20zM9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01",
    to: "/support",
  },
  {
    label: "عن التطبيق",
    icon: "M12 22a10 10 0 100-20 10 10 0 000 20zM12 16v-4M12 8h.01",
    to: "/about",
  },
  {
    label: "تسجيل الخروج",
    icon: "M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9",
    danger: true,
  },
];

function AccountPage() {
  const { ids } = useFavorites();
  const { user, loading, signOut } = useAuth();
  const { profile } = useProfile(user?.id);
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { properties: myProperties } = useMyProperties(user?.id);
  const { t, lang } = useSettings();

  const settingDescs: Record<string, string> = {
    [t("account.language")]: `${languageNames[lang]} • ${t("lang.morocco")}`,
    [t("account.darkMode")]: themeLabels[theme],
  };

  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ||
    (user?.user_metadata?.name as string | undefined) ||
    user?.email?.split("@")[0];
  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-6 sm:py-8">
        {/* Profile card */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-primary-glow p-6 text-white shadow-lg">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.3),transparent_60%)]" />
          <div className="relative flex items-center gap-4">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName ?? "المستخدم"}
                className="h-16 w-16 rounded-3xl object-cover shadow-md"
                referrerPolicy="no-referrer"
                loading="lazy"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-white/20 text-2xl font-extrabold backdrop-blur">
                {displayName ? displayName.charAt(0).toUpperCase() : "م"}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-xl font-extrabold">
                {user ? `مرحباً، ${displayName}` : "مرحباً، ضيف"}
              </h1>
              <p className="truncate text-sm opacity-90">
                {user ? user.email : "سجّل الدخول لمزامنة حجوزاتك ومفضلتك."}
              </p>
            </div>
            {!user && !loading && (
              <button
                onClick={() => navigate({ to: "/auth" })}
                className="rounded-full bg-white px-4 py-2 text-xs font-bold text-primary shadow-md"
              >
                تسجيل دخول
              </button>
            )}
            {user && profile?.is_host && (
              <button
                onClick={() => navigate({ to: "/my-properties" })}
                className="rounded-full bg-white px-4 py-2 text-xs font-bold text-primary shadow-md transition hover:bg-white/90 active:scale-95 shrink-0"
              >
                إدارة عقاراتي
              </button>
            )}
            {user && !profile?.is_host && (
              <button
                onClick={() => navigate({ to: "/become-host" })}
                className="rounded-full bg-white px-4 py-2 text-xs font-bold text-primary shadow-md transition hover:bg-white/90 active:scale-95 shrink-0"
              >
                أصبح مضيفاً
              </button>
            )}
          </div>

          {(() => {
            const stats = [
              { v: ids.length, l: "المفضلة", to: "/favorites", show: true },
              {
                v: myProperties.length,
                l: "عقاراتي",
                to: "/my-properties",
                show: profile?.is_host,
              },
              { v: 0, l: "التقييمات", to: null, show: true },
            ].filter((s) => s.show);

            return (
              <div
                className={`relative mt-5 grid ${stats.length === 2 ? "grid-cols-2" : "grid-cols-3"} gap-3 text-center text-white`}
              >
                {stats.map((s) => {
                  const clickable = !!s.to;
                  const Component = clickable ? "button" : "div";
                  return (
                    <Component
                      key={s.l}
                      {...(clickable
                        ? { onClick: () => navigate({ to: s.to as "/favorites" }) }
                        : {})}
                      className={`rounded-2xl bg-white/15 p-3 backdrop-blur transition ${
                        clickable ? "hover:bg-white/25 active:scale-95 cursor-pointer" : ""
                      }`}
                    >
                      <div className="text-lg font-extrabold">{s.v}</div>
                      <div className="text-[11px] opacity-90">{s.l}</div>
                    </Component>
                  );
                })}
              </div>
            );
          })()}
        </section>

        {/* Settings */}
        <section className="mt-6">
          <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            الإعدادات
          </h2>
          <div className="overflow-hidden rounded-3xl bg-card shadow-sm">
            {settings.map((s, i) => (
              <button
                key={s.label}
                onClick={() => {
                  if (s.to) navigate({ to: s.to });
                }}
                className={`flex w-full items-center gap-3 p-4 text-right transition hover:bg-secondary ${
                  i !== settings.length - 1 ? "border-b border-border" : ""
                }`}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d={s.icon} />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-foreground">{s.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {settingDescs[s.label] ?? s.desc}
                  </div>
                </div>
                <svg
                  className="h-4 w-4 text-muted-foreground rotate-180"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            ))}
          </div>
        </section>

        {/* Links */}
        <section className="mt-5 mb-4">
          <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            عام
          </h2>
          <div className="overflow-hidden rounded-3xl bg-card shadow-sm">
            {links.map((l, i) => {
              if (l.to === "/my-properties" && !profile?.is_host) return null;
              const isAuthBtn = !!l.danger;
              const label = isAuthBtn ? (user ? "تسجيل الخروج" : "تسجيل الدخول") : l.label;
              return (
                <button
                  key={l.label}
                  onClick={() => {
                    if (isAuthBtn) {
                      if (user) signOut();
                      else navigate({ to: "/auth" });
                    } else if (l.to) {
                      navigate({ to: l.to });
                    }
                  }}
                  className={`flex w-full items-center gap-3 p-4 text-right transition hover:bg-secondary ${
                    i !== links.length - 1 ? "border-b border-border" : ""
                  } ${l.danger ? "text-destructive" : "text-foreground"}`}
                >
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-2xl ${l.danger ? "bg-destructive/10 text-destructive" : "bg-secondary text-foreground"}`}
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d={l.icon} />
                    </svg>
                  </div>
                  <div className="flex-1 text-sm font-semibold">{label}</div>
                  <svg
                    className="h-4 w-4 text-muted-foreground rotate-180"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              );
            })}
          </div>
        </section>

        <p className="text-center text-xs font-bold text-primary">{t("app.tagline")}</p>
        <p className="mt-1 text-center text-xs text-muted-foreground">Dydlye • v1.0</p>
      </div>
    </AppShell>
  );
}
