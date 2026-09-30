import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "@/components/dydlye/SettingsPage";
import { useSettings } from "@/i18n/useTranslation";

export const Route = createFileRoute("/values")({
  head: () => ({
    meta: [
      { title: "قيم التطبيق - Dydlye" },
      { name: "description", content: "تعرف على القيم والمبادئ التي يقوم عليها Dydlye." },
    ],
  }),
  component: ValuesPage,
});

function ValuesPage() {
  const { t, dir } = useSettings();

  const values = [
    {
      title: t("values.transparency"),
      desc: t("values.transparencyDesc"),
      icon: "M12 22a10 10 0 100-20 10 10 0 000 20zM12 16v-4M12 8h.01",
    },
    {
      title: t("values.quality"),
      desc: t("values.qualityDesc"),
      icon: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
    },
    {
      title: t("values.innovation"),
      desc: t("values.innovationDesc"),
      icon: "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
    },
    {
      title: t("values.community"),
      desc: t("values.communityDesc"),
      icon: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 110-8 4 4 0 010 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75",
    },
  ];

  return (
    <SettingsPage title={t("values.heading")} subtitle={t("values.subtitle")}>
      <div className="space-y-4">
        {values.map((v, i) => (
          <div
            key={i}
            className="rounded-3xl bg-card p-5 shadow-sm border border-border/50 flex gap-4"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d={v.icon} />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-foreground mb-1">{v.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{v.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </SettingsPage>
  );
}
