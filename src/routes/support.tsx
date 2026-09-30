import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "@/components/dydlye/SettingsPage";
import { useSettings } from "@/i18n/useTranslation";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "المساعدة والدعم - Dydlye" },
      { name: "description", content: "مركز المساعدة والدعم لتطبيق Dydlye." },
    ],
  }),
  component: SupportPage,
});

function SupportPage() {
  const { t, dir } = useSettings();

  const faqs = [
    { q: t("support.faq1q"), a: t("support.faq1a") },
    { q: t("support.faq2q"), a: t("support.faq2a") },
    { q: t("support.faq3q"), a: t("support.faq3a") },
  ];

  return (
    <SettingsPage title={t("support.heading")} subtitle={t("support.subtitle")}>
      <div className="space-y-4">
        <section className="overflow-hidden rounded-3xl bg-card shadow-sm">
          <div className="p-4 font-bold border-b border-border bg-secondary/50">
            {t("support.faq")}
          </div>
          {faqs.map((faq, i) => (
            <div key={i} className={`p-4 ${i !== faqs.length - 1 ? "border-b border-border" : ""}`}>
              <div className="text-sm font-bold text-foreground mb-1">{faq.q}</div>
              <div className="text-xs text-muted-foreground leading-relaxed">{faq.a}</div>
            </div>
          ))}
        </section>

        <section className="overflow-hidden rounded-3xl bg-card shadow-sm">
          <div className="p-4 font-bold border-b border-border bg-secondary/50">
            {t("support.contact")}
          </div>
          <button className="flex w-full items-center gap-3 p-4 text-right transition hover:bg-secondary border-b border-border">
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
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold">{t("support.call")}</div>
              <div className="text-xs text-muted-foreground">{t("support.available")}</div>
            </div>
          </button>
          <a
            href="mailto:dydlye.contact@gmail.com"
            className="flex w-full items-center gap-3 p-4 text-right transition hover:bg-secondary"
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
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold">{t("support.email")}</div>
              <div className="text-xs text-muted-foreground">dydlye.contact@gmail.com</div>
            </div>
          </a>
        </section>
      </div>
    </SettingsPage>
  );
}
