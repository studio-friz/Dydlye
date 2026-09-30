import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import { Logo } from "./Logo";
import { useTranslation } from "@/i18n/useTranslation";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { isFavoritesFilterActive, onFavoritesFilterChange } from "@/lib/favoritesFilter";

type NavItem = {
  to: "/" | "/ads" | "/bookings" | "/account";
  key: string;
  icon: string;
  extra?: boolean;
};

function getNavItems(t: (k: string, ...a: string[]) => string): NavItem[] {
  return [
    { to: "/", key: t("nav.map"), icon: "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" },
    { to: "/ads", key: t("nav.offers"), icon: "M3 11l18-8v18l-18-8M3 11v5M3 11l8 4" },
    {
      to: "/bookings",
      key: t("nav.bookings"),
      icon: "M19 4H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zM16 2v4M8 2v4M3 10h18",
    },
    {
      to: "/account",
      key: t("nav.account"),
      icon: "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2",
      extra: true,
    },
  ];
}

function Brand({ collapsed, tagline }: { collapsed?: boolean; tagline: string }) {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-sm border border-border p-1.5">
        <Logo />
      </div>
      {!collapsed && (
        <div className="leading-tight">
          <div className="bg-gradient-to-l from-primary to-primary-glow bg-clip-text text-2xl font-extrabold tracking-tight text-transparent uppercase">
            Dydlye
          </div>
          <div className="text-[10px] font-medium text-muted-foreground">{tagline}</div>
        </div>
      )}
    </Link>
  );
}

function MyPropertiesIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

