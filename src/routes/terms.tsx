import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "@/components/dydlye/SettingsPage";
import { useSettings } from "@/i18n/useTranslation";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "شروط الاستخدام - Dydlye" },
      { name: "description", content: "شروط وأحكام استخدام تطبيق Dydlye." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  const { t, dir } = useSettings();

  return (
    <SettingsPage title={t("terms.heading")} subtitle={t("terms.subtitle")}>
      <div className="rounded-3xl bg-card p-6 shadow-sm leading-relaxed text-foreground space-y-4">
        <section>
          <h3 className="font-bold text-lg mb-2 text-primary">{t("terms.accept")}</h3>
          <p className="text-sm text-muted-foreground">{t("terms.acceptDesc")}</p>
        </section>

        <section>
          <h3 className="font-bold text-lg mb-2 text-primary">{t("terms.responsibility")}</h3>
          <p className="text-sm text-muted-foreground">{t("terms.responsibilityDesc")}</p>
        </section>

        <section>
          <h3 className="font-bold text-lg mb-2 text-primary">{t("terms.booking")}</h3>
          <p className="text-sm text-muted-foreground">{t("terms.bookingDesc")}</p>
        </section>

        <section>
          <h3 className="font-bold text-lg mb-2 text-primary">{t("terms.prohibited")}</h3>
          <p className="text-sm text-muted-foreground">{t("terms.prohibitedDesc")}</p>
        </section>

        <section>
          <h3 className="font-bold text-lg mb-2 text-primary">{t("terms.liability")}</h3>
          <p className="text-sm text-muted-foreground">{t("terms.liabilityDesc")}</p>
        </section>

        <section>
          <h3 className="font-bold text-lg mb-2 text-primary">{t("terms.changes")}</h3>
          <p className="text-sm text-muted-foreground">{t("terms.changesDesc")}</p>
        </section>

        <p className="text-xs text-muted-foreground pt-4 border-t border-border">
          {t("terms.updated")}
        </p>
      </div>
    </SettingsPage>
  );
}
