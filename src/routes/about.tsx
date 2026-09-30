import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { SettingsPage } from "@/components/dydlye/SettingsPage";
import { useSettings } from "@/i18n/useTranslation";

import { Logo } from "@/components/dydlye/Logo";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "عن التطبيق - Dydlye" },
      { name: "description", content: "تعرف على Dydlye ورؤيتنا لتسهيل البحث عن سكن." },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  const navigate = useNavigate();
  const { t, dir } = useSettings();

  return (
    <SettingsPage title={t("about.heading")} subtitle={t("about.subtitle")}>
      <div className="space-y-6">
        <div className="flex flex-col items-center py-6">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-3xl bg-white shadow-lg mb-4 border border-border p-3">
            <Logo />
          </div>
          <h2 className="text-2xl font-extrabold text-foreground uppercase">Dydlye</h2>
          <p className="mt-1 text-sm font-bold text-primary">{t("app.tagline")}</p>
          <p className="text-sm text-muted-foreground">{t("about.version")}</p>
        </div>

        <section className="rounded-3xl bg-card p-6 shadow-sm leading-relaxed text-foreground">
          <p className="mb-4">{t("about.p1")}</p>
          <p>{t("about.p2")}</p>
        </section>

        <section className="overflow-hidden rounded-3xl bg-card shadow-sm">
          <button
            onClick={() => navigate({ to: "/privacy" })}
            className="flex w-full items-center justify-between p-4 text-right transition hover:bg-secondary border-b border-border"
          >
            <span className="text-sm font-semibold">{t("about.privacy")}</span>
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
          <button
            onClick={() => navigate({ to: "/terms" })}
            className="flex w-full items-center justify-between p-4 text-right transition hover:bg-secondary border-b border-border"
          >
            <span className="text-sm font-semibold">{t("about.terms")}</span>
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
          <button
            onClick={() => navigate({ to: "/values" })}
            className="flex w-full items-center justify-between p-4 text-right transition hover:bg-secondary"
          >
            <span className="text-sm font-semibold">{t("about.values")}</span>
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
        </section>

        <p className="text-center text-xs text-muted-foreground italic">{t("about.made")}</p>
      </div>
    </SettingsPage>
  );
}
