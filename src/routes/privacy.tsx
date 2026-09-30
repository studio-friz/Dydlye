import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "@/components/dydlye/SettingsPage";
import { useSettings } from "@/i18n/useTranslation";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "سياسة الخصوصية - Dydlye" },
      { name: "description", content: "تعرف على كيفية حماية بياناتك في Dydlye." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  const { t, dir } = useSettings();

  return (
    <SettingsPage title={t("privacy.heading")} subtitle={t("privacy.subtitle")}>
      <div className="rounded-3xl bg-card p-6 shadow-sm leading-relaxed text-foreground space-y-4">
        <section>
          <h3 className="font-bold text-lg mb-2 text-primary">{t("privacy.collect")}</h3>
          <p className="text-sm text-muted-foreground">{t("privacy.collectDesc")}</p>
        </section>

        <section>
          <h3 className="font-bold text-lg mb-2 text-primary">{t("privacy.usage")}</h3>
          <p className="text-sm text-muted-foreground">{t("privacy.usageDesc")}</p>
        </section>

        <section>
          <h3 className="font-bold text-lg mb-2 text-primary">{t("privacy.sharing")}</h3>
          <p className="text-sm text-muted-foreground">{t("privacy.sharingDesc")}</p>
        </section>

        <section>
          <h3 className="font-bold text-lg mb-2 text-primary">{t("privacy.storage")}</h3>
          <p className="text-sm text-muted-foreground">{t("privacy.storageDesc")}</p>
        </section>

        <section>
          <h3 className="font-bold text-lg mb-2 text-primary">{t("privacy.protection")}</h3>
          <p className="text-sm text-muted-foreground">{t("privacy.protectionDesc")}</p>
        </section>

        <section>
          <h3 className="font-bold text-lg mb-2 text-primary">{t("privacy.contact")}</h3>
          <p className="text-sm text-muted-foreground">{t("privacy.contactDesc")}</p>
        </section>

        <p className="text-xs text-muted-foreground pt-4 border-t border-border">
          {t("privacy.updated")}
        </p>
      </div>
    </SettingsPage>
  );
}