export function AppShell({
  children,
  fullBleed = false,
}: {
  children: ReactNode;
  fullBleed?: boolean;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { dir, t } = useTranslation();
  const navItems = getNavItems(t);
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const [favFilterActive, setFavFilterActive] = useState(() => isFavoritesFilterActive());

  useEffect(() => {
    return onFavoritesFilterChange((v) => setFavFilterActive(v));
  }, []);

  const btnBaseMobile =
    "mob-landscape-item flex flex-1 flex-col items-center gap-1 py-1.5 transition";
  const labelBase = "mob-landscape-rail-label text-[10px] font-semibold";

  const isLoggedIn = !!user;

  return (
    <div
      dir={dir}
      className="flex h-[100dvh] w-full flex-col overflow-hidden bg-background md:flex-row"
    >
      {/* Desktop side nav */}
      <aside className="hidden md:flex md:w-20 lg:w-64 shrink-0 flex-col border-l border-border bg-surface-elevated/95 backdrop-blur-xl shadow-sm">
        <div className="p-4 lg:p-5">
          <div className="hidden lg:block">
            <Brand tagline={t("app.tagline")} />
          </div>
          <div className="lg:hidden flex justify-center">
            <Brand collapsed tagline={t("app.tagline")} />
          </div>
        </div>
        <nav className="flex-1 px-2 lg:px-3 space-y-0.5">
          {navItems.map((it) => {
            const active = pathname === it.to;
            return (
              <Link
                key={it.to}
                to={it.to}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200 ${
                  active
                    ? "bg-gradient-to-l from-primary to-primary-glow text-white shadow-md scale-[1.02]"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <svg
                  className={`h-5 w-5 shrink-0 transition ${active ? "scale-110" : ""}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d={it.icon} />
                  {it.extra && <circle cx="12" cy="7" r="4" />}
                </svg>
                <span className="hidden lg:inline">{it.key}</span>
              </Link>
            );
          })}
          {/* Desktop عقاراتي for hosts */}
          {profile?.is_host && (
            <Link
              to="/my-properties"
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200 ${
                pathname === "/my-properties"
                  ? "bg-gradient-to-l from-primary to-primary-glow text-white shadow-md scale-[1.02]"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              <MyPropertiesIcon />
              <span className="hidden lg:inline">{t("search.myProperties")}</span>
            </Link>
          )}
          {/* Desktop Login button for guests */}
          {!isLoggedIn && (
            <Link
              to="/auth"
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200 bg-red-600 text-white shadow-md hover:bg-red-700 mt-2"
            >
              <svg
                className="h-5 w-5 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
              <span className="hidden lg:inline">{t("auth.loginButton")}</span>
            </Link>
          )}
        </nav>
      </aside>

      {/* Main column */}
      <div className="mob-landscape-row flex min-w-0 flex-1 flex-col overflow-hidden">
        <main
          className={`flex-1 overflow-x-hidden ${fullBleed ? "overflow-hidden" : "overflow-y-auto"}`}
        >
          {children}
        </main>

        {/* Mobile bottom nav */}
        <nav className="mob-landscape-rail md:hidden relative z-20 flex shrink-0 items-stretch justify-around border-t border-border/80 bg-surface-elevated/95 px-1 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-1.5 backdrop-blur-2xl shadow-[0_-4px_20px_oklch(0.2_0.08_260_/_0.06)]">
          {/* Map */}
          <Link
            to="/"
            className={`${btnBaseMobile} ${pathname === "/" ? (favFilterActive ? "text-red-500" : "text-primary") : "text-muted-foreground"}`}
          >
            <div
              className={`flex h-9 w-full items-center justify-center rounded-xl transition-all duration-200 ${pathname === "/" ? (favFilterActive ? "bg-red-500/10 shadow-sm" : "bg-primary/10 shadow-sm") : ""}`}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill={pathname === "/" ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <span className={`${labelBase} ${pathname === "/" ? "text-[10px]" : ""}`}>
              {t("nav.map")}
            </span>
          </Link>

          {/* Offers */}
          <Link
            to="/ads"
            className={`${btnBaseMobile} ${pathname === "/ads" ? "text-primary" : "text-muted-foreground"}`}
          >
            <div
              className={`flex h-9 w-full items-center justify-center rounded-xl transition-all duration-200 ${pathname === "/ads" ? "bg-primary/10 shadow-sm" : ""}`}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill={pathname === "/ads" ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 11l18-8v18l-18-8M3 11v5M3 11l8 4" />
              </svg>
            </div>
            <span className={labelBase}>{t("nav.offers")}</span>
          </Link>

          {/* عقاراتي — وسط, أزرق (للمضيفين فقط) */}
          {profile?.is_host && (
            <Link
              to="/my-properties"
              className={`${btnBaseMobile} ${pathname === "/my-properties" ? "text-sky-500" : "text-muted-foreground"}`}
            >
              <div
                className={`flex h-9 w-full items-center justify-center rounded-xl transition-all duration-200 ${pathname === "/my-properties" ? "bg-sky-500/10 shadow-sm" : ""}`}
              >
                <MyPropertiesIcon />
              </div>
              <span className={labelBase}>{t("search.myProperties")}</span>
            </Link>
          )}

          {/* Bookings */}
          <Link
            to="/bookings"
            className={`${btnBaseMobile} ${pathname === "/bookings" ? "text-primary" : "text-muted-foreground"}`}
          >
            <div
              className={`flex h-9 w-full items-center justify-center rounded-xl transition-all duration-200 ${pathname === "/bookings" ? "bg-primary/10 shadow-sm" : ""}`}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill={pathname === "/bookings" ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 4H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2z" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
            </div>
            <span className={labelBase}>{t("nav.bookings")}</span>
          </Link>

          {/* Account */}
          {!isLoggedIn ? (
            <Link
              to="/auth"
              className={`${btnBaseMobile} ${pathname === "/auth" ? "text-red-500" : "text-muted-foreground"}`}
            >
              <div
                className={`flex h-9 w-full items-center justify-center rounded-xl transition-all duration-200 ${pathname === "/auth" ? "bg-red-500/10 shadow-sm" : ""}`}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" />
                  <polyline points="10 17 15 12 10 7" />
                  <line x1="15" y1="12" x2="3" y2="12" />
                </svg>
              </div>
              <span className={labelBase}>{t("auth.loginButton")}</span>
            </Link>
          ) : (
            <Link
              to="/account"
              className={`${btnBaseMobile} ${pathname === "/account" ? "text-primary" : "text-muted-foreground"}`}
            >
              <div
                className={`flex h-9 w-full items-center justify-center rounded-xl transition-all duration-200 ${pathname === "/account" ? "bg-primary/10 shadow-sm" : ""}`}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <span className={labelBase}>{t("nav.account")}</span>
            </Link>
          )}
        </nav>
      </div>
    </div>
  );
}
